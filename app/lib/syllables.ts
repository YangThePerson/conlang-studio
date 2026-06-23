import { users, syllable_structures, languages } from '@/app/db/schema';
import type { Result } from './result';
import {
  createSyllableStructureInputSchema,
  updateSyllableStructureInputSchema,
  uuidSchema,
} from '../db/validation';
import { z } from 'zod';
import { db } from '../db';
import { and, eq, inArray } from 'drizzle-orm';

type DbUser = typeof users.$inferSelect;
type SyllableStructure = typeof syllable_structures.$inferSelect;

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
 * Ownership is verified by requiring the syllable structure's `language_id` to belong to `user`
 * via a subquery on the languages table — there is no direct `user_id` on phonemes.
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

  const lang = await db.query.languages.findFirst({
    where: and(eq(languages.id, parsedId.data), eq(languages.user_id, user.id)),
  });
  if (!lang) return { ok: false, kind: 'not_found' };

  const ownedLanguageIds = db
    .select({ id: languages.id })
    .from(languages)
    .where(eq(languages.user_id, user.id));

  const [updated] = await db
    .update(syllable_structures)
    .set(parsed.data)
    .where(
      and(
        eq(syllable_structures.id, parsedId.data),
        inArray(syllable_structures.language_id, ownedLanguageIds),
      ),
    )
    .returning();

  if (!updated) return { ok: false, kind: 'not_found' };
  return { ok: true, data: updated };
}

/**
 * Deletes a syllable structure, verifying ownership through the language table.
 * Returns `{ ok: false, kind: 'not_found' }` if the phoneme doesn't exist or belongs to another user's language.
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
