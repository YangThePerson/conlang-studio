'use server';

import { revalidatePath } from 'next/cache';
import { getOrCreateDbUser } from '@/app/lib/current-user';
import {
  createLanguage as createLanguageSvc,
  updateLanguage as updateLanguageSvc,
  deleteLanguage as deleteLanguageSvc,
} from '@/app/lib/languages';

/**
 * Server Action: creates a new language owned by the authenticated user.
 * `user_id` is injected from the session — it is not read from `formData`.
 */
export async function createLanguage(formData: FormData) {
  const user = await getOrCreateDbUser();
  if (!user) return { ok: false as const, error: 'Unauthorized' };

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
  if (!user) return { ok: false as const, error: 'Unauthorized' };

  const result = await updateLanguageSvc(user, id, { name });
  if (result.ok) revalidatePath('/languages');
  return result;
}

/**
 * Server Action: deletes a language and all its cascade-dependent data.
 * `_formData` is required by the Server Action form-binding contract but unused.
 * No-ops if `id` belongs to another user (ownership enforced in the service WHERE clause).
 */
export async function deleteLanguage(id: string, _formData: FormData) {
  const user = await getOrCreateDbUser();
  if (!user) return { ok: false as const, error: 'Unauthorized' };

  const result = await deleteLanguageSvc(user, id);
  if (result.ok) revalidatePath('/languages');
  return result;
}
