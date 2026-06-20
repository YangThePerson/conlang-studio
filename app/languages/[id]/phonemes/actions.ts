'use server';

import { revalidatePath } from 'next/cache';
import { getOrCreateDbUser } from '@/app/lib/current-user';
import {
  createPhonemeSvc,
  updatePhonemeSvc,
  deletePhonemeSvc,
} from '@/app/lib/phonemes';
import type { Result } from '@/app/lib/result';
import type {
  phonemes,
  phoneme_groups,
  group_memberships,
} from '@/app/db/schema';
import {
  addPhonemeToGroupSvc,
  createPhonemeGroupSvc,
  deletePhonemeGroupSvc,
  removePhonemeFromGroupSvc,
  updatePhonemeGroupSvc,
} from '@/app/lib/phoneme-groups';

type Phoneme = typeof phonemes.$inferSelect;
type PhonemeGroup = typeof phoneme_groups.$inferSelect;
type PhonemeGroupMemberships = typeof group_memberships.$inferSelect;

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

/**
 * Server Action: adds a new phoneme group to the language identified by `languageId`.
 * Bound with `languageId` so the result is a `(prevState, formData)` function for `useActionState`.
 * `language_id` is injected from the route — it is not read from `formData`.
 */
export async function createGroup(
  languageId: string,
  _prevState: Result<PhonemeGroup> | null,
  formData: FormData,
): Promise<Result<PhonemeGroup>> {
  const user = await getOrCreateDbUser();
  if (!user) return { ok: false, kind: 'unauthorized' };

  const result = await createPhonemeGroupSvc(user, languageId, {
    name: formData.get('name'),
  });

  if (result.ok) revalidatePath(`/languages/${languageId}/phonemes`);
  return result;
}

/**
 * Server Action: updates a phoneme group's name and membership.
 * Bound with `languageId` and `groupId` so the result is a `(prevState, formData)` function for `useActionState`.
 * Reads `phoneme_id` entries (the checked phonemes) and `current_member_id` hidden fields from `formData`
 * to diff membership changes — no separate add/remove actions needed from the client.
 */
export async function updateGroup(
  languageId: string,
  groupId: string,
  _prevState: Result<PhonemeGroup> | null,
  formData: FormData,
): Promise<Result<PhonemeGroup>> {
  const user = await getOrCreateDbUser();
  if (!user) return { ok: false, kind: 'unauthorized' };

  const result = await updatePhonemeGroupSvc(user, groupId, {
    name: formData.get('name'),
  });
  if (!result.ok) return result;

  const desiredIds = new Set(formData.getAll('phoneme_id') as string[]);
  const currentIds = new Set(formData.getAll('current_member_id') as string[]);

  for (const phonemeId of desiredIds) {
    if (!currentIds.has(phonemeId)) {
      const r = await addPhonemeToGroupSvc(user, languageId, phonemeId, groupId);
      if (!r.ok) {
        if (r.kind === 'validation') return { ok: false, kind: 'validation', issues: r.issues };
        return { ok: false, kind: r.kind };
      }
    }
  }

  for (const phonemeId of currentIds) {
    if (!desiredIds.has(phonemeId)) {
      const r = await removePhonemeFromGroupSvc(user, languageId, phonemeId, groupId);
      if (!r.ok && r.kind !== 'not_found') {
        if (r.kind === 'validation') return { ok: false, kind: 'validation', issues: r.issues };
        return { ok: false, kind: r.kind };
      }
    }
  }

  revalidatePath(`/languages/${languageId}/phonemes`);
  return result;
}

/**
 * Server Action: deletes a phoneme group by id.
 * Bound with `languageId` and `groupId` so the result is a `(prevState, formData)` function
 * for `useActionState`. `_formData` is unused.
 */
export async function deleteGroup(
  languageId: string,
  groupId: string,
  _prevState: Result<PhonemeGroup> | null,
  _formData: FormData,
): Promise<Result<PhonemeGroup>> {
  const user = await getOrCreateDbUser();
  if (!user) return { ok: false, kind: 'unauthorized' };

  const result = await deletePhonemeGroupSvc(user, groupId);
  if (result.ok) revalidatePath(`/languages/${languageId}/phonemes`);
  return result;
}

/**
 * Server Action: adds a phoneme to a phoneme group, verifying both belong to `languageId`.
 * Available for API routes or direct invocation; the edit form uses `updateGroup` instead.
 */
export async function addPhonemeToGroup(
  languageId: string,
  rawPhonemeId: string,
  rawGroupId: string,
): Promise<Result<PhonemeGroupMemberships>> {
  const user = await getOrCreateDbUser();
  if (!user) return { ok: false, kind: 'unauthorized' };

  const result = await addPhonemeToGroupSvc(
    user,
    languageId,
    rawPhonemeId,
    rawGroupId,
  );

  if (result.ok) revalidatePath(`/languages/${languageId}/phonemes`);
  return result;
}

/**
 * Server Action: removes a phoneme from a phoneme group, verifying both belong to `languageId`.
 * Available for API routes or direct invocation; the edit form uses `updateGroup` instead.
 */
export async function removePhonemeFromGroup(
  languageId: string,
  rawPhonemeId: string,
  rawGroupId: string,
): Promise<Result<PhonemeGroupMemberships>> {
  const user = await getOrCreateDbUser();
  if (!user) return { ok: false, kind: 'unauthorized' };

  const result = await removePhonemeFromGroupSvc(
    user,
    languageId,
    rawPhonemeId,
    rawGroupId,
  );

  if (result.ok) revalidatePath(`/languages/${languageId}/phonemes`);
  return result;
}
