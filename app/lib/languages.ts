import { and, count, eq } from 'drizzle-orm';
import { db } from '@/app/db';
import {
  languages,
  lexemes,
  phoneme_groups,
  phonemes,
  rules,
  syllable_structures,
  tags,
  users,
} from '@/app/db/schema';
import { createLanguageInputSchema, updateLanguageInputSchema } from '@/app/db/validation';
import { notFound, type Result } from './result';
import { parseUuid, parseInput } from './parse';
import { parseAndRequireOwnedLanguage } from './ownership';

type Language = typeof languages.$inferSelect;
type DbUser = typeof users.$inferSelect;

/** Row counts for the Overview page's stat cards — one per child table of a language. */
export type LanguageOverview = {
  phonemeCount: number;
  groupCount: number;
  syllableStructureCount: number;
  ruleCount: number;
  lexemeCount: number;
  tagCount: number;
};

/**
 * Returns all languages owned by the given user.
 */
export async function listLanguagesSvc(user: DbUser): Promise<Language[]> {
  return db.select().from(languages).where(eq(languages.user_id, user.id));
}

/**
 * Returns row counts across a language's child tables for the Overview page's
 * stat cards. Uses `count(*)` per table rather than the existing `list*Svc`
 * functions, which return full rows (JSONB templates, joined senses/tags) —
 * wasteful when only a length is needed.
 * Returns `{ ok: false, kind: 'not_found' }` if the language doesn't exist or belongs to another user.
 */
export async function getLanguageOverviewSvc(
  user: DbUser,
  rawLanguageId: unknown,
): Promise<Result<LanguageOverview>> {
  const lang = await parseAndRequireOwnedLanguage(user, rawLanguageId);
  if (!lang.ok) return lang;

  const languageId = lang.data.id;
  const [
    [{ value: phonemeCount }],
    [{ value: groupCount }],
    [{ value: syllableStructureCount }],
    [{ value: ruleCount }],
    [{ value: lexemeCount }],
    [{ value: tagCount }],
  ] = await Promise.all([
    db.select({ value: count() }).from(phonemes).where(eq(phonemes.language_id, languageId)),
    db.select({ value: count() }).from(phoneme_groups).where(eq(phoneme_groups.language_id, languageId)),
    db.select({ value: count() }).from(syllable_structures).where(eq(syllable_structures.language_id, languageId)),
    db.select({ value: count() }).from(rules).where(eq(rules.language_id, languageId)),
    db.select({ value: count() }).from(lexemes).where(eq(lexemes.language_id, languageId)),
    db.select({ value: count() }).from(tags).where(eq(tags.language_id, languageId)),
  ]);

  return {
    ok: true,
    data: {
      phonemeCount,
      groupCount,
      syllableStructureCount,
      ruleCount,
      lexemeCount,
      tagCount,
    },
  };
}

/**
 * Creates a new language for the given user from raw client input.
 * `user_id` is injected from `user` — it must not appear in `rawInput`.
 */
export async function createLanguageSvc(
  user: DbUser,
  rawInput: unknown,
): Promise<Result<Language>> {
  const input = parseInput(createLanguageInputSchema, rawInput);
  if (!input.ok) return input;

  const [created] = await db
    .insert(languages)
    .values({ user_id: user.id, name: input.data.name })
    .returning();

  return { ok: true, data: created };
}

/**
 * Updates (renames) a language owned by the given user.
 * Returns `{ ok: false, kind: 'not_found' }` if the language doesn't exist or belongs to another user.
 * `rawId` is the bare UUID from the route segment or action argument — validated here before any DB access.
 */
export async function updateLanguageSvc(
  user: DbUser,
  rawId: unknown,
  rawInput: unknown,
): Promise<Result<Language>> {
  const id = parseUuid(rawId);
  if (!id.ok) return id;

  const input = parseInput(updateLanguageInputSchema, rawInput);
  if (!input.ok) return input;

  const [updated] = await db
    .update(languages)
    .set({ name: input.data.name })
    .where(and(eq(languages.id, id.data), eq(languages.user_id, user.id)))
    .returning();

  if (!updated) return notFound();
  return { ok: true, data: updated };
}

/**
 * Deletes a language owned by the given user and all its cascade-dependent data.
 * Returns `{ ok: false, kind: 'not_found' }` if the language doesn't exist or belongs to another user.
 * `rawId` is the bare UUID from the route segment or action argument — validated here before any DB access.
 */
export async function deleteLanguageSvc(
  user: DbUser,
  rawId: unknown,
): Promise<Result<Language>> {
  const id = parseUuid(rawId);
  if (!id.ok) return id;

  const [deleted] = await db
    .delete(languages)
    .where(and(eq(languages.id, id.data), eq(languages.user_id, user.id)))
    .returning();

  if (!deleted) return notFound();
  return { ok: true, data: deleted };
}
