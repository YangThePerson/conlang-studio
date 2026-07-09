import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/app/db';
import {
  group_memberships,
  phoneme_groups,
  phonemes,
  users,
} from '@/app/db/schema';
import {
  createGroupMembershipSchema,
  createPhonemeGroupInputSchema,
  updatePhonemeGroupInputSchema,
} from '@/app/db/validation';
import { conflict, notFound, validationMessage, type Result } from './result';
import { parseUuid, parseInput } from './parse';
import {
  isUniqueViolation,
  ownedLanguageIds,
  parseAndRequireOwnedLanguage,
} from './ownership';
import { isReferencedInSyllableTemplates } from './syllables';

type Phoneme = typeof phonemes.$inferSelect;
type PhonemeGroup = typeof phoneme_groups.$inferSelect;
type PhonemeGroupMembership = typeof group_memberships.$inferSelect;
type DbUser = typeof users.$inferSelect;

export type PhonemeGroupWithMembers = {
  id: string;
  name: string;
  members: Phoneme[];
};

/** `{ ok: false, kind: 'validation' }` for the one field a phoneme group's name can collide on. */
function duplicateGroupNameResult() {
  return validationMessage({
    properties: {
      name: {
        errors: [
          'A phoneme group with this name already exists for this language.',
        ],
      },
    },
  });
}

/**
 * Returns all phoneme groups for a language with their member phonemes, verifying that
 * the language is owned by `user`. Uses a single relational query rather than separate
 * group and membership fetches.
 * Returns `{ ok: false, kind: 'not_found' }` if the language doesn't exist or belongs to another user.
 */
export async function listPhonemeGroupsWithMembersSvc(
  user: DbUser,
  rawLanguageId: unknown,
): Promise<Result<PhonemeGroupWithMembers[]>> {
  const lang = await parseAndRequireOwnedLanguage(user, rawLanguageId);
  if (!lang.ok) return lang;

  const rows = await db.query.phoneme_groups.findMany({
    where: eq(phoneme_groups.language_id, lang.data.id),
    with: {
      memberships: {
        with: { phoneme: true },
      },
    },
  });

  return {
    ok: true,
    data: rows.map(({ id, name, memberships }) => ({
      id,
      name,
      members: memberships.map((m) => m.phoneme),
    })),
  };
}

/**
 * Returns all phonemes that are members of a specific group, verifying that the language
 * is owned by `user` and that the group belongs to that language.
 * Returns `{ ok: false, kind: 'not_found' }` if the language or group doesn't exist or belongs to another user.
 */
export async function getPhonemeMembersInGroupSvc(
  user: DbUser,
  rawLanguageId: unknown,
  rawGroupId: unknown,
): Promise<Result<Phoneme[]>> {
  const lang = await parseAndRequireOwnedLanguage(user, rawLanguageId);
  if (!lang.ok) return lang;

  const groupId = parseUuid(rawGroupId);
  if (!groupId.ok) return groupId;

  const group = await db.query.phoneme_groups.findFirst({
    where: and(
      eq(phoneme_groups.id, groupId.data),
      eq(phoneme_groups.language_id, lang.data.id),
    ),
    with: {
      memberships: {
        with: { phoneme: true },
      },
    },
  });

  if (!group) return notFound();

  return {
    ok: true,
    data: group.memberships.map(({ phoneme }) => phoneme),
  };
}

/**
 * Creates a new phoneme group for a language owned by `user`.
 * `language_id` comes from the route, not client input — ownership is verified before insert.
 * Returns `{ ok: false, kind: 'not_found' }` if the language doesn't exist or belongs to another user.
 * Returns `{ ok: false, kind: 'validation' }` if a group with the same name already exists in the language.
 */
export async function createPhonemeGroupSvc(
  user: DbUser,
  rawLanguageId: unknown,
  rawInput: unknown,
): Promise<Result<PhonemeGroup>> {
  const lang = await parseAndRequireOwnedLanguage(user, rawLanguageId);
  if (!lang.ok) return lang;

  const input = parseInput(createPhonemeGroupInputSchema, rawInput);
  if (!input.ok) return input;

  try {
    const [created] = await db
      .insert(phoneme_groups)
      .values({
        language_id: lang.data.id,
        name: input.data.name,
      })
      .returning();

    return { ok: true, data: created };
  } catch (error: unknown) {
    if (isUniqueViolation(error)) return duplicateGroupNameResult();
    throw error;
  }
}

/**
 * Updates a phoneme group's name.
 * Ownership is verified by requiring the phoneme group's `language_id` to belong to `user`
 * via a subquery on the languages table — there is no direct `user_id` on phoneme groups.
 * Returns `{ ok: false, kind: 'validation' }` if a group with the new name already exists in the language.
 */
export async function updatePhonemeGroupSvc(
  user: DbUser,
  rawId: unknown,
  rawInput: unknown,
): Promise<Result<PhonemeGroup>> {
  const id = parseUuid(rawId);
  if (!id.ok) return id;

  const input = parseInput(updatePhonemeGroupInputSchema, rawInput);
  if (!input.ok) return input;

  try {
    const [updated] = await db
      .update(phoneme_groups)
      .set(input.data)
      .where(
        and(
          eq(phoneme_groups.id, id.data),
          inArray(phoneme_groups.language_id, ownedLanguageIds(user)),
        ),
      )
      .returning();

    if (!updated) return notFound();
    return { ok: true, data: updated };
  } catch (error: unknown) {
    if (isUniqueViolation(error)) return duplicateGroupNameResult();
    throw error;
  }
}

/**
 * Adds a phoneme to a phoneme group.
 * `rawLanguageId` is required to verify that both the phoneme and the group belong to the
 * same user-owned language — neither table carries a direct `user_id`.
 * Returns `{ ok: false, kind: 'not_found' }` if the language, phoneme, or group doesn't exist or belongs to another user.
 * Returns `{ ok: false, kind: 'validation' }` if the phoneme is already a member of the group.
 */
export async function addPhonemeToGroupSvc(
  user: DbUser,
  rawLanguageId: unknown,
  rawPhonemeId: unknown,
  rawGroupId: unknown,
): Promise<Result<PhonemeGroupMembership>> {
  const lang = await parseAndRequireOwnedLanguage(user, rawLanguageId);
  if (!lang.ok) return lang;

  const input = parseInput(createGroupMembershipSchema, {
    group_id: rawGroupId,
    phoneme_id: rawPhonemeId,
  });
  if (!input.ok) return input;

  const [phoneme, group] = await Promise.all([
    db.query.phonemes.findFirst({
      where: and(
        eq(phonemes.id, input.data.phoneme_id),
        eq(phonemes.language_id, lang.data.id),
      ),
    }),
    db.query.phoneme_groups.findFirst({
      where: and(
        eq(phoneme_groups.id, input.data.group_id),
        eq(phoneme_groups.language_id, lang.data.id),
      ),
    }),
  ]);
  if (!phoneme || !group) return notFound();

  try {
    const [created] = await db
      .insert(group_memberships)
      .values(input.data)
      .returning();

    return { ok: true, data: created };
  } catch (error: unknown) {
    if (isUniqueViolation(error))
      return validationMessage({
        errors: ['This phoneme already belongs to this group.'],
      });
    throw error;
  }
}

/**
 * Removes a phoneme from a phoneme group.
 * `rawLanguageId` is required to verify that both the phoneme and the group belong to the
 * same user-owned language — neither table carries a direct `user_id`.
 * Returns `{ ok: false, kind: 'not_found' }` if the language, phoneme, group, or the membership itself doesn't exist.
 */
export async function removePhonemeFromGroupSvc(
  user: DbUser,
  rawLanguageId: unknown,
  rawPhonemeId: unknown,
  rawGroupId: unknown,
): Promise<Result<PhonemeGroupMembership>> {
  const lang = await parseAndRequireOwnedLanguage(user, rawLanguageId);
  if (!lang.ok) return lang;

  const input = parseInput(createGroupMembershipSchema, {
    group_id: rawGroupId,
    phoneme_id: rawPhonemeId,
  });
  if (!input.ok) return input;

  const [phoneme, group] = await Promise.all([
    db.query.phonemes.findFirst({
      where: and(
        eq(phonemes.id, input.data.phoneme_id),
        eq(phonemes.language_id, lang.data.id),
      ),
    }),
    db.query.phoneme_groups.findFirst({
      where: and(
        eq(phoneme_groups.id, input.data.group_id),
        eq(phoneme_groups.language_id, lang.data.id),
      ),
    }),
  ]);
  if (!phoneme || !group) return notFound();

  const [deleted] = await db
    .delete(group_memberships)
    .where(
      and(
        eq(group_memberships.group_id, input.data.group_id),
        eq(group_memberships.phoneme_id, input.data.phoneme_id),
      ),
    )
    .returning();

  if (!deleted) return notFound();
  return { ok: true, data: deleted };
}

/**
 * Deletes a phoneme group, verifying ownership through the language table.
 * Returns `{ ok: false, kind: 'not_found' }` if the phoneme group doesn't exist or belongs to another user's language.
 * Returns `{ ok: false, kind: 'conflict' }` if any syllable structure template references this group —
 * the caller should prompt the user to remove it from those templates first.
 */
export async function deletePhonemeGroupSvc(
  user: DbUser,
  rawId: unknown,
): Promise<Result<PhonemeGroup>> {
  const id = parseUuid(rawId);
  if (!id.ok) return id;

  const [group] = await db
    .select()
    .from(phoneme_groups)
    .where(
      and(
        eq(phoneme_groups.id, id.data),
        inArray(phoneme_groups.language_id, ownedLanguageIds(user)),
      ),
    )
    .limit(1);
  if (!group) return notFound();

  const referenced = await isReferencedInSyllableTemplates(
    group.language_id,
    'groupId',
    group.id,
  );
  if (referenced) return conflict();

  const [deleted] = await db
    .delete(phoneme_groups)
    .where(eq(phoneme_groups.id, id.data))
    .returning();

  if (!deleted) return notFound();
  return { ok: true, data: deleted };
}
