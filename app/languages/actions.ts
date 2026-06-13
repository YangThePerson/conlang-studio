'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/app/db';
import { languages } from '@/app/db/schema';
import { createLanguageInputSchema, renameLanguageInputSchema, uuidSchema } from '@/app/db/validation';
import { getOrCreateDbUser } from '@/app/lib/current-user';

/**
 * Server Action: creates a new language owned by the authenticated user.
 * `user_id` is injected from the session — it is not read from `formData`.
 */
export async function createLanguage(formData: FormData) {
  const user = await getOrCreateDbUser();
  if (!user) throw new Error('Unauthorized');

  const parsed = createLanguageInputSchema.safeParse({ name: formData.get('name') });
  if (!parsed.success) throw new Error('Invalid input');

  await db.insert(languages).values({ user_id: user.id, name: parsed.data.name });
  revalidatePath('/languages');
}

/**
 * Server Action: renames a language. Silently no-ops if `id` belongs to another user,
 * because the ownership `WHERE` clause will match zero rows.
 */
export async function renameLanguage(id: string, name: string) {
  const user = await getOrCreateDbUser();
  if (!user) throw new Error('Unauthorized');

  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) throw new Error('Invalid input');

  const parsedBody = renameLanguageInputSchema.safeParse({ name });
  if (!parsedBody.success) throw new Error('Invalid input');

  await db
    .update(languages)
    .set({ name: parsedBody.data.name })
    .where(and(eq(languages.id, parsedId.data), eq(languages.user_id, user.id)));

  revalidatePath('/languages');
}

/**
 * Server Action: deletes a language and all its cascade-dependent data.
 * `_formData` is required by the Server Action form-binding contract but unused.
 * Silently no-ops if `id` belongs to another user (ownership enforced via WHERE clause).
 */
export async function deleteLanguage(id: string, _formData: FormData) {
  const user = await getOrCreateDbUser();
  if (!user) throw new Error('Unauthorized');

  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) throw new Error('Invalid input');

  await db
    .delete(languages)
    .where(and(eq(languages.id, parsedId.data), eq(languages.user_id, user.id)));

  revalidatePath('/languages');
}
