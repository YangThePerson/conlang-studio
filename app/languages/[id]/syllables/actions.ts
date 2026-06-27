'use server';

import { syllable_structures } from '@/app/db/schema';
import { getOrCreateDbUser } from '@/app/lib/current-user';
import { Result } from '@/app/lib/result';
import {
  createSyllableStructureSvc,
  deleteSyllableStructureSvc,
  updateSyllableStructureSvc,
} from '@/app/lib/syllables';
import { revalidatePath } from 'next/cache';

type SyllableStructure = typeof syllable_structures.$inferSelect;

/**
 * Server Action: creates a new syllable structure for the given language.
 * The `template` field is JSON-encoded as a hidden input (it's a structured array, not a flat form value),
 * so it is parsed here before being forwarded to the service.
 */
export async function createSyllableStructure(
  languageId: string,
  _prevState: Result<SyllableStructure> | null,
  formData: FormData,
): Promise<Result<SyllableStructure>> {
  const user = await getOrCreateDbUser();
  if (!user) return { ok: false, kind: 'unauthorized' };

  let template: unknown;
  try {
    template = JSON.parse(String(formData.get('template')));
  } catch {
    return { ok: false, kind: 'validation', issues: { template: { _errors: ['Invalid JSON'] } } };
  }

  const result = await createSyllableStructureSvc(user, languageId, {
    template,
    weight: Number(formData.get('weight')),
  });

  if (result.ok) revalidatePath(`/languages/${languageId}/syllables`);
  return result;
}

/**
 * Server Action: updates the template and weight of an existing syllable structure.
 * `template` is JSON-encoded as a hidden input (same reason as `createSyllableStructure`).
 */
export async function updateSyllableStructure(
  languageId: string,
  structureId: string,
  _prevState: Result<SyllableStructure> | null,
  formData: FormData,
): Promise<Result<SyllableStructure>> {
  const user = await getOrCreateDbUser();
  if (!user) return { ok: false, kind: 'unauthorized' };

  let template: unknown;
  try {
    template = JSON.parse(String(formData.get('template')));
  } catch {
    return { ok: false, kind: 'validation', issues: { template: { _errors: ['Invalid JSON'] } } };
  }

  const result = await updateSyllableStructureSvc(user, structureId, {
    template,
    weight: Number(formData.get('weight')),
  });

  if (result.ok) revalidatePath(`/languages/${languageId}/syllables`);
  return result;
}

/**
 * Server Action: deletes a syllable structure. `languageId` is used only for cache revalidation
 * after a successful delete; ownership is enforced inside the service.
 */
export async function deleteSyllableStructure(
  languageId: string,
  structureId: string,
  _prevState: Result<SyllableStructure> | null,
  _formData: FormData,
): Promise<Result<SyllableStructure>> {
  const user = await getOrCreateDbUser();
  if (!user) return { ok: false, kind: 'unauthorized' };

  const result = await deleteSyllableStructureSvc(user, structureId);

  if (result.ok) revalidatePath(`/languages/${languageId}/syllables`);
  return result;
}
