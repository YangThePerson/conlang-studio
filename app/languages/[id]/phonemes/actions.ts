'use server';

import { revalidatePath } from 'next/cache';
import { getOrCreateDbUser } from '@/app/lib/current-user';
import {
  createPhoneme as createPhonemeSvc,
  updatePhoneme as updatePhonemeSvc,
  deletePhoneme as deletePhonemeSvc,
} from '@/app/lib/phonemes';
import type { Result } from '@/app/lib/result';
import type { phonemes } from '@/app/db/schema';

type Phoneme = typeof phonemes.$inferSelect;

/**
 * Server Action: adds a new phoneme to the language identified by `languageId`.
 * Bound with `languageId` so the result is a `(prevState, formData)` function for `useActionState`.
 * `language_id` is injected from the route — it is not read from `formData`.
 */
export async function createPhoneme(
  languageId: string,
  _prevState: Result<Phoneme> | null,
  formData: FormData,
): Promise<Result<Phoneme>> {
  const user = await getOrCreateDbUser();
  if (!user) return { ok: false, kind: 'unauthorized' };

  const result = await createPhonemeSvc(user, languageId, {
    symbol: formData.get('symbol'),
    ipa: formData.get('ipa'),
    weight: Number(formData.get('weight')),
  });

  if (result.ok) revalidatePath(`/languages/${languageId}/phonemes`);
  return result;
}

/**
 * Server Action: updates a phoneme's symbol, IPA notation, and/or weight.
 * Bound with `languageId` and `phonemeId` so the result is a `(prevState, formData)` function for `useActionState`.
 */
export async function updatePhoneme(
  languageId: string,
  phonemeId: string,
  _prevState: Result<Phoneme> | null,
  formData: FormData,
): Promise<Result<Phoneme>> {
  const user = await getOrCreateDbUser();
  if (!user) return { ok: false, kind: 'unauthorized' };

  const result = await updatePhonemeSvc(user, phonemeId, {
    symbol: formData.get('symbol'),
    ipa: formData.get('ipa'),
    weight: Number(formData.get('weight')),
  });
  if (result.ok) revalidatePath(`/languages/${languageId}/phonemes`);
  return result;
}

/**
 * Server Action: deletes a phoneme by id.
 * Bound with `languageId` and `phonemeId` so the result is a `(prevState, formData)` function
 * for `useActionState`. `_formData` is unused.
 */
export async function deletePhoneme(
  languageId: string,
  phonemeId: string,
  _prevState: Result<Phoneme> | null,
  _formData: FormData,
): Promise<Result<Phoneme>> {
  const user = await getOrCreateDbUser();
  if (!user) return { ok: false, kind: 'unauthorized' };

  const result = await deletePhonemeSvc(user, phonemeId);
  if (result.ok) revalidatePath(`/languages/${languageId}/phonemes`);
  return result;
}
