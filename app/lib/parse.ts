import type { z } from 'zod';
import { uuidSchema } from '../db/validation';
import { invalidId, validationIssues, type Result } from './result';

type ParseResult<S extends z.ZodType> =
  | { ok: true; data: z.infer<S> }
  | Extract<Result<never>, { kind: 'validation' }>;

/**
 * Validates a bare UUID param (route segment or action argument).
 * Returns a `Result`-compatible failure so callers can early-return it directly:
 * `const id = parseUuid(rawId); if (!id.ok) return id;`
 */
export function parseUuid(
  raw: unknown,
): { ok: true; data: string } | Extract<Result<never>, { kind: 'invalid_id' }> {
  const parsed = uuidSchema.safeParse(raw);
  if (!parsed.success) return invalidId();
  return { ok: true, data: parsed.data };
}

/**
 * Runs `safeParse` against `schema` and returns a `Result`-compatible failure
 * on rejection, same early-return shape as {@link parseUuid}.
 */
export function parseInput<S extends z.ZodType>(
  schema: S,
  raw: unknown,
): ParseResult<S> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return validationIssues(parsed.error);
  return { ok: true, data: parsed.data };
}
