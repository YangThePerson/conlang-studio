import { and, eq } from 'drizzle-orm';
import { db } from '@/app/db';
import { languages, users } from '@/app/db/schema';
import { createLanguageInputSchema, updateLanguageInputSchema } from '@/app/db/validation';
import { notFound, type Result } from './result';
import { parseUuid, parseInput } from './parse';

type Language = typeof languages.$inferSelect;
type DbUser = typeof users.$inferSelect;

/**
 * Returns all languages owned by the given user.
 */
export async function listLanguagesSvc(user: DbUser): Promise<Language[]> {
  return db.select().from(languages).where(eq(languages.user_id, user.id));
}

/**
 * Creates a new language for the given user from raw client input.
 * `user_id` is injected from `user` — it must not appear in `rawInput`.
 */
export async function createLanguageSvc(
  user: DbUser,
  rawInput: unknown,
): Promise<Result<Language>> {
  const input = parseInput(createLanguageInputSchema, rawInput);
  if (!input.ok) return input;

  const [created] = await db
    .insert(languages)
    .values({ user_id: user.id, name: input.data.name })
    .returning();

  return { ok: true, data: created };
}

/**
 * Updates (renames) a language owned by the given user.
 * Returns `{ ok: false, kind: 'not_found' }` if the language doesn't exist or belongs to another user.
 * `rawId` is the bare UUID from the route segment or action argument — validated here before any DB access.
 */
export async function updateLanguageSvc(
  user: DbUser,
  rawId: unknown,
  rawInput: unknown,
): Promise<Result<Language>> {
  const id = parseUuid(rawId);
  if (!id.ok) return id;

  const input = parseInput(updateLanguageInputSchema, rawInput);
  if (!input.ok) return input;

  const [updated] = await db
    .update(languages)
    .set({ name: input.data.name })
    .where(and(eq(languages.id, id.data), eq(languages.user_id, user.id)))
    .returning();

  if (!updated) return notFound();
  return { ok: true, data: updated };
}

/**
 * Deletes a language owned by the given user and all its cascade-dependent data.
 * Returns `{ ok: false, kind: 'not_found' }` if the language doesn't exist or belongs to another user.
 * `rawId` is the bare UUID from the route segment or action argument — validated here before any DB access.
 */
export async function deleteLanguageSvc(
  user: DbUser,
  rawId: unknown,
): Promise<Result<Language>> {
  const id = parseUuid(rawId);
  if (!id.ok) return id;

  const [deleted] = await db
    .delete(languages)
    .where(and(eq(languages.id, id.data), eq(languages.user_id, user.id)))
    .returning();

  if (!deleted) return notFound();
  return { ok: true, data: deleted };
}
