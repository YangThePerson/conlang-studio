'use server';

import { lexemes, senses } from '@/app/db/schema';
import { getOrCreateDbUser } from '@/app/lib/current-user';
import {
  addSenseToWordSvc,
  deleteLexemeSvc,
  deleteSenseSvc,
  updateLexemeSvc,
  updateSenseSvc,
} from '@/app/lib/dictionary';
import { Result } from '@/app/lib/result';
import { revalidatePath } from 'next/cache';

type Lexeme = typeof lexemes.$inferSelect;
type Sense = typeof senses.$inferSelect;

/**
 * Server Action: adds a sense to a lexeme from the edit card's Add Sense form.
 * `languageId` and `lexemeId` are bound by the client; part of speech and
 * definition come from the form, so a sense is never created blank (the
 * service rejects an empty definition).
 */
export async function addSenseToLexeme(
  languageId: string,
  lexemeId: string,
  _prevState: Result<Sense> | null,
  formData: FormData,
): Promise<Result<Sense>> {
  const user = await getOrCreateDbUser();
  if (!user) return { ok: false, kind: 'unauthorized' };

  const result = await addSenseToWordSvc(user, languageId, {
    lexeme_id: lexemeId,
    part_of_speech: String(formData.get('part_of_speech') ?? ''),
    definition: String(formData.get('definition') ?? ''),
  });

  if (result.ok) revalidatePath(`/languages/${languageId}/dictionary`);
  return result;
}

/**
 * Server Action: updates a lexeme's term and notes. `languageId` is used only
 * for cache revalidation; ownership is enforced inside the service.
 */
export async function updateLexeme(
  languageId: string,
  lexemeId: string,
  _prevState: Result<Lexeme> | null,
  formData: FormData,
): Promise<Result<Lexeme>> {
  const user = await getOrCreateDbUser();
  if (!user) return { ok: false, kind: 'unauthorized' };

  const result = await updateLexemeSvc(user, lexemeId, {
    term: String(formData.get('term') ?? ''),
    notes: String(formData.get('notes') ?? ''),
  });

  if (result.ok) revalidatePath(`/languages/${languageId}/dictionary`);
  return result;
}

/**
 * Server Action: deletes a lexeme (its senses and tag attachments cascade).
 * `languageId` is used only for cache revalidation; ownership is enforced
 * inside the service.
 */
export async function deleteLexeme(
  languageId: string,
  lexemeId: string,
  _prevState: Result<Lexeme> | null,
  _formData: FormData,
): Promise<Result<Lexeme>> {
  const user = await getOrCreateDbUser();
  if (!user) return { ok: false, kind: 'unauthorized' };

  const result = await deleteLexemeSvc(user, lexemeId);

  if (result.ok) revalidatePath(`/languages/${languageId}/dictionary`);
  return result;
}

/**
 * Server Action: updates a sense's part of speech and definition.
 * `languageId` is used only for cache revalidation; ownership is enforced
 * inside the service via the sense → lexeme → language → user chain.
 */
export async function updateSense(
  languageId: string,
  senseId: string,
  _prevState: Result<Sense> | null,
  formData: FormData,
): Promise<Result<Sense>> {
  const user = await getOrCreateDbUser();
  if (!user) return { ok: false, kind: 'unauthorized' };

  const result = await updateSenseSvc(user, senseId, {
    part_of_speech: String(formData.get('part_of_speech') ?? ''),
    definition: String(formData.get('definition') ?? ''),
  });

  if (result.ok) revalidatePath(`/languages/${languageId}/dictionary`);
  return result;
}

/**
 * Server Action: deletes a sense. `languageId` is used only for cache
 * revalidation; ownership is enforced inside the service via the
 * sense → lexeme → language → user chain.
 */
export async function deleteSense(
  languageId: string,
  senseId: string,
  _prevState: Result<Sense> | null,
  _formData: FormData,
): Promise<Result<Sense>> {
  const user = await getOrCreateDbUser();
  if (!user) return { ok: false, kind: 'unauthorized' };

  const result = await deleteSenseSvc(user, senseId);

  if (result.ok) revalidatePath(`/languages/${languageId}/dictionary`);
  return result;
}
