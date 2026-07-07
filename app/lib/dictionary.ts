import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { languages, lexemes, senses, tags, users } from '../db/schema';
import {
  addGeneratedLexemeInputSchema,
  createSenseSchema,
  updateLexemeInputSchema,
  updateSenseInputSchema,
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
    with: {
      lexemes: true,
    },
  });
  if (!lang) return { ok: false, kind: 'not_found' };

  if (!lang.lexemes.find(({ id }) => id === parsedInput.data.lexeme_id))
    return { ok: false, kind: 'unauthorized' };

  const [row] = await db.insert(senses).values(parsedInput.data).returning();

  return { ok: true, data: row };
}

/**
 * Subquery of language ids owned by `user`. Not awaited on its own — composed
 * into a WHERE via `inArray` so ownership enforcement stays inside the single
 * UPDATE/DELETE statement rather than a separate read.
 */
function ownedLanguageIds(user: DbUser) {
  return db
    .select({ id: languages.id })
    .from(languages)
    .where(eq(languages.user_id, user.id));
}

/**
 * Subquery of lexeme ids reachable through a language owned by `user` — the
 * lexeme half of the sense → lexeme → language → user ownership chain.
 */
function ownedLexemeIds(user: DbUser) {
  return db
    .select({ id: lexemes.id })
    .from(lexemes)
    .where(inArray(lexemes.language_id, ownedLanguageIds(user)));
}

export async function updateLexemeSvc(
  user: DbUser,
  rawLanguageId: unknown,
  rawInput: unknown,
): Promise<Result<Lexeme>> {
  const parsedId = uuidSchema.safeParse(rawLanguageId);
  if (!parsedId.success) return { ok: false, kind: 'invalid_id' };

  const parsedInput = updateLexemeInputSchema.safeParse(rawInput);
  if (!parsedInput.success)
    return {
      ok: false,
      kind: 'validation',
      issues: z.treeifyError(parsedInput.error),
    };

  const [updated] = await db
    .update(lexemes)
    .set(parsedInput.data)
    .where(
      and(
        eq(lexemes.id, parsedId.data),
        inArray(lexemes.language_id, ownedLanguageIds(user)),
      ),
    )
    .returning();

  if (!updated) return { ok: false, kind: 'not_found' };
  return { ok: true, data: updated };
}

export async function deleteLexemeSvc(
  user: DbUser,
  rawId: unknown,
): Promise<Result<Lexeme>> {
  const parsedId = uuidSchema.safeParse(rawId);
  if (!parsedId.success) return { ok: false, kind: 'invalid_id' };

  const [deleted] = await db
    .delete(lexemes)
    .where(
      and(
        eq(lexemes.id, parsedId.data),
        inArray(lexemes.language_id, ownedLanguageIds(user)),
      ),
    )
    .returning();

  if (!deleted) return { ok: false, kind: 'not_found' };
  return { ok: true, data: deleted };
}

/**
 * Updates a sense's part of speech and definition, verifying ownership through
 * the full sense → lexeme → language → user chain inside the UPDATE's WHERE.
 * A well-formed sense id belonging to another user therefore comes back as
 * `not_found`, indistinguishable from an id that matches no row at all.
 */
export async function updateSenseSvc(
  user: DbUser,
  rawSenseId: unknown,
  rawInput: unknown,
): Promise<Result<Sense>> {
  const parsedId = uuidSchema.safeParse(rawSenseId);
  if (!parsedId.success) return { ok: false, kind: 'invalid_id' };

  const parsedInput = updateSenseInputSchema.safeParse(rawInput);
  if (!parsedInput.success)
    return {
      ok: false,
      kind: 'validation',
      issues: z.treeifyError(parsedInput.error),
    };

  const [updated] = await db
    .update(senses)
    .set(parsedInput.data)
    .where(
      and(
        eq(senses.id, parsedId.data),
        inArray(senses.lexeme_id, ownedLexemeIds(user)),
      ),
    )
    .returning();

  if (!updated) return { ok: false, kind: 'not_found' };
  return { ok: true, data: updated };
}

/**
 * Deletes a sense, with the same chained ownership enforcement as
 * `updateSenseSvc`. Deleting the last sense of a lexeme is allowed — the
 * lexeme itself remains, senses are not required.
 */
export async function deleteSenseSvc(
  user: DbUser,
  rawSenseId: unknown,
): Promise<Result<Sense>> {
  const parsedId = uuidSchema.safeParse(rawSenseId);
  if (!parsedId.success) return { ok: false, kind: 'invalid_id' };

  const [deleted] = await db
    .delete(senses)
    .where(
      and(
        eq(senses.id, parsedId.data),
        inArray(senses.lexeme_id, ownedLexemeIds(user)),
      ),
    )
    .returning();

  if (!deleted) return { ok: false, kind: 'not_found' };
  return { ok: true, data: deleted };
}
