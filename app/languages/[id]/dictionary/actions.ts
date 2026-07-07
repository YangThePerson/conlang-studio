'use server';

import { Result } from '@/app/lib/result';
import { senses } from '@/app/db/schema';
import { getOrCreateDbUser } from '@/app/lib/current-user';
import { addSenseToWordSvc } from '@/app/lib/dictionary';
import { revalidatePath } from 'next/cache';

type Sense = typeof senses.$inferSelect;

export async function addSenseToLexeme(
  languageId: string,
  lexemeId: string,
): Promise<Result<Sense>> {
  const user = await getOrCreateDbUser();
  if (!user) return { ok: false, kind: 'unauthorized' };

  const result = await addSenseToWordSvc(user, languageId, {
    lexeme_id: lexemeId,
    part_of_speech: '',
    definition: '',
  });
  if (result.ok) revalidatePath(`/languages/${languageId}/dictionary`);
  return result;
}
