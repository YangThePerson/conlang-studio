import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/app/db';
import { phonemes, users } from '@/app/db/schema';
import { createPhonemeInputSchema, updatePhonemeInputSchema } from '@/app/db/validation';
import { conflict, notFound, type Result } from './result';
import { parseUuid, parseInput } from './parse';
import { ownedLanguageIds, parseAndRequireOwnedLanguage } from './ownership';
import { isReferencedInSyllableTemplates } from './syllables';

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
  const lang = await parseAndRequireOwnedLanguage(user, rawLanguageId);
  if (!lang.ok) return lang;

  const rows = await db
    .select()
    .from(phonemes)
    .where(eq(phonemes.language_id, lang.data.id));

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
  const lang = await parseAndRequireOwnedLanguage(user, rawLanguageId);
  if (!lang.ok) return lang;

  const input = parseInput(createPhonemeInputSchema, rawInput);
  if (!input.ok) return input;

  const [created] = await db
    .insert(phonemes)
    .values({
      language_id: lang.data.id,
      symbol: input.data.symbol,
      ipa: input.data.ipa,
      weight: input.data.weight ?? 1.0,
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
  const id = parseUuid(rawId);
  if (!id.ok) return id;

  const input = parseInput(updatePhonemeInputSchema, rawInput);
  if (!input.ok) return input;

  const [updated] = await db
    .update(phonemes)
    .set(input.data)
    .where(
      and(
        eq(phonemes.id, id.data),
        inArray(phonemes.language_id, ownedLanguageIds(user)),
      ),
    )
    .returning();

  if (!updated) return notFound();
  return { ok: true, data: updated };
}

/**
 * Deletes a phoneme, verifying ownership through the language table.
 * Returns `{ ok: false, kind: 'not_found' }` if the phoneme doesn't exist or belongs to another user's language.
 * Returns `{ ok: false, kind: 'conflict' }` if any syllable structure template references this phoneme —
 * the caller should prompt the user to remove it from those templates first.
 */
export async function deletePhonemeSvc(
  user: DbUser,
  rawId: unknown,
): Promise<Result<Phoneme>> {
  const id = parseUuid(rawId);
  if (!id.ok) return id;

  const [phoneme] = await db
    .select()
    .from(phonemes)
    .where(
      and(
        eq(phonemes.id, id.data),
        inArray(phonemes.language_id, ownedLanguageIds(user)),
      ),
    )
    .limit(1);
  if (!phoneme) return notFound();

  const referenced = await isReferencedInSyllableTemplates(
    phoneme.language_id,
    'phonemeId',
    phoneme.id,
  );
  if (referenced) return conflict();

  const [deleted] = await db
    .delete(phonemes)
    .where(eq(phonemes.id, id.data))
    .returning();

  if (!deleted) return notFound();
  return { ok: true, data: deleted };
}
