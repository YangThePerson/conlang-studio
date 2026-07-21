'use server';

import { lexemes } from '@/app/db/schema';
import { addGeneratedWordSvc } from '@/app/lib/dictionary';
import { getOrCreateDbUser } from '@/app/lib/current-user';
import { Result } from '@/app/lib/result';
import { generateWordSvc } from '@/app/lib/wordgen';
import { revalidatePath } from 'next/cache';

type Lexeme = typeof lexemes.$inferSelect;

/**
 * Server Action: generates a set of random words for the language's syllable structures.
 * No seed is passed, so `generateWordSvc` uses `Math.random` — output is non-deterministic,
 * matching the "Generate" button's expected behavior of a fresh list each click.
 * Unlike other actions, `user` may be `null` here — generation is read-only (no DB write),
 * so it's allowed for anonymous visitors of a public language; `generateWordSvc` enforces
 * visibility itself.
 */
export async function generateWords(
  languageId: string,
  wordsToGenerate: number,
  structures: string[],
  minSyllables: number,
  maxSyllables: number,
): Promise<Result<{ words: Set<string>; requested: number }>> {
  const user = await getOrCreateDbUser();

  const result = await generateWordSvc(user, languageId, {
    wordsToGenerate,
    structures,
    minSyllables,
    maxSyllables,
  });

  if (result.ok) revalidatePath(`/languages/${languageId}/wordgen`);
  return result;
}

/**
 * Server Action: banks a single generated word into the language's dictionary as a
 * lexeme with origin 'generated'. Delegates to `addGeneratedWordSvc` — see its JSDoc
 * for why origin is not client-supplied.
 */
export async function addWordToDictionary(
  languageId: string,
  word: string,
): Promise<Result<Lexeme>> {
  const user = await getOrCreateDbUser();
  if (!user) return { ok: false, kind: 'unauthorized' };

  const result = await addGeneratedWordSvc(user, languageId, { term: word });

  if (result.ok) revalidatePath(`/languages/${languageId}/dictionary`);
  return result;
}
