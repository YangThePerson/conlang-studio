import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { languages, lexemes, senses, tags, users } from '../db/schema';
import {
  addGeneratedLexemeInputSchema,
  createSenseSchema,
  uuidSchema,
} from '../db/validation';
import { Result } from './result';

type Lexeme = typeof lexemes.$inferSelect;
type Sense = typeof senses.$inferSelect;
type Tag = typeof tags.$inferSelect;
type DbUser = typeof users.$inferSelect;

type CompleteLexeme = Lexeme & {
  senses: Sense[];
  tags: Tag[];
};

/**
 * Returns all lexemes for a language including senses and tags, verifying that the language is owned by `user`.
 * Returns `{ ok: false, kind: 'not_found' }` if the language doesn't exist or belongs to another user.
 */
export async function getDictionarySvc(
  user: DbUser,
  rawLanguageId: unknown,
): Promise<Result<CompleteLexeme[]>> {
  const parsedId = uuidSchema.safeParse(rawLanguageId);
  if (!parsedId.success) return { ok: false, kind: 'invalid_id' };

  const lang = await db.query.languages.findFirst({
    where: and(eq(languages.id, parsedId.data), eq(languages.user_id, user.id)),
  });
  if (!lang) return { ok: false, kind: 'not_found' };

  const rows = await db.query.lexemes.findMany({
    where: eq(lexemes.language_id, lang.id),
    with: {
      senses: true,
      tags: { with: { tag: true } },
    },
  });

  return {
    ok: true,
    data: rows.map(({ tags, ...row }, i) => ({
      ...row,
      tags: tags.map(({ tag }) => tag as Tag),
    })),
  };
}

/**
 * Banks a word produced by the wordgen page into the dictionary as a new lexeme,
 * verifying that the language is owned by `user`. `origin` is hardcoded to 'generated'
 * here rather than taken from `rawInput` — this service is specifically the wordgen
 * banking call site referenced in `createLexemeSchema`'s JSDoc; a future manual-entry
 * call site would set 'manual' the same way, not via client input.
 */
export async function addGeneratedWordSvc(
  user: DbUser,
  rawLanguageId: unknown,
  rawInput: unknown,
): Promise<Result<Lexeme>> {
  const parsedId = uuidSchema.safeParse(rawLanguageId);
  if (!parsedId.success) return { ok: false, kind: 'invalid_id' };

  const parsedInput = addGeneratedLexemeInputSchema.safeParse(rawInput);
  if (!parsedInput.success)
    return {
      ok: false,
      kind: 'validation',
      issues: z.treeifyError(parsedInput.error),
    };

  const lang = await db.query.languages.findFirst({
    where: and(eq(languages.id, parsedId.data), eq(languages.user_id, user.id)),
  });
  if (!lang) return { ok: false, kind: 'not_found' };

  const [row] = await db
    .insert(lexemes)
    .values({
      language_id: lang.id,
      term: parsedInput.data.term,
      origin: 'generated',
    })
    .returning();

  return { ok: true, data: row };
}

export async function addSenseToWordSvc(
  user: DbUser,
  rawLanguageId: unknown,
  rawInput: unknown,
): Promise<Result<Sense>> {
  const parsedId = uuidSchema.safeParse(rawLanguageId);
  if (!parsedId.success) return { ok: false, kind: 'invalid_id' };

  const parsedInput = createSenseSchema.safeParse(rawInput);
  if (!parsedInput.success)
    return {
      ok: false,
      kind: 'validation',
      issues: z.treeifyError(parsedInput.error),
    };

  const lang = await db.query.languages.findFirst({
    where: and(eq(languages.id, parsedId.data), eq(languages.user_id, user.id)),
  });
  if (!lang) return { ok: false, kind: 'not_found' };

  const [row] = await db.insert(senses).values(parsedInput.data).returning();

  return { ok: true, data: row };
}
