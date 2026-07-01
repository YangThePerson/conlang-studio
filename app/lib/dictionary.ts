import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { languages, lexemes, users } from '../db/schema';
import { uuidSchema } from '../db/validation';
import { Result } from './result';

type Lexeme = typeof lexemes.$inferSelect;
type DbUser = typeof users.$inferSelect;

/**
 * Returns all lexemes for a language, verifying that the language is owned by `user`.
 * Returns `{ ok: false, kind: 'not_found' }` if the language doesn't exist or belongs to another user.
 */
export async function getDictionarySvc(
  user: DbUser,
  rawLanguageId: unknown,
): Promise<Result<Lexeme[]>> {
  const parsedId = uuidSchema.safeParse(rawLanguageId);
  if (!parsedId.success) return { ok: false, kind: 'invalid_id' };

  const lang = await db.query.languages.findFirst({
    where: and(eq(languages.id, parsedId.data), eq(languages.user_id, user.id)),
  });
  if (!lang) return { ok: false, kind: 'not_found' };

  const rows = await db
    .select()
    .from(lexemes)
    .where(eq(lexemes.language_id, lang.id));

  return { ok: true, data: rows };
}
