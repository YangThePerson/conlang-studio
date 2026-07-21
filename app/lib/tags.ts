import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db';
import { lexeme_tags, lexemes, tags, users } from '../db/schema';
import {
  createLexemeTagSchema,
  createTagInputSchema,
  updateTagInputSchema,
} from '../db/validation';
import { notFound, validationMessage, type Result } from './result';
import { parseUuid, parseInput } from './parse';
import {
  isUniqueViolation,
  ownedLanguageIds,
  parseAndRequireOwnedLanguage,
  parseAndRequireVisibleLanguage,
} from './ownership';

type Tag = typeof tags.$inferSelect;
type LexemeTag = typeof lexeme_tags.$inferSelect;
type DbUser = typeof users.$inferSelect;

/** `{ ok: false, kind: 'validation' }` for the one field a tag's name can collide on. */
function duplicateTagNameResult() {
  return validationMessage({
    properties: {
      name: {
        errors: ['A tag with this name already exists for this language.'],
      },
    },
  });
}

/**
 * Returns all tags for a language, name-sorted, verifying that the language
 * is owned by `user` or is public (`user` may be `null` for an anonymous
 * visitor). Used for the tag manager panel and the per-lexeme attach picker —
 * the dictionary read (`getDictionarySvc`) only returns tags already attached
 * to a lexeme, not the full language inventory.
 */
export async function listTagsSvc(
  user: DbUser | null,
  rawLanguageId: unknown,
): Promise<Result<Tag[]>> {
  const lang = await parseAndRequireVisibleLanguage(user, rawLanguageId);
  if (!lang.ok) return lang;

  const rows = await db
    .select()
    .from(tags)
    .where(eq(tags.language_id, lang.data.id))
    .orderBy(tags.name);

  return { ok: true, data: rows };
}

/**
 * Creates a new tag for a language owned by `user`.
 * Returns `{ ok: false, kind: 'validation' }` if a tag with the same name already exists in the language.
 */
export async function createTagSvc(
  user: DbUser,
  rawLanguageId: unknown,
  rawInput: unknown,
): Promise<Result<Tag>> {
  const lang = await parseAndRequireOwnedLanguage(user, rawLanguageId);
  if (!lang.ok) return lang;

  const input = parseInput(createTagInputSchema, rawInput);
  if (!input.ok) return input;

  try {
    const [created] = await db
      .insert(tags)
      .values({ language_id: lang.data.id, name: input.data.name })
      .returning();

    return { ok: true, data: created };
  } catch (error: unknown) {
    if (isUniqueViolation(error)) return duplicateTagNameResult();
    throw error;
  }
}

/**
 * Renames a tag, enforcing ownership via the owned-languages subquery inside
 * the UPDATE's WHERE. A tag's `language_id` is never updatable.
 * Returns `{ ok: false, kind: 'validation' }` if a tag with the new name already exists in the language.
 */
export async function updateTagSvc(
  user: DbUser,
  rawTagId: unknown,
  rawInput: unknown,
): Promise<Result<Tag>> {
  const id = parseUuid(rawTagId);
  if (!id.ok) return id;

  const input = parseInput(updateTagInputSchema, rawInput);
  if (!input.ok) return input;

  try {
    const [updated] = await db
      .update(tags)
      .set(input.data)
      .where(
        and(eq(tags.id, id.data), inArray(tags.language_id, ownedLanguageIds(user))),
      )
      .returning();

    if (!updated) return notFound();
    return { ok: true, data: updated };
  } catch (error: unknown) {
    if (isUniqueViolation(error)) return duplicateTagNameResult();
    throw error;
  }
}

/**
 * Deletes a tag, with the same ownership enforcement as `updateTagSvc`.
 * Unlike phoneme groups (which block deletion while referenced by a syllable
 * template), a tag still attached to lexemes is deletable without a
 * `conflict` check — its `lexeme_tags` rows simply cascade away, matching the
 * intuitive "untag everything and remove the label" behavior for a tag.
 */
export async function deleteTagSvc(
  user: DbUser,
  rawId: unknown,
): Promise<Result<Tag>> {
  const id = parseUuid(rawId);
  if (!id.ok) return id;

  const [deleted] = await db
    .delete(tags)
    .where(
      and(eq(tags.id, id.data), inArray(tags.language_id, ownedLanguageIds(user))),
    )
    .returning();

  if (!deleted) return notFound();
  return { ok: true, data: deleted };
}

/**
 * Attaches a tag to a lexeme.
 * `rawLanguageId` is required to verify that both the lexeme and the tag belong to the
 * same user-owned language — neither table carries a direct `user_id`.
 * Returns `{ ok: false, kind: 'not_found' }` if the language, lexeme, or tag doesn't exist or belongs to another user.
 * Returns `{ ok: false, kind: 'validation' }` if the lexeme is already tagged with it.
 */
export async function attachTagToLexemeSvc(
  user: DbUser,
  rawLanguageId: unknown,
  rawLexemeId: unknown,
  rawTagId: unknown,
): Promise<Result<LexemeTag>> {
  const lang = await parseAndRequireOwnedLanguage(user, rawLanguageId);
  if (!lang.ok) return lang;

  const input = parseInput(createLexemeTagSchema, {
    lexeme_id: rawLexemeId,
    tag_id: rawTagId,
  });
  if (!input.ok) return input;

  const [lexeme, tag] = await Promise.all([
    db.query.lexemes.findFirst({
      where: and(
        eq(lexemes.id, input.data.lexeme_id),
        eq(lexemes.language_id, lang.data.id),
      ),
    }),
    db.query.tags.findFirst({
      where: and(eq(tags.id, input.data.tag_id), eq(tags.language_id, lang.data.id)),
    }),
  ]);
  if (!lexeme || !tag) return notFound();

  try {
    const [created] = await db.insert(lexeme_tags).values(input.data).returning();

    return { ok: true, data: created };
  } catch (error: unknown) {
    if (isUniqueViolation(error))
      return validationMessage({ errors: ['This word is already tagged with it.'] });
    throw error;
  }
}

/**
 * Detaches a tag from a lexeme, with the same ownership verification as
 * `attachTagToLexemeSvc`.
 * Returns `{ ok: false, kind: 'not_found' }` if the language, lexeme, or tag doesn't exist or belongs to another user, or if the tag wasn't attached.
 */
export async function detachTagFromLexemeSvc(
  user: DbUser,
  rawLanguageId: unknown,
  rawLexemeId: unknown,
  rawTagId: unknown,
): Promise<Result<LexemeTag>> {
  const lang = await parseAndRequireOwnedLanguage(user, rawLanguageId);
  if (!lang.ok) return lang;

  const input = parseInput(createLexemeTagSchema, {
    lexeme_id: rawLexemeId,
    tag_id: rawTagId,
  });
  if (!input.ok) return input;

  const [lexeme, tag] = await Promise.all([
    db.query.lexemes.findFirst({
      where: and(
        eq(lexemes.id, input.data.lexeme_id),
        eq(lexemes.language_id, lang.data.id),
      ),
    }),
    db.query.tags.findFirst({
      where: and(eq(tags.id, input.data.tag_id), eq(tags.language_id, lang.data.id)),
    }),
  ]);
  if (!lexeme || !tag) return notFound();

  const [deleted] = await db
    .delete(lexeme_tags)
    .where(
      and(
        eq(lexeme_tags.lexeme_id, input.data.lexeme_id),
        eq(lexeme_tags.tag_id, input.data.tag_id),
      ),
    )
    .returning();

  if (!deleted) return notFound();
  return { ok: true, data: deleted };
}
