import {
  users,
  syllable_structures,
  languages,
  phonemes,
  phoneme_groups,
} from '@/app/db/schema';
import type { Result } from './result';
import {
  createSyllableStructureInputSchema,
  updateSyllableStructureInputSchema,
  uuidSchema,
} from '../db/validation';
import type { SyllableTemplate } from '../db/json-shapes';
import { z } from 'zod';
import { db } from '../db';
import { and, eq, inArray } from 'drizzle-orm';

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
  const phonemeIds = new Set<string>();
  const groupIds = new Set<string>();
  for (const slot of template) {
    if (slot.kind === 'phoneme') phonemeIds.add(slot.phonemeId);
    else groupIds.add(slot.groupId);
  }

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
 * Returns all syllable structures for a language, verifying that the language is owned by `user`.
 * Returns `{ ok: false, kind: 'not_found' }` if the language doesn't exist or belongs to another user.
 */
export async function listSyllableStructuresSvc(
  user: DbUser,
  rawLanguageId: unknown,
): Promise<Result<SyllableStructure[]>> {
  const parsedId = uuidSchema.safeParse(rawLanguageId);
  if (!parsedId.success) return { ok: false, kind: 'invalid_id' };

  const lang = await db.query.languages.findFirst({
    where: and(eq(languages.id, parsedId.data), eq(languages.user_id, user.id)),
  });
  if (!lang) return { ok: false, kind: 'not_found' };

  const rows = await db
    .select()
    .from(syllable_structures)
    .where(eq(syllable_structures.language_id, lang.id));

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
  const parsedId = uuidSchema.safeParse(rawLanguageId);
  if (!parsedId.success) return { ok: false, kind: 'invalid_id' };

  const parsed = createSyllableStructureInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      kind: 'validation',
      issues: z.treeifyError(parsed.error),
    };
  }

  const lang = await db.query.languages.findFirst({
    where: and(eq(languages.id, parsedId.data), eq(languages.user_id, user.id)),
  });
  if (!lang) return { ok: false, kind: 'not_found' };

  const valid = await validateTemplateReferences(parsed.data.template, parsedId.data);
  if (!valid)
    return {
      ok: false,
      kind: 'validation',
      issues: 'One or more phoneme or group IDs in the template do not exist in this language.',
    };

  const [created] = await db
    .insert(syllable_structures)
    .values({
      language_id: parsedId.data,
      template: parsed.data.template,
      weight: parsed.data.weight,
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
  const parsedId = uuidSchema.safeParse(rawId);
  if (!parsedId.success) return { ok: false, kind: 'invalid_id' };

  const parsed = updateSyllableStructureInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      kind: 'validation',
      issues: z.treeifyError(parsed.error),
    };
  }

  const ownedLanguageIds = db
    .select({ id: languages.id })
    .from(languages)
    .where(eq(languages.user_id, user.id));

  const [existing] = await db
    .select()
    .from(syllable_structures)
    .where(
      and(
        eq(syllable_structures.id, parsedId.data),
        inArray(syllable_structures.language_id, ownedLanguageIds),
      ),
    )
    .limit(1);
  if (!existing) return { ok: false, kind: 'not_found' };

  const valid = await validateTemplateReferences(parsed.data.template, existing.language_id);
  if (!valid)
    return {
      ok: false,
      kind: 'validation',
      issues: 'One or more phoneme or group IDs in the template do not exist in this language.',
    };

  const [updated] = await db
    .update(syllable_structures)
    .set(parsed.data)
    .where(eq(syllable_structures.id, parsedId.data))
    .returning();

  if (!updated) return { ok: false, kind: 'not_found' };
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
  const parsedId = uuidSchema.safeParse(rawId);
  if (!parsedId.success) return { ok: false, kind: 'invalid_id' };

  const ownedLanguageIds = db
    .select({ id: languages.id })
    .from(languages)
    .where(eq(languages.user_id, user.id));

  const [deleted] = await db
    .delete(syllable_structures)
    .where(
      and(
        eq(syllable_structures.id, parsedId.data),
        inArray(syllable_structures.language_id, ownedLanguageIds),
      ),
    )
    .returning();

  if (!deleted) return { ok: false, kind: 'not_found' };
  return { ok: true, data: deleted };
}
