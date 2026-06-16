import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/app/db';
import { languages, users } from '@/app/db/schema';
import {
  createLanguageInputSchema,
  updateLanguageInputSchema,
  uuidSchema,
} from '@/app/db/validation';
import { Result } from './result';

type Language = typeof languages.$inferSelect;
type DbUser = typeof users.$inferSelect;

/**
 * Returns all languages owned by the given user.
 */
export async function listLanguages(user: DbUser): Promise<Language[]> {
  return db.select().from(languages).where(eq(languages.user_id, user.id));
}

/**
 * Creates a new language for the given user from raw client input.
 * `user_id` is injected from `user` — it must not appear in `rawInput`.
 */
export async function createLanguage(
  user: DbUser,
  rawInput: unknown,
): Promise<Result<Language>> {
  const parsed = createLanguageInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      kind: 'validation',
      issues: z.treeifyError(parsed.error),
    };
  }

  const [created] = await db
    .insert(languages)
    .values({ user_id: user.id, name: parsed.data.name })
    .returning();

  return { ok: true, data: created };
}

/**
 * Updates (renames) a language owned by the given user.
 * Returns `{ ok: false, kind: 'not_found' }` if the language doesn't exist or belongs to another user.
 * `rawId` is the bare UUID from the route segment or action argument — validated here before any DB access.
 */
export async function updateLanguage(
  user: DbUser,
  rawId: unknown,
  rawInput: unknown,
): Promise<Result<Language>> {
  const parsedId = uuidSchema.safeParse(rawId);
  if (!parsedId.success) return { ok: false, kind: 'invalid_id' };

  const parsed = updateLanguageInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      kind: 'validation',
      issues: z.treeifyError(parsed.error),
    };
  }

  const [updated] = await db
    .update(languages)
    .set({ name: parsed.data.name })
    .where(and(eq(languages.id, parsedId.data), eq(languages.user_id, user.id)))
    .returning();

  if (!updated) return { ok: false, kind: 'not_found' };
  return { ok: true, data: updated };
}

/**
 * Deletes a language owned by the given user and all its cascade-dependent data.
 * Returns `{ ok: false, kind: 'not_found' }` if the language doesn't exist or belongs to another user.
 * `rawId` is the bare UUID from the route segment or action argument — validated here before any DB access.
 */
export async function deleteLanguage(
  user: DbUser,
  rawId: unknown,
): Promise<Result<Language>> {
  const parsedId = uuidSchema.safeParse(rawId);
  if (!parsedId.success) return { ok: false, kind: 'invalid_id' };

  const [deleted] = await db
    .delete(languages)
    .where(and(eq(languages.id, parsedId.data), eq(languages.user_id, user.id)))
    .returning();

  if (!deleted) return { ok: false, kind: 'not_found' };
  return { ok: true, data: deleted };
}
