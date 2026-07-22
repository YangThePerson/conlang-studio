---
name: doc-sync
description: Check whether the change just made drifted README.md or CLAUDE.md out of sync with the codebase, and fix whichever sections drifted. Use at the end of any nontrivial change, alongside `verify`, before committing — new npm scripts, new architectural patterns/exceptions, new shared primitives, new test tooling, new dependencies, or a doc claim the change just made false all need a docs update; routine CRUD following an existing documented pattern, bug fixes, and copy tweaks usually don't.
---

# Keeping README.md and CLAUDE.md in sync

Stale docs mislead the next session exactly as badly as they mislead a human — CLAUDE.md is loaded into context on every session and treated as ground truth. A doc that describes last month's architecture instead of today's causes wrong assumptions, not just an unhelpful README. Treat a drifted doc as a bug, not cleanup.

## The judgment call: does this change need a doc update?

DEVLOG.md already has a rule for exactly this distinction, written for semver but just as good here — reuse it instead of inventing a second rulebook:

- **PATCH-shaped** (copy/UI tweak, bug fix, refactor, no schema change, no new Svc function) → almost never touches the docs.
- **MINOR-shaped** (new Svc function/route/table, a new capability, existing behavior widened in a way that doesn't break callers) → almost always touches the docs somewhere.
- **MAJOR-shaped** (breaking change to data or usage) → touches the docs and probably deserves more than a one-line edit.

If you're unsure which bucket a change falls into, that uncertainty is itself the signal to check — skim the map below rather than guessing.

Concretely, check `git diff` (or what you just built this session) against these skip/check lists:

**Usually no doc update needed:**
- A new entity vertical that follows `add-entity` exactly (new table/service/adapters/UI for a resource shaped like existing ones) — the docs describe the *pattern*, not every instance of it.
- Bug fixes, refactors, renames that don't change a convention.
- New unit tests for existing pure logic.
- Wording/copy/styling tweaks that don't introduce a new token or pattern.

**Check the docs:**
- A new or renamed `package.json` script.
- A new dependency that belongs in README's Tech stack, or a new env var.
- A new architectural pattern or a deliberate *exception* to one already documented — anything like the `is_public`/anonymous-visitor carve-out: a case where "every operation enforces ownership" or "Server Components read via a service" stops being universally true.
- A new shared helper in `app/lib/result.ts`, `parse.ts`, `ownership.ts`, or `http.ts`, or a new `Result` `kind`.
- A new shared UI primitive in `app/components/ui/` or `app/components/`.
- A new test layer or tool (e.g. adding Playwright was a real instance of this — it sat undocumented for a while).
- Anything that makes an existing sentence in either doc **factually wrong** (not just incomplete) — these are worse than omissions and take priority.
- An item in CLAUDE.md's "Not yet, but on the radar" section that this change just implemented — remove or reword it. A stale "not yet" item that contradicts a section earlier in the same file (this has happened before: shared UI primitives were documented as built in one section and still listed as future work in another) is exactly the kind of drift this skill exists to catch.

## Where a given signal belongs

| Signal | Update |
|---|---|
| New/renamed npm script | README Commands table **and** CLAUDE.md `## Commands` |
| New env var | README's `.env` block in Getting started |
| New dependency worth naming | README Tech stack |
| New architectural pattern or exception to one already stated | CLAUDE.md — the section whose claim it changes (often Security requirements or Architecture), plus the specific helper-module bullet if a new function is involved |
| New shared UI primitive/component | CLAUDE.md Frontend section, "Shared primitives" bullet |
| New test tooling/layer | CLAUDE.md Testing section **and** README Tech stack/Commands |
| New `Result` kind or `STATUS_BY_KIND` entry | CLAUDE.md "Result shape" section |
| User-visible new feature | README Features list |
| A "Not yet" item got implemented | Remove/reword that CLAUDE.md bullet — don't leave it stale |

If a signal touches a doc section not listed here, use judgment about which existing heading it belongs under rather than inventing a new one — both docs are organized by topic, not by chronology.

## Applying the fix

- Match the existing tone exactly: terse, technical, no marketing language, comments explain *why* not *what*. Both docs are dense on purpose — read the surrounding paragraph before adding to it and write in the same register.
- Edit the specific section; don't rewrite the file or restructure headings to fit one change.
- After editing, re-read the touched section for internal consistency: does a Commands table match `package.json` exactly? Does removing a "Not yet" bullet leave any other section still describing that thing as future work? A previous pass through this exact file pair found precisely this kind of self-contradiction — it's the most common failure mode of editing docs incrementally instead of from a full re-read.
- Prefer a small number of precise edits over one edit that touches everything "while you're in there."

## Reporting

State plainly what you changed and why, in one or two lines — e.g. "Added `test:e2e` to both Commands sections and documented the Playwright suite in CLAUDE.md's Testing section (new test layer, previously undocumented)." If you checked and found no drift, say so explicitly ("no doc drift from this change") rather than staying silent — silence is indistinguishable from forgetting to check.
