import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { languages, users } from '../db/schema';
import { parseUuid } from './parse';
import { notFound, type Result } from './result';

type Language = typeof languages.$inferSelect;
type DbUser = typeof users.$inferSelect;

/**
 * Subquery of language ids owned by `user`. Not awaited on its own — composed
 * into a WHERE via `inArray` so ownership enforcement stays inside the single
 * SELECT/UPDATE/DELETE statement rather than a separate read. Used for tables
 * that reference `language_id` but carry no direct `user_id` of their own
 * (phonemes, phoneme_groups, syllable_structures).
 */
export function ownedLanguageIds(user: DbUser) {
  return db
    .select({ id: languages.id })
    .from(languages)
    .where(eq(languages.user_id, user.id));
}

/**
 * Fetches a language row, returning `{ ok: false, kind: 'not_found' }` if it
 * doesn't exist or isn't owned by `user`. Assumes `languageId` is already a
 * validated UUID — see {@link parseAndRequireOwnedLanguage} for the common
 * case of validating the raw route/action value first.
 */
export async function requireOwnedLanguage(
  user: DbUser,
  languageId: string,
): Promise<Result<Language>> {
  const lang = await db.query.languages.findFirst({
    where: and(eq(languages.id, languageId), eq(languages.user_id, user.id)),
  });
  if (!lang) return notFound();
  return { ok: true, data: lang };
}

/**
 * Combines {@link parseUuid} and {@link requireOwnedLanguage} — the
 * preamble repeated at the top of nearly every phoneme/group/syllable/dictionary
 * service function that receives a `rawLanguageId`.
 */
export async function parseAndRequireOwnedLanguage(
  user: DbUser,
  rawLanguageId: unknown,
): Promise<Result<Language>> {
  const id = parseUuid(rawLanguageId);
  if (!id.ok) return id;
  return requireOwnedLanguage(user, id.data);
}

/**
 * Fetches a language row, returning `{ ok: false, kind: 'not_found' }` if it
 * doesn't exist, or exists but is neither public nor owned by `user`. `user`
 * is nullable so anonymous visitors can still reach a public language.
 *
 * Fetches by id alone and branches on `is_public`/`user_id` in JS rather than
 * folding visibility into the WHERE clause, so "doesn't exist" and "exists
 * but private and not yours" trivially resolve to the identical `notFound()`
 * — a stranger probing a private language id can't distinguish the two.
 */
export async function requireVisibleLanguage(
  user: DbUser | null,
  languageId: string,
): Promise<Result<Language>> {
  const lang = await db.query.languages.findFirst({
    where: eq(languages.id, languageId),
  });
  if (!lang) return notFound();
  if (lang.is_public) return { ok: true, data: lang };
  if (user && lang.user_id === user.id) return { ok: true, data: lang };
  return notFound();
}

/**
 * Combines {@link parseUuid} and {@link requireVisibleLanguage} — the
 * preamble for read-only service functions that must serve both an owner
 * and an anonymous/public visitor.
 */
export async function parseAndRequireVisibleLanguage(
  user: DbUser | null,
  rawLanguageId: unknown,
): Promise<Result<Language>> {
  const id = parseUuid(rawLanguageId);
  if (!id.ok) return id;
  return requireVisibleLanguage(user, id.data);
}

/**
 * Structural check for a Postgres unique-constraint violation (`23505`).
 * Narrower than `instanceof Error` because `pg`/postgres-js errors aren't a
 * single class hierarchy — duck-typing the `code` field is the stable check.
 * Recurses into `.cause` because Drizzle wraps the underlying driver error in
 * a `DrizzleQueryError` whose own `code` field is absent — the real Postgres
 * error (and its `code`) lives one level down at `error.cause`.
 */
export function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  if ('code' in error && error.code === '23505') return true;
  return 'cause' in error && isUniqueViolation(error.cause);
}
