---
name: verify
description: Verify a change to this app actually works — static checks, unit tests, then drive the affected flow in the dev server. Use before committing any nontrivial change.
---

# Verifying a change

Work through the cheapest layer that can catch the problem first, but don't stop before the layer that actually exercises the change.

## 1. Static + unit (always)

```
npm run lint
npm run build        # strictest whole-project type check; catches adapter/service signature drift
npm run test:run     # vitest, single pass — pure domain logic in app/lib/__tests__/
```

`npm test` is watch mode — never use it from an agent.

## 2. Runtime — dev server

```
npm run dev
```

Serves at http://localhost:3000. Requires `.env` with `DATABASE_URL` (Neon dev DB) and Clerk keys. Run it in the background and watch the console — server-side throws and unhandled promise rejections show up there, not in the browser.

### The auth wall

Everything meaningful sits behind Clerk. What you can verify **without** a session:

- Unauthenticated API requests return `401`: `curl -i http://localhost:3000/api/languages`
- Pages redirect to sign-in rather than erroring.

Full UI verification requires a signed-in browser session. Options, in order of preference:

1. **Sign in as the test account.** A dedicated Clerk dev-instance test user exists; its credentials are in `.env` as `CLERK_TEST_USER_EMAIL` / `CLERK_TEST_USER_PASSWORD` (never hardcode them elsewhere). Drive the sign-in form at http://localhost:3000 with that email + password. The instance has device verification enabled, so a fresh browser/client gets an email-code challenge **after** the password step; the email uses Clerk's `+clerk_test` convention, so the code is always the fixed test value `424242` — no real email is sent. Rows this account creates live in the real dev DB: clean up whatever the verification created.
   - `.env` values are double-quoted (`CLERK_TEST_USER_EMAIL="..."`). `dotenv/config` strips the quotes automatically; hand-parsing the file (e.g. `grep`/`cut` in a shell script) will not, and the literal quotes typed into a form field fail Clerk's email-format validation silently. Load `.env` through `dotenv`, not shell text-munging.
   - `SignInButton` renders as a `<button>` that opens Clerk's modal by default, not a link.
2. **Ask the user to click through the affected flow** — fallback if the test session can't be established (e.g. Clerk auth options changed).

### Service-layer verification (bypasses the auth wall)

For changes whose interesting behavior is in `app/lib/<feature>.ts`, exercise the service directly with a scratch script — services take an already-resolved user, so no Clerk session is needed:

```ts
// scratch.ts — run with: npx tsx scratch.ts
import 'dotenv/config';
import { db } from './app/db';
import { users } from './app/db/schema';
import { createLanguageSvc, deleteLanguageSvc } from './app/lib/languages';

async function main() {
  const user = (await db.select().from(users).limit(1))[0];
  const created = await createLanguageSvc(user, { name: 'verify-scratch' });
  console.log(created);
  if (created.ok) console.log(await deleteLanguageSvc(user, created.data.id));
}
main(); // no top-level await: this package is CJS (no "type": "module")
```

This runs against the real dev DB — create throwaway rows and delete them in the same script. Keep scratch scripts out of the repo (scratchpad dir, not the project).

### Screenshot-based UI verification

`playwright` is a devDependency (Chromium binary installed via `npx playwright install chromium`, one-time per machine). For visual changes (theming, layout, CSS), drive the flow and capture screenshots rather than only checking DOM/status:

```ts
// screenshot.mjs — run with: node screenshot.mjs (run from the project root; playwright resolves from its node_modules)
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await page.screenshot({ path: '/path/in/scratchpad/shot.png' });
await browser.close();
```

For an authenticated flow, drive the Clerk sign-in form first (see the test-account credentials and `.env`-quoting note above) — `SignInButton` opens a modal by default, so `getByRole('button', { name: 'Sign in' })`, not a link. Read the resulting PNG back with the Read tool — a screenshot that's never looked at isn't verification. Save scripts to the scratchpad dir, not the project.

## 3. What "verified" means

State what you exercised and what you observed (status codes, rendered output, returned `Result`s). A change to an adapter or page is not verified by unit tests alone — those only cover pure domain logic. If you could not drive the flow (auth wall, no test account), say so explicitly rather than implying it works.
