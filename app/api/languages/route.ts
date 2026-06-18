import { getOrCreateDbUser } from '@/app/lib/current-user';
import { listLanguagesSvc, createLanguageSvc } from '@/app/lib/languages';

/**
 * GET /api/languages
 * Returns all languages owned by the authenticated user.
 */
export async function GET() {
  const user = await getOrCreateDbUser();
  if (!user) return new Response(null, { status: 401 });

  const langs = await listLanguagesSvc(user);
  return Response.json(langs);
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
  const result = await createLanguageSvc(user, body);

  if (!result.ok) {
    const issues = result.kind === 'validation' ? result.issues : undefined;
    return Response.json({ error: result.kind, issues }, { status: 400 });
  }

  return Response.json(result.data, { status: 201 });
}
