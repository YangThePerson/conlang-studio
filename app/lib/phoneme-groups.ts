import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/app/db';
import {
  group_memberships,
  languages,
  phoneme_groups,
  phonemes,
  users,
} from '@/app/db/schema';
import {
  createGroupMembershipSchema,
  createPhonemeGroupInputSchema,
  updatePhonemeGroupInputSchema,
  uuidSchema,
} from '@/app/db/validation';
import type { Result } from './result';
import { z } from 'zod';

type Phoneme = typeof phonemes.$inferSelect;
type PhonemeGroup = typeof phoneme_groups.$inferSelect;
type PhonemeGroupMembership = typeof group_memberships.$inferSelect;
type DbUser = typeof users.$inferSelect;

export type PhonemeGroupWithMembers = {
  id: string;
  name: string;
  members: Phoneme[];
};

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
  const parsedId = uuidSchema.safeParse(rawLanguageId);
  if (!parsedId.success) return { ok: false, kind: 'invalid_id' };

  const lang = await db.query.languages.findFirst({
    where: and(eq(languages.id, parsedId.data), eq(languages.user_id, user.id)),
  });
  if (!lang) return { ok: false, kind: 'not_found' };

  const rows = await db.query.phoneme_groups.findMany({
    where: eq(phoneme_groups.language_id, parsedId.data),
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
  const parsedLangId = uuidSchema.safeParse(rawLanguageId);
  if (!parsedLangId.success) return { ok: false, kind: 'invalid_id' };

  const parsedGroupId = uuidSchema.safeParse(rawGroupId);
  if (!parsedGroupId.success) return { ok: false, kind: 'invalid_id' };

  const lang = await db.query.languages.findFirst({
    where: and(
      eq(languages.id, parsedLangId.data),
      eq(languages.user_id, user.id),
    ),
  });
  if (!lang) return { ok: false, kind: 'not_found' };

  const group = await db.query.phoneme_groups.findFirst({
    where: and(
      eq(phoneme_groups.id, parsedGroupId.data),
      eq(phoneme_groups.language_id, parsedLangId.data),
    ),
    with: {
      memberships: {
        with: { phoneme: true },
      },
    },
  });

  if (!group) return { ok: false, kind: 'not_found' };

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
  const parsedId = uuidSchema.safeParse(rawLanguageId);
  if (!parsedId.success) return { ok: false, kind: 'invalid_id' };

  const parsed = createPhonemeGroupInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      kind: 'validation',
      issues: z.treeifyError(parsed.error),
    };
  }

  const lang = await db.query.languages.findFirst({
    where: and(eq(languages.id, parsedId.data), eq(languages.user_id, user.id)),
  });
  if (!lang) return { ok: false, kind: 'not_found' };

  try {
    const [created] = await db
      .insert(phoneme_groups)
      .values({
        language_id: parsedId.data,
        name: parsed.data.name,
      })
      .returning();

    return { ok: true, data: created };
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      // Postgres unique constraint violation code
      error.code === '23505'
    ) {
      return {
        ok: false,
        kind: 'validation',
        issues: {
          properties: {
            name: {
              errors: [
                'A phoneme group with this name already exists for this language.',
              ],
            },
          },
        },
      };
    }

    // Re-throw if it's an unexpected database error
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
  const parsedId = uuidSchema.safeParse(rawId);
  if (!parsedId.success) return { ok: false, kind: 'invalid_id' };

  const parsed = updatePhonemeGroupInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      kind: 'validation',
      issues: z.treeifyError(parsed.error),
    };
  }

  const ownedLanguageIds = db
    .select({ id: languages.id })
    .from(languages)
    .where(eq(languages.user_id, user.id));

  try {
    const [updated] = await db
      .update(phoneme_groups)
      .set(parsed.data)
      .where(
        and(
          eq(phoneme_groups.id, parsedId.data),
          inArray(phoneme_groups.language_id, ownedLanguageIds),
        ),
      )
      .returning();

    if (!updated) return { ok: false, kind: 'not_found' };
    return { ok: true, data: updated };
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      // Postgres unique constraint violation code
      error.code === '23505'
    ) {
      return {
        ok: false,
        kind: 'validation',
        issues: {
          properties: {
            name: {
              errors: [
                'A phoneme group with this name already exists for this language.',
              ],
            },
          },
        },
      };
    }

    // Re-throw if it's an unexpected database error
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
  const parsedId = uuidSchema.safeParse(rawLanguageId);
  if (!parsedId.success) return { ok: false, kind: 'invalid_id' };

  const parsed = createGroupMembershipSchema.safeParse({
    group_id: rawGroupId,
    phoneme_id: rawPhonemeId,
  });
  if (!parsed.success) {
    return {
      ok: false,
      kind: 'validation',
      issues: z.treeifyError(parsed.error),
    };
  }

  const lang = await db.query.languages.findFirst({
    where: and(eq(languages.id, parsedId.data), eq(languages.user_id, user.id)),
  });
  if (!lang) return { ok: false, kind: 'not_found' };

  const [phoneme, group] = await Promise.all([
    db.query.phonemes.findFirst({
      where: and(
        eq(phonemes.id, parsed.data.phoneme_id),
        eq(phonemes.language_id, parsedId.data),
      ),
    }),
    db.query.phoneme_groups.findFirst({
      where: and(
        eq(phoneme_groups.id, parsed.data.group_id),
        eq(phoneme_groups.language_id, parsedId.data),
      ),
    }),
  ]);
  if (!phoneme || !group) return { ok: false, kind: 'not_found' };

  try {
    const [created] = await db
      .insert(group_memberships)
      .values(parsed.data)
      .returning();

    return { ok: true, data: created };
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      // Postgres unique constraint violation code
      error.code === '23505'
    ) {
      return {
        ok: false,
        kind: 'validation',
        issues: { errors: ['This phoneme already belongs to this group.'] },
      };
    }

    // Re-throw if it's an unexpected database error
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
  const parsedId = uuidSchema.safeParse(rawLanguageId);
  if (!parsedId.success) return { ok: false, kind: 'invalid_id' };

  const parsed = createGroupMembershipSchema.safeParse({
    group_id: rawGroupId,
    phoneme_id: rawPhonemeId,
  });
  if (!parsed.success) {
    return {
      ok: false,
      kind: 'validation',
      issues: z.treeifyError(parsed.error),
    };
  }

  const lang = await db.query.languages.findFirst({
    where: and(eq(languages.id, parsedId.data), eq(languages.user_id, user.id)),
  });
  if (!lang) return { ok: false, kind: 'not_found' };

  const [phoneme, group] = await Promise.all([
    db.query.phonemes.findFirst({
      where: and(
        eq(phonemes.id, parsed.data.phoneme_id),
        eq(phonemes.language_id, parsedId.data),
      ),
    }),
    db.query.phoneme_groups.findFirst({
      where: and(
        eq(phoneme_groups.id, parsed.data.group_id),
        eq(phoneme_groups.language_id, parsedId.data),
      ),
    }),
  ]);
  if (!phoneme || !group) return { ok: false, kind: 'not_found' };

  const [deleted] = await db
    .delete(group_memberships)
    .where(
      and(
        eq(group_memberships.group_id, parsed.data.group_id),
        eq(group_memberships.phoneme_id, parsed.data.phoneme_id),
      ),
    )
    .returning();

  if (!deleted) return { ok: false, kind: 'not_found' };
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
  const parsedId = uuidSchema.safeParse(rawId);
  if (!parsedId.success) return { ok: false, kind: 'invalid_id' };

  const ownedLanguageIds = db
    .select({ id: languages.id })
    .from(languages)
    .where(eq(languages.user_id, user.id));

  const [group] = await db
    .select()
    .from(phoneme_groups)
    .where(
      and(
        eq(phoneme_groups.id, parsedId.data),
        inArray(phoneme_groups.language_id, ownedLanguageIds),
      ),
    )
    .limit(1);
  if (!group) return { ok: false, kind: 'not_found' };

  const { rows } = await db.execute(
    sql`SELECT EXISTS (
      SELECT 1
      FROM syllable_structures, jsonb_array_elements(template) AS slot
      WHERE syllable_structures.language_id = ${group.language_id}
      AND slot->>'groupId' = ${group.id}
    ) AS referenced`,
  );
  if (rows[0].referenced) return { ok: false, kind: 'conflict' };

  const [deleted] = await db
    .delete(phoneme_groups)
    .where(eq(phoneme_groups.id, parsedId.data))
    .returning();

  if (!deleted) return { ok: false, kind: 'not_found' };
  return { ok: true, data: deleted };
}
