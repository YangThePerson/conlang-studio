import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/app/db';
import { phonemes, languages, users } from '@/app/db/schema';
import {
  createPhonemeInputSchema,
  updatePhonemeInputSchema,
  uuidSchema,
} from '@/app/db/validation';
import type { Result } from './result';

type Phoneme = typeof phonemes.$inferSelect;
type DbUser = typeof users.$inferSelect;

/**
 * Returns all phonemes for a language, verifying that the language is owned by `user`.
 * Returns `{ ok: false, kind: 'not_found' }` if the language doesn't exist or belongs to another user.
 */
export async function listPhonemesSvc(
  user: DbUser,
  rawLanguageId: unknown,
): Promise<Result<Phoneme[]>> {
  const parsedId = uuidSchema.safeParse(rawLanguageId);
  if (!parsedId.success) return { ok: false, kind: 'invalid_id' };

  const lang = await db.query.languages.findFirst({
    where: and(eq(languages.id, parsedId.data), eq(languages.user_id, user.id)),
  });
  if (!lang) return { ok: false, kind: 'not_found' };

  const rows = await db
    .select()
    .from(phonemes)
    .where(eq(phonemes.language_id, parsedId.data));

  return { ok: true, data: rows };
}

/**
 * Creates a new phoneme for a language owned by `user`.
 * `language_id` comes from the route, not client input — ownership is verified before insert.
 * Returns `{ ok: false, kind: 'not_found' }` if the language doesn't exist or belongs to another user.
 */
export async function createPhonemeSvc(
  user: DbUser,
  rawLanguageId: unknown,
  rawInput: unknown,
): Promise<Result<Phoneme>> {
  const parsedId = uuidSchema.safeParse(rawLanguageId);
  if (!parsedId.success) return { ok: false, kind: 'invalid_id' };

  const parsed = createPhonemeInputSchema.safeParse(rawInput);
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
    .insert(phonemes)
    .values({
      language_id: parsedId.data,
      symbol: parsed.data.symbol,
      ipa: parsed.data.ipa,
      weight: parsed.data.weight ?? 1.0,
    })
    .returning();

  return { ok: true, data: created };
}

/**
 * Updates a phoneme's symbol and/or weight.
 * Ownership is verified by requiring the phoneme's `language_id` to belong to `user`
 * via a subquery on the languages table — there is no direct `user_id` on phonemes.
 */
export async function updatePhonemeSvc(
  user: DbUser,
  rawId: unknown,
  rawInput: unknown,
): Promise<Result<Phoneme>> {
  const parsedId = uuidSchema.safeParse(rawId);
  if (!parsedId.success) return { ok: false, kind: 'invalid_id' };

  const parsed = updatePhonemeInputSchema.safeParse(rawInput);
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

  const [updated] = await db
    .update(phonemes)
    .set(parsed.data)
    .where(
      and(
        eq(phonemes.id, parsedId.data),
        inArray(phonemes.language_id, ownedLanguageIds),
      ),
    )
    .returning();

  if (!updated) return { ok: false, kind: 'not_found' };
  return { ok: true, data: updated };
}

/**
 * Deletes a phoneme, verifying ownership through the language table.
 * Returns `{ ok: false, kind: 'not_found' }` if the phoneme doesn't exist or belongs to another user's language.
 */
export async function deletePhonemeSvc(
  user: DbUser,
  rawId: unknown,
): Promise<Result<Phoneme>> {
  const parsedId = uuidSchema.safeParse(rawId);
  if (!parsedId.success) return { ok: false, kind: 'invalid_id' };

  const ownedLanguageIds = db
    .select({ id: languages.id })
    .from(languages)
    .where(eq(languages.user_id, user.id));

  const [deleted] = await db
    .delete(phonemes)
    .where(
      and(
        eq(phonemes.id, parsedId.data),
        inArray(phonemes.language_id, ownedLanguageIds),
      ),
    )
    .returning();

  if (!deleted) return { ok: false, kind: 'not_found' };
  return { ok: true, data: deleted };
}
