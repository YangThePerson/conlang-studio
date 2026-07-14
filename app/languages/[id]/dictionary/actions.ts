'use server';

import { lexeme_tags, lexemes, senses, tags } from '@/app/db/schema';
import { getOrCreateDbUser } from '@/app/lib/current-user';
import {
  addManualWordSvc,
  addSenseToWordSvc,
  deleteLexemeSvc,
  deleteSenseSvc,
  updateLexemeSvc,
  updateSenseSvc,
} from '@/app/lib/dictionary';
import { Result } from '@/app/lib/result';
import {
  attachTagToLexemeSvc,
  createTagSvc,
  deleteTagSvc,
  detachTagFromLexemeSvc,
  updateTagSvc,
} from '@/app/lib/tags';
import { revalidatePath } from 'next/cache';

type Lexeme = typeof lexemes.$inferSelect;
type Sense = typeof senses.$inferSelect;
type Tag = typeof tags.$inferSelect;
type LexemeTag = typeof lexeme_tags.$inferSelect;

export async function createLexeme(
  languageId: string,
  _prevState: Result<Lexeme> | null,
  formData: FormData,
): Promise<Result<Lexeme>> {
  const user = await getOrCreateDbUser();
  if (!user) return { ok: false, kind: 'unauthorized' };

  const result = await addManualWordSvc(user, languageId, {
    term: formData.get('term'),
    notes: formData.get('notes') ?? '',
  });

  if (result.ok) revalidatePath(`/languages/${languageId}/dictionary`);
  return result;
}

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

/**
 * Server Action: creates a new tag for the language, from the tag manager's
 * Add Tag form.
 */
export async function createTag(
  languageId: string,
  _prevState: Result<Tag> | null,
  formData: FormData,
): Promise<Result<Tag>> {
  const user = await getOrCreateDbUser();
  if (!user) return { ok: false, kind: 'unauthorized' };

  const result = await createTagSvc(user, languageId, {
    name: formData.get('name'),
  });

  if (result.ok) revalidatePath(`/languages/${languageId}/dictionary`);
  return result;
}

/**
 * Server Action: renames a tag from the tag manager's inline rename row.
 * `languageId` is used only for cache revalidation; ownership is enforced
 * inside the service.
 */
export async function renameTag(
  languageId: string,
  tagId: string,
  _prevState: Result<Tag> | null,
  formData: FormData,
): Promise<Result<Tag>> {
  const user = await getOrCreateDbUser();
  if (!user) return { ok: false, kind: 'unauthorized' };

  const result = await updateTagSvc(user, tagId, {
    name: formData.get('name'),
  });

  if (result.ok) revalidatePath(`/languages/${languageId}/dictionary`);
  return result;
}

/**
 * Server Action: deletes a tag (its attachments to lexemes cascade).
 * `languageId` is used only for cache revalidation; ownership is enforced
 * inside the service.
 */
export async function deleteTag(
  languageId: string,
  tagId: string,
  _prevState: Result<Tag> | null,
  _formData: FormData,
): Promise<Result<Tag>> {
  const user = await getOrCreateDbUser();
  if (!user) return { ok: false, kind: 'unauthorized' };

  const result = await deleteTagSvc(user, tagId);

  if (result.ok) revalidatePath(`/languages/${languageId}/dictionary`);
  return result;
}

/**
 * Server Action: attaches a tag to a lexeme from the edit card's attach form.
 * `languageId` and `lexemeId` are bound by the client; the tag id comes from
 * the form's `<select>`.
 */
export async function attachTag(
  languageId: string,
  lexemeId: string,
  _prevState: Result<LexemeTag> | null,
  formData: FormData,
): Promise<Result<LexemeTag>> {
  const user = await getOrCreateDbUser();
  if (!user) return { ok: false, kind: 'unauthorized' };

  const result = await attachTagToLexemeSvc(
    user,
    languageId,
    lexemeId,
    formData.get('tag_id'),
  );

  if (result.ok) revalidatePath(`/languages/${languageId}/dictionary`);
  return result;
}

/**
 * Server Action: detaches a tag from a lexeme via its chip's own delete
 * button. `languageId`, `lexemeId`, and `tagId` are all bound by the client.
 */
export async function detachTag(
  languageId: string,
  lexemeId: string,
  tagId: string,
  _prevState: Result<LexemeTag> | null,
  _formData: FormData,
): Promise<Result<LexemeTag>> {
  const user = await getOrCreateDbUser();
  if (!user) return { ok: false, kind: 'unauthorized' };

  const result = await detachTagFromLexemeSvc(user, languageId, lexemeId, tagId);

  if (result.ok) revalidatePath(`/languages/${languageId}/dictionary`);
  return result;
}
