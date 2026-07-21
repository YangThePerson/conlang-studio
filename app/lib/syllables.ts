import { users, syllable_structures, phonemes, phoneme_groups } from '@/app/db/schema';
import { notFound, validationMessage, type Result } from './result';
import {
  createSyllableStructureInputSchema,
  updateSyllableStructureInputSchema,
} from '../db/validation';
import type { SyllableTemplate } from '../db/json-shapes';
import { db } from '../db';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { parseUuid, parseInput } from './parse';
import {
  ownedLanguageIds,
  parseAndRequireOwnedLanguage,
  parseAndRequireVisibleLanguage,
} from './ownership';
import { separateTemplateIds } from './wordgen';

type DbUser = typeof users.$inferSelect;
type SyllableStructure = typeof syllable_structures.$inferSelect;

/**
 * Verifies that every phoneme and group ID referenced in `template` exists in `languageId`.
 * Returns `true` if all IDs resolve; `false` if any are missing or belong to a different language.
 * Called before inserting or updating a syllable structure to prevent dangling JSONB references
 * that cannot be enforced by a FK constraint.
 */
async function validateTemplateReferences(
  template: SyllableTemplate,
  languageId: string,
): Promise<boolean> {
  const [phonemeIds, groupIds] = separateTemplateIds([{ template }]);

  const [foundPhonemes, foundGroups] = await Promise.all([
    phonemeIds.size
      ? db
          .select({ id: phonemes.id })
          .from(phonemes)
          .where(
            and(
              inArray(phonemes.id, [...phonemeIds]),
              eq(phonemes.language_id, languageId),
            ),
          )
      : ([] as { id: string }[]),
    groupIds.size
      ? db
          .select({ id: phoneme_groups.id })
          .from(phoneme_groups)
          .where(
            and(
              inArray(phoneme_groups.id, [...groupIds]),
              eq(phoneme_groups.language_id, languageId),
            ),
          )
      : ([] as { id: string }[]),
  ]);

  return (
    foundPhonemes.length === phonemeIds.size &&
    foundGroups.length === groupIds.size
  );
}

/**
 * Checks whether any syllable structure template in `languageId` still references
 * `id` under the given JSONB key (`'phonemeId'` for a phoneme, `'groupId'` for a
 * phoneme group). Shared by `deletePhonemeSvc` and `deletePhonemeGroupSvc` — both
 * must block deletion while a template still points at the row, since the
 * reference lives in JSONB and can't be enforced by a FK constraint.
 */
export async function isReferencedInSyllableTemplates(
  languageId: string,
  key: 'phonemeId' | 'groupId',
  id: string,
): Promise<boolean> {
  const { rows } = await db.execute(
    sql`SELECT EXISTS (
      SELECT 1
      FROM syllable_structures, jsonb_array_elements(template) AS slot
      WHERE syllable_structures.language_id = ${languageId}
      AND slot->>${key} = ${id}
    ) AS referenced`,
  );
  return Boolean(rows[0].referenced);
}

/**
 * Returns all syllable structures for a language, verifying that the language
 * is owned by `user` or is public (`user` may be `null` for an anonymous visitor).
 * Returns `{ ok: false, kind: 'not_found' }` if the language doesn't exist or is neither public nor owned by `user`.
 */
export async function listSyllableStructuresSvc(
  user: DbUser | null,
  rawLanguageId: unknown,
): Promise<Result<SyllableStructure[]>> {
  const lang = await parseAndRequireVisibleLanguage(user, rawLanguageId);
  if (!lang.ok) return lang;

  const rows = await db
    .select()
    .from(syllable_structures)
    .where(eq(syllable_structures.language_id, lang.data.id));

  return { ok: true, data: rows };
}

/**
 * Creates a new syllable structure for a language owned by `user`.
 * `language_id` comes from the route, not client input — ownership is verified before insert.
 * Returns `{ ok: false, kind: 'not_found' }` if the language doesn't exist or belongs to another user.
 * Returns `{ ok: false, kind: 'validation' }` if the template references phoneme or group IDs
 * that do not exist in this language — guards against dangling JSONB references.
 */
export async function createSyllableStructureSvc(
  user: DbUser,
  rawLanguageId: unknown,
  rawInput: unknown,
): Promise<Result<SyllableStructure>> {
  const lang = await parseAndRequireOwnedLanguage(user, rawLanguageId);
  if (!lang.ok) return lang;

  const input = parseInput(createSyllableStructureInputSchema, rawInput);
  if (!input.ok) return input;

  const valid = await validateTemplateReferences(input.data.template, lang.data.id);
  if (!valid)
    return validationMessage(
      'One or more phoneme or group IDs in the template do not exist in this language.',
    );

  const [created] = await db
    .insert(syllable_structures)
    .values({
      language_id: lang.data.id,
      template: input.data.template,
      weight: input.data.weight,
    })
    .returning();

  return { ok: true, data: created };
}

/**
 * Updates a syllable structure's template and/or weight.
 * Fetches the structure first to obtain its `language_id` for the template reference check —
 * there is no direct `user_id` on syllable_structures, so ownership is verified via a subquery.
 * Returns `{ ok: false, kind: 'validation' }` if the template references phoneme or group IDs
 * that do not exist in this language — guards against dangling JSONB references.
 */
export async function updateSyllableStructureSvc(
  user: DbUser,
  rawId: unknown,
  rawInput: unknown,
): Promise<Result<SyllableStructure>> {
  const id = parseUuid(rawId);
  if (!id.ok) return id;

  const input = parseInput(updateSyllableStructureInputSchema, rawInput);
  if (!input.ok) return input;

  const [existing] = await db
    .select()
    .from(syllable_structures)
    .where(
      and(
        eq(syllable_structures.id, id.data),
        inArray(syllable_structures.language_id, ownedLanguageIds(user)),
      ),
    )
    .limit(1);
  if (!existing) return notFound();

  const valid = await validateTemplateReferences(
    input.data.template,
    existing.language_id,
  );
  if (!valid)
    return validationMessage(
      'One or more phoneme or group IDs in the template do not exist in this language.',
    );

  const [updated] = await db
    .update(syllable_structures)
    .set(input.data)
    .where(eq(syllable_structures.id, id.data))
    .returning();

  if (!updated) return notFound();
  return { ok: true, data: updated };
}

/**
 * Deletes a syllable structure, verifying ownership through the language table.
 * Returns `{ ok: false, kind: 'not_found' }` if the structure doesn't exist or belongs to another user's language.
 */
export async function deleteSyllableStructureSvc(
  user: DbUser,
  rawId: unknown,
): Promise<Result<SyllableStructure>> {
  const id = parseUuid(rawId);
  if (!id.ok) return id;

  const [deleted] = await db
    .delete(syllable_structures)
    .where(
      and(
        eq(syllable_structures.id, id.data),
        inArray(syllable_structures.language_id, ownedLanguageIds(user)),
      ),
    )
    .returning();

  if (!deleted) return notFound();
  return { ok: true, data: deleted };
}
