import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/app/db';
import { languages } from '@/app/db/schema';
import { getOrCreateDbUser } from '@/app/lib/current-user';

/** Route segment params for language-specific endpoints. */
type Params = { params: Promise<{ id: string }> };

const renameSchema = z.object({ name: z.string().min(1) });

/**
 * PATCH /api/languages/[id]
 * Renames a language. Returns 404 if the language doesn't exist or belongs to another user.
 * Body: `{ name: string }`
 */
export async function PATCH(req: Request, { params }: Params) {
  const user = await getOrCreateDbUser();
  if (!user) return new Response(null, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = renameSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }

  const [updated] = await db
    .update(languages)
    .set({ name: parsed.data.name })
    .where(and(eq(languages.id, id), eq(languages.user_id, user.id)))
    .returning();

  if (!updated) return new Response(null, { status: 404 });
  return Response.json(updated);
}

/**
 * DELETE /api/languages/[id]
 * Deletes a language and all its associated data (cascade). Returns 404 if not found or
 * owned by another user. Returns 204 on success.
 */
export async function DELETE(_req: Request, { params }: Params) {
  const user = await getOrCreateDbUser();
  if (!user) return new Response(null, { status: 401 });

  const { id } = await params;

  const [deleted] = await db
    .delete(languages)
    .where(and(eq(languages.id, id), eq(languages.user_id, user.id)))
    .returning();

  if (!deleted) return new Response(null, { status: 404 });
  return new Response(null, { status: 204 });
}
