import { and, eq } from 'drizzle-orm';
import { db } from '@/app/db';
import { languages, phoneme_groups, phonemes, users } from '@/app/db/schema';
import { uuidSchema } from '@/app/db/validation';
import type { Result } from './result';

type Phoneme = typeof phonemes.$inferSelect;
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
