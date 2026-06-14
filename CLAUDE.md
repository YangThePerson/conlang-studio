@AGENTS.md

# Project rules

## Next.js version notes

This project uses **Next.js 16+**. Key breaking changes from earlier versions:

- **Middleware is now called Proxy.** The file is `proxy.ts` at the project root, not `middleware.ts`. The API is otherwise identical. Note: proxy is **not** a security boundary (it can be bypassed); it is for routing/redirects only. Real authorization happens per-handler (see Security requirements).
- **`params` in dynamic routes is a `Promise`.** Always `await params` before destructuring: `const { id } = await params`.
- **`PageProps<'/path/[id]'>` and `LayoutProps<'/path'>` are global helpers** — no import needed. Use them for typed page and layout props.
- **Cache invalidation after mutations.** There are two distinct mechanisms; do not conflate them:
  - **Server-side cache invalidation** — call `revalidatePath('/path')` or `revalidateTag(tag, 'max')` (from `next/cache`) inside a Server Action after a mutation. These run on the server only. The single-argument `revalidateTag(tag)` form is deprecated — always pass the second argument.
  - **Client-side router refresh** — call `router.refresh()` from `useRouter()` (`next/navigation`) inside a **client component** when you want the current route re-fetched without changing any cache. This is a client API; it is not exported from `next/cache`.

---

## Architecture: thin adapters over a shared service layer

The most important rule in this file. Route handlers and Server Actions are **thin entry points**. The real work for each operation lives once, in a feature service module, and both entry points call it. This is what keeps the two paths from drifting and what makes adding a future mobile client cheap.

### `app/lib/<feature>.ts` — the service layer (single home for an operation)

Each mutating/reading operation is one exported function here, e.g. `createLanguage(user, rawInput)`, `updateLanguage(user, rawInput)`, `deleteLanguage(user, id)`.

A service function:

1. Receives an **already-resolved DB user** (auth is the adapter's job — see below) and **raw, untrusted input**.
2. Runs `safeParse` against the relevant schema from `validation.ts`. (Input validation.)
3. Enforces ownership in the query itself: `eq(<table>.user_id, user.id)` in every `WHERE`. (Ownership.)
4. Performs the DB operation.
5. Returns a typed result — never throws for expected failures. See "Result shape" below.

A service function is **framework-agnostic**: no `revalidatePath`, no `Response.json`, no reading of `auth()`/cookies. That is precisely what lets a browser action, an HTTP route handler, and a future mobile route handler all reuse it unchanged.

### `app/<feature>/actions.ts` — Server Action adapters

Triggered by client components in this app. An action:

- Resolves auth via `getOrCreateDbUser()` (cookie session).
- Gathers raw input from its arguments / `FormData` into a plain object.
- Calls the matching `app/lib/<feature>.ts` function.
- On success, calls `revalidatePath(...)` for affected paths, then returns the result for `useActionState`.
- Returns the service's result object to the client; does **not** translate it into thrown errors.

### `app/api/.../route.ts` — Route handler adapters

Triggered by any HTTP client (future mobile app, external scripts, curl). A route handler:

- Resolves auth (today: cookie session via `getOrCreateDbUser()`; **see mobile note below**).
- Parses the request body / reads route params into a plain object.
- Calls the same `app/lib/<feature>.ts` function the corresponding action uses.
- Maps the result to HTTP: `{ ok: true }` → `200`/`201` with the row in `Response.json(...)`; `{ ok: false }` → the appropriate status (`400`/`401`/`404`) with a JSON error body.

> **Mobile-auth caveat:** A mobile client cannot ride Clerk's cookie session — it authenticates with bearer tokens via Clerk's mobile SDK. So `getOrCreateDbUser()` as written (cookie-session resolution) will **not** transfer unchanged to the route handlers a mobile app calls; that path will need a token-based resolver. The _service layer_ is unaffected because it receives an already-resolved user. Until a mobile client is real, the parallel route handlers are kept deliberately, but because the service layer makes adding them trivial, deleting them and re-adding later is a legitimate alternative — decide consciously rather than by default.

---

## Separation of concerns

### `app/db/validation.ts` — single home for all Zod schemas

Every Zod schema lives here. Never define schemas inline inside route handlers, Server Actions, or service functions.

- Input schemas (client-supplied fields only) are named `create<Entity>InputSchema` / `update<Entity>InputSchema`. Prefer the general `update<Entity>InputSchema` over operation-specific names like `rename<Entity>InputSchema` unless the operation is genuinely distinct.
- Full insert schemas (including server-injected fields like `user_id`) are named `create<Entity>Schema`.
- `uuidSchema` is the shared validator for bare UUID params — import it wherever an ID must be validated.
- Document what is intentionally absent from input schemas (e.g. `user_id` is absent because it is injected server-side from the auth session, never supplied by the client).

### `app/db/schema.ts` — Drizzle table definitions only

No business logic here. Types for table rows are derived via `typeof <table>.$inferSelect` and `typeof <table>.$inferInsert` at the use site.

### `app/lib/current-user.ts` — auth boundary

`getOrCreateDbUser` is the canonical way to resolve a Clerk session to a DB user row. Always call it from adapters; never read `auth()` or `currentUser()` directly in routes, actions, or services.

> Note (a real surprise worth its JSDoc): `getOrCreateDbUser` **writes** — it lazily creates the user row on first need. This means an otherwise read-only path that calls it can trigger a row insert. That is the intended provisioning model for now; document it so it isn't mistaken for a pure read.

---

## Result shape (return, don't throw, for expected failures)

Service functions return a discriminated union:

```ts
type Result<T> =
  | { ok: true; data: T }
  | { ok: false; kind: 'validation'; issues: unknown } // issues = z.treeifyError output
  | { ok: false; kind: 'not_found' }
  | { ok: false; kind: 'unauthorized' }
  | { ok: false; kind: 'invalid_id' };
```

Rationale: validation failures, auth failures, and "not found / not owned" are **expected** outcomes, not exceptional ones — the same reasoning behind using `safeParse` over `parse`. Returning them as values lets actions feed them straight into `useActionState` and lets route handlers map them to status codes, with one consistent contract across both entry points. In production, Next.js also redacts thrown error messages sent to the client, so `throw new Error('Invalid input')` would not reliably surface useful detail anyway.

Reserve `throw` for **genuinely unexpected** failures (a violated invariant, an unreachable branch, a DB connection error) and let those bubble to the framework error boundary.

---

## Security requirements

Every operation must satisfy all three of the following before touching the database. The table shows where each lives now that logic is centralized:

1. **Authentication** — resolved in the **adapter** (`getOrCreateDbUser()`). If it returns `null`, the adapter returns `401` (route handler) or an `{ ok: false, error: 'Unauthorized' }` result (action); it does not call into the service.
2. **Input validation** — in the **service** (`safeParse` against the relevant schema from `validation.ts`). Reject invalid input as `{ ok: false }`. Never use raw `FormData.get(...)` or request-body values directly in DB queries.
3. **Ownership enforcement** — in the **service**, always include `eq(<table>.user_id, user.id)` in the `WHERE` clause of any `UPDATE`, `DELETE`, or owned `SELECT`. A missing ownership check silently allows cross-user data access (IDOR).

Bare UUID params (route segment `[id]` or an action argument `id: string`) must be validated with `uuidSchema` before use, even though ownership enforcement would ultimately reject a bad value — validation gives a clean, predictable failure rather than a DB error, and a well-formed UUID belonging to another user is still rejected by step 3, not step 2.

---

## Route handlers vs. Server Actions

These two mechanisms are parallel entry points, not alternatives. Both are thin adapters over the same service function.

|                              | Route handler (`app/api/.../route.ts`)                    | Server Action (`app/<feature>/actions.ts`)       |
| ---------------------------- | --------------------------------------------------------- | ------------------------------------------------ |
| Called by                    | Any HTTP client (future mobile app, scripts, curl)        | Client Components in this app                    |
| Auth resolution              | Cookie session today; token-based for mobile (see caveat) | `getOrCreateDbUser()` (cookie session)           |
| Core logic                   | Delegates to `app/lib/<feature>.ts`                       | Delegates to the **same** `app/lib/<feature>.ts` |
| Input validation + ownership | In the service (shared)                                   | In the service (shared)                          |
| After success                | Return row in `Response.json(...)` with status            | `revalidatePath(...)`, then return result        |
| Failure shape                | HTTP status + JSON error body                             | `{ ok: false, ... }` result for `useActionState` |

If a route handler and a Server Action do the same thing, they import the same schema **and call the same service function**. Sharing only the schema is not enough — duplicated orchestration drifts.

---

## Frontend: server-first, service layer is the only data source

The same rule that governs the backend governs the UI: **components are adapters too, not a second home for logic.** A Server Component that reads data and a Server Action that mutates it are both thin entry points over `app/lib/<feature>.ts` — they resolve auth, call the service, and render or return the result. Client Components never touch the database, auth, or the service layer directly; they receive data as props and trigger mutations through actions.

### Default to Server Components; push `'use client'` to the leaves

- Every component is a Server Component unless it needs interactivity (state, effects, event handlers, browser APIs). Then, and only then, add `'use client'`.
- Add the directive as far down the tree as possible. A mostly-static page with one interactive widget keeps the page server-rendered and marks only the widget. Marking a whole page `'use client'` to fix one button is the frontend equivalent of putting logic in the adapter — it works, and it quietly costs you.
- A Client Component must never import from `app/lib/*`, `app/db/*`, or call `auth()` / `getOrCreateDbUser()`. If a client file needs server data, it gets it from a Server Component parent (props) or from a Server Action (return value). This is what keeps secrets and DB access on the server.

### Reading data: a Server Component is the third adapter

Reads have the same shape as the other two entry points. A Server Component that needs owned data resolves the user via `getOrCreateDbUser()` and calls a service read function (`listLanguages(user)`, `getLanguage(user, id)`) — it does **not** query the DB inline. The `Result` contract applies here too: on `{ ok: false }` render the empty/error state; on `{ ok: true }` render `data`.

> Note: this is why data fetching happens on the server by default — the service layer, auth resolution, and the DB connection all live server-side, and a Server Component runs there. Fetching the same data in a Client Component would mean exposing one of those, which the architecture forbids.

### Mutations from the client: `useActionState` → Server Action → service

The form flow is fixed:

1. A Client Component form calls a Server Action via `useActionState`.
2. The action resolves auth, calls the service, `revalidatePath(...)`, and returns the `Result` (see _Route handlers vs. Server Actions_).
3. The component renders from that `Result`: show `error` as a message, and use `issues` (the `z.treeifyError` output) to place field-level errors next to the right inputs.

Never throw from an action to signal a validation or ownership failure — the client reads the result as a value, exactly as the result shape intends.

### Validation lives once — reuse the schema on the client

Client-side validation is **UX, not enforcement**: it gives fast feedback before a round-trip. The server stays the source of truth (the service `safeParse`s regardless). So do not write a second, hand-rolled set of client checks — import the same `create<Entity>InputSchema` / `update<Entity>InputSchema` from `app/db/validation.ts` and validate against it in the form. One schema, two consumers. This is how "validation on both sides" is satisfied without two definitions that can drift apart.

### Loading and error UI

- `loading.tsx` (or a `<Suspense>` boundary) for every route that fetches on the server, so a slow query shows a skeleton, not a blank screen.
- `error.tsx` is a Client Component (`'use client'`) and **is the framework error boundary referenced in the Result shape** — it is where genuinely-unexpected throws land. Expected failures never reach it; they come back as `{ ok: false }`.
- `not-found.tsx` for the not-found path, consistent with returning 404 when a row is absent or not owned.

### Styling: Tailwind (locked — same spirit as the stack)

Tailwind ships with `create-next-app` by default; switching to anything else now is the switching-cost tax. So it is locked, like the stack.

> The one rule that matters here is the same rule as everywhere else in this project: **learn each utility class you use; do not paste an opaque class string you can't read back.** A wall of `flex items-center gap-2 rounded-md …` copied without understanding is the styling version of committing a line you can't explain. Look the unfamiliar ones up as you go — the vocabulary is small and finite.

### Accessibility baseline (not gold-plating)

This is the difference between "works on my machine" and "a stranger trusts it" — the Phase 2 bar:

- Every input has an associated `<label>`; every button is a real `<button>`.
- The whole app is operable by keyboard, and focus is always visible.
- Use semantic elements (`<nav>`, `<main>`, ordered headings) over `<div>` soup.
- Images carry meaningful `alt` text.

### Not yet, but on the radar (frontend)

Intentionally out of scope now — listed so they aren't forgotten:

- Optimistic UI (`useOptimistic`) for mutations where the round-trip feels slow.
- A small set of shared UI primitives (button, input, card) — only once duplication starts to hurt.
- Design tokens / theming — only if the app grows enough surfaces to need consistency enforced.

---

## Documentation

- All exported functions (route handlers, Server Actions, service functions, helpers, schemas) must have a JSDoc comment.
- JSDoc should document **what is intentionally absent or non-obvious** — e.g. why `user_id` is not in an input schema, why `getOrCreateDbUser` writes, why an ownership check is structured a certain way.
- Do not document what the code already says clearly. `// insert the language` above a `db.insert(languages)` call adds no value.
- Inline comments are for invariants, constraints, and surprises — not narration.

---

## Not yet, but on the radar

Intentionally out of scope at the current stage — listed so they aren't forgotten, not so they are done now:

- **Rate limiting** on sensitive operations (sign-up, anything expensive) once the app is public-facing.
- **DB transactions** for any mutation that touches more than one table, so partial writes can't leave inconsistent state.
- **Token-based auth resolver** for route handlers, added when (and only when) a mobile client becomes real.
