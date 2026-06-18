'use server';

import { revalidatePath } from 'next/cache';
import { getOrCreateDbUser } from '@/app/lib/current-user';
import {
  createLanguageSvc,
  updateLanguageSvc,
  deleteLanguageSvc,
} from '@/app/lib/languages';
import type { languages } from '@/app/db/schema';
import { Result } from '../lib/result';

type Language = typeof languages.$inferSelect;

/**
 * Server Action: creates a new language owned by the authenticated user.
 * Accepts `prevState` as required by `useActionState`.
 * `user_id` is injected from the session — it is not read from `formData`.
 */
export async function createLanguage(
  _prevState: Result<Language> | null,
  formData: FormData,
): Promise<Result<Language>> {
  const user = await getOrCreateDbUser();
  if (!user) return { ok: false, kind: 'unauthorized' };

  const result = await createLanguageSvc(user, { name: formData.get('name') });
  if (result.ok) revalidatePath('/languages');
  return result;
}

/**
 * Server Action: updates a language name owned by the authenticated user.
 * No-ops if `id` belongs to another user (ownership enforced in the service WHERE clause).
 */
export async function updateLanguage(id: string, name: string) {
  const user = await getOrCreateDbUser();
  if (!user) return { ok: false, kind: 'unauthorized' };

  const result = await updateLanguageSvc(user, id, { name });
  if (result.ok) revalidatePath('/languages');
  return result;
}

/**
 * Server Action: deletes a language and all its cascade-dependent data.
 * Accepts `id` first so callers can `.bind(null, id)` to get a `(prevState, formData)`
 * function compatible with `useActionState`. `_formData` is unused.
 * No-ops if `id` belongs to another user (ownership enforced in the service WHERE clause).
 */
export async function deleteLanguage(
  id: string,
  _prevState: Result<Language> | null,
  _formData: FormData,
): Promise<Result<Language>> {
  const user = await getOrCreateDbUser();
  if (!user) return { ok: false, kind: 'unauthorized' };

  const result = await deleteLanguageSvc(user, id);
  if (result.ok) revalidatePath('/languages');
  return result;
}
