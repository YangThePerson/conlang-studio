import { and, count, desc, eq, max } from 'drizzle-orm';
import { db } from '@/app/db';
import {
  languages,
  lexemes,
  phoneme_groups,
  phonemes,
  rules,
  senses,
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

/** A newly added dictionary entry shown in the Overview page's recent-words list. */
export type RecentLexeme = {
  id: string;
  term: string;
  created_at: Date;
};

/**
 * Data for the Overview page: row counts for the stat cards (one per child
 * table of a language), the most recent activity timestamp, and the newest
 * dictionary entries.
 */
export type LanguageOverview = {
  phonemeCount: number;
  groupCount: number;
  syllableStructureCount: number;
  ruleCount: number;
  lexemeCount: number;
  tagCount: number;
  /**
   * Latest `updated_at` across the language row, its counted child tables, and
   * senses (definition edits are routine dictionary work, so they count as
   * activity even though senses have no stat card). Join-table changes
   * (group membership, lexeme tagging) and deletions intentionally don't bump
   * this — a deleted row leaves no timestamp behind.
   */
  lastActivityAt: Date;
  /** The newest lexemes by `created_at`, capped at {@link RECENT_LEXEME_LIMIT}. */
  recentLexemes: RecentLexeme[];
};

/** How many newest words the Overview's recent-words list shows. */
const RECENT_LEXEME_LIMIT = 5;

/**
 * Returns all languages owned by the given user.
 */
export async function listLanguagesSvc(user: DbUser): Promise<Language[]> {
  return db.select().from(languages).where(eq(languages.user_id, user.id));
}

/**
 * Returns the Overview page's data: per-child-table row counts, the language's
 * last-activity timestamp, and its newest dictionary entries. Uses `count(*)` /
 * `max(updated_at)` aggregates per table rather than the existing `list*Svc`
 * functions, which return full rows (JSONB templates, joined senses/tags) —
 * wasteful when only counts and timestamps are needed.
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
    [phonemeAgg],
    [groupAgg],
    [syllableStructureAgg],
    [ruleAgg],
    [lexemeAgg],
    [tagAgg],
    [senseAgg],
    recentLexemes,
  ] = await Promise.all([
    db.select({ value: count(), latest: max(phonemes.updated_at) }).from(phonemes).where(eq(phonemes.language_id, languageId)),
    db.select({ value: count(), latest: max(phoneme_groups.updated_at) }).from(phoneme_groups).where(eq(phoneme_groups.language_id, languageId)),
    db.select({ value: count(), latest: max(syllable_structures.updated_at) }).from(syllable_structures).where(eq(syllable_structures.language_id, languageId)),
    db.select({ value: count(), latest: max(rules.updated_at) }).from(rules).where(eq(rules.language_id, languageId)),
    db.select({ value: count(), latest: max(lexemes.updated_at) }).from(lexemes).where(eq(lexemes.language_id, languageId)),
    db.select({ value: count(), latest: max(tags.updated_at) }).from(tags).where(eq(tags.language_id, languageId)),
    // Senses have no stat card, but definition edits are dictionary activity;
    // scoped to the language through their parent lexeme.
    db
      .select({ value: count(), latest: max(senses.updated_at) })
      .from(senses)
      .innerJoin(lexemes, eq(senses.lexeme_id, lexemes.id))
      .where(eq(lexemes.language_id, languageId)),
    db
      .select({ id: lexemes.id, term: lexemes.term, created_at: lexemes.created_at })
      .from(lexemes)
      .where(eq(lexemes.language_id, languageId))
      .orderBy(desc(lexemes.created_at))
      .limit(RECENT_LEXEME_LIMIT),
  ]);

  // The language row's own updated_at (bumped by renames) is the floor, so
  // lastActivityAt is always defined even with no child rows.
  const lastActivityAt = [
    phonemeAgg.latest,
    groupAgg.latest,
    syllableStructureAgg.latest,
    ruleAgg.latest,
    lexemeAgg.latest,
    tagAgg.latest,
    senseAgg.latest,
  ].reduce<Date>(
    (latest, candidate) => (candidate && candidate > latest ? candidate : latest),
    lang.data.updated_at,
  );

  return {
    ok: true,
    data: {
      phonemeCount: phonemeAgg.value,
      groupCount: groupAgg.value,
      syllableStructureCount: syllableStructureAgg.value,
      ruleCount: ruleAgg.value,
      lexemeCount: lexemeAgg.value,
      tagCount: tagAgg.value,
      lastActivityAt,
      recentLexemes,
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
