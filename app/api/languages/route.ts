import { eq } from 'drizzle-orm';
import { db } from '@/app/db';
import { languages } from '@/app/db/schema';
import { createLanguageInputSchema } from '@/app/db/validation';
import { getOrCreateDbUser } from '@/app/lib/current-user';
import z from 'zod';

/**
 * GET /api/languages
 * Returns all languages owned by the authenticated user.
 */
export async function GET() {
  const user = await getOrCreateDbUser();
  if (!user) return new Response(null, { status: 401 });

  const result = await db
    .select()
    .from(languages)
    .where(eq(languages.user_id, user.id));

  return Response.json(result);
}

/**
 * POST /api/languages
 * Creates a new language for the authenticated user.
 * Body: `{ name: string }`
 * Returns the created language row with status 201.
 */
export async function POST(req: Request) {
  const user = await getOrCreateDbUser();
  if (!user) return new Response(null, { status: 401 });

  const body = await req.json();
  const parsed = createLanguageInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }

  const [created] = await db
    .insert(languages)
    .values({ user_id: user.id, name: parsed.data.name })
    .returning();

  return Response.json(created, { status: 201 });
}
