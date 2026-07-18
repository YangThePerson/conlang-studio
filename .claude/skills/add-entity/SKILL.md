---
name: add-entity
description: Add a new owned entity or feature vertical (table → validation → service → action/route adapters → UI), or add a new operation to an existing feature. Use whenever creating a new resource scoped under a language or user, e.g. "add rules CRUD", "add tags to the dictionary".
---

# Adding an entity vertical

Every feature in this app is the same vertical, repeated. Follow the steps in order; each names a reference implementation to imitate. **Phonemes** is the simplest complete vertical; **phoneme-groups** shows the extras (join table, `conflict`, unique-violation handling).

Re-read the Architecture, Security, and Result-shape sections of CLAUDE.md first — this skill is the ordering and file map; CLAUDE.md is the rules.

## 1. Table — `app/db/schema.ts`

- snake_case table and column names; `uuid('id').defaultRandom().primaryKey()`.
- Scope to the language: `language_id` referencing `languages.id` with `onDelete: 'cascade'`. (Only `languages` itself carries `user_id`.)
- Real invariants are DB constraints: `unique().on(t.language_id, t.name)`, `check(...)` — see `rules` and `lexemes` for `check` examples.
- Structured `jsonb` payloads get their Zod shape + TS type in `app/db/json-shapes.ts`, wired with `.$type<Shape>()` — see `syllable_structures.template`.
- **Add `relations(...)` entries** for the new table and everything it references. `db.query.<table>.findMany({ with: ... })` silently has no relations without them.

## 2. Generate and apply a migration

```
npm run db:generate
npm run db:migrate
```

## 3. Schemas — `app/db/validation.ts`

- `create<Entity>InputSchema` / `update<Entity>InputSchema`: client-supplied fields **only**. JSDoc what's intentionally absent and why (`user_id`, `language_id` come from session/route, never the client).
- Bare IDs don't need new schemas — services use `parseUuid` (which wraps the shared `uuidSchema`).

## 4. Service — `app/lib/<feature>.ts`

One `<verb><Entity>Svc` function per operation. Reference: `app/lib/phonemes.ts`.

- Preamble: `parseAndRequireOwnedLanguage(user, rawLanguageId)` when you have a language id; for operations keyed only by the entity's own id, filter with `inArray(<table>.language_id, ownedLanguageIds(user))` so ownership stays inside the single statement (see `updatePhonemeSvc`).
- Input: `parseInput(schema, raw)`; early-return the failure.
- Unique-constraint inserts: `try/catch` + `isUniqueViolation(err)` → `validationMessage(...)` with a field-shaped message (see `createPhonemeGroupSvc`); rethrow anything else.
- Row still referenced elsewhere → `conflict()` (see `deletePhonemeSvc` checking syllable templates).
- Framework-agnostic: no `revalidatePath`, no `Response`, no `auth()`.

## 5. Server Actions — `app/languages/[id]/<feature>/actions.ts`

Reference: `app/languages/actions.ts`.

- `'use server'`; `getOrCreateDbUser()` → `{ ok: false, kind: 'unauthorized' }` on null.
- Call the Svc; on `result.ok`, `revalidatePath(...)` for every affected path; return the `Result`.
- Signatures for `useActionState`: `(prevState, formData)` last; bind-able ids first.

## 6. Route handlers — `app/api/languages/[id]/<feature>/route.ts` (+ `[entityId]/route.ts`)

Reference: `app/api/languages/[id]/phonemes/[phonemeId]/route.ts`. Call the **same** Svc functions. `await params`. The Result → HTTP mapping is `resultResponse` from `app/lib/http.ts` — never hand-roll it:

```ts
const result = await update<Entity>Svc(user, entityId, body);
return resultResponse(result); // 200; pass 201 for creates, 204 for deletes
```

`401` for unauthenticated stays in the handler (before calling the service). If the success body isn't the raw `result.data`, use `errorResponse(result)` for the failure branch and build the success response yourself (see the generate route).

## 7. UI — `app/languages/[id]/<feature>/`

- `page.tsx` (Server Component): `getOrCreateDbUser()` → service read → render `Result` (empty/error state on `ok: false`). Reference: the phonemes page.
- Interactive pieces are `'use client'` leaf components taking data as props and mutating via `useActionState` → action. Reference: `phoneme-list.tsx`.
- `loading.tsx` for the route.
- Client-side validation reuses the input schema from `validation.ts` (UX only; server re-validates).

## 8. Tests + docs

- New **pure** domain logic (no DB/framework imports) gets a vitest file in `app/lib/__tests__/`; adapters and DB-touching services are not unit-tested.
- JSDoc on every export; run `npm run lint` and `npm run build` before calling it done.
