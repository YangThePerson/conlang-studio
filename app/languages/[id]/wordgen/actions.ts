'use server';

import { getOrCreateDbUser } from '@/app/lib/current-user';
import { Result } from '@/app/lib/result';
import { generateWordSvc } from '@/app/lib/wordgen';
import { revalidatePath } from 'next/cache';

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
