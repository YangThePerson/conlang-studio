'use server';

import { getOrCreateDbUser } from '@/app/lib/current-user';
import { Result } from '@/app/lib/result';
import { generateWordSvc } from '@/app/lib/wordgen';
import { revalidatePath } from 'next/cache';

/**
 * Server Action: generates a set of random words for the language's syllable structures.
 * No seed is passed, so `generateWordSvc` uses `Math.random` — output is non-deterministic,
 * matching the "Generate" button's expected behavior of a fresh list each click.
 */
export async function generateWords(
  languageId: string,
  wordsToGenerate: number,
  structures: string[],
  minSyllables: number,
  maxSyllables: number,
): Promise<Result<{ words: Set<string>; requested: number }>> {
  const user = await getOrCreateDbUser();
  if (!user) return { ok: false, kind: 'unauthorized' };

  const result = await generateWordSvc(user, languageId, {
    wordsToGenerate,
    structures,
    minSyllables,
    maxSyllables,
  });

  if (result.ok) revalidatePath(`/languages/${languageId}/syllables`);
  return result;
}
