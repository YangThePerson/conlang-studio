import { z } from 'zod';

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; kind: 'validation'; issues: unknown }
  | { ok: false; kind: 'not_found' }
  | { ok: false; kind: 'unauthorized' }
  | { ok: false; kind: 'invalid_id' }
  | { ok: false; kind: 'conflict' };

/** `{ ok: false, kind: 'invalid_id' }` — a bare UUID param failed `uuidSchema`. */
export function invalidId(): Extract<Result<never>, { kind: 'invalid_id' }> {
  return { ok: false, kind: 'invalid_id' };
}

/** `{ ok: false, kind: 'not_found' }` — row absent, or present but not owned by the caller. */
export function notFound(): Extract<Result<never>, { kind: 'not_found' }> {
  return { ok: false, kind: 'not_found' };
}

/** `{ ok: false, kind: 'conflict' }` — the row exists but can't be mutated in its current state (e.g. still referenced elsewhere). */
export function conflict(): Extract<Result<never>, { kind: 'conflict' }> {
  return { ok: false, kind: 'conflict' };
}

/** Wraps a Zod `safeParse` failure's `error` as a `{ kind: 'validation' }` result via `z.treeifyError`. */
export function validationIssues(
  error: z.ZodError,
): Extract<Result<never>, { kind: 'validation' }> {
  return { ok: false, kind: 'validation', issues: z.treeifyError(error) };
}

/** `{ ok: false, kind: 'validation' }` with a hand-written message, for checks that aren't Zod-shaped (e.g. a DB uniqueness conflict or a cross-field business rule). */
export function validationMessage(
  issues: unknown,
): Extract<Result<never>, { kind: 'validation' }> {
  return { ok: false, kind: 'validation', issues };
}
