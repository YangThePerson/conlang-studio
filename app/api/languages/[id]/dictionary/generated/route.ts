import { getOrCreateDbUser } from '@/app/lib/current-user';
import { addGeneratedWordSvc } from '@/app/lib/dictionary';

/** Route segment params for language-specific dictionary endpoints. */
type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/languages/[id]/dictionary/generated
 * Banks a word produced by the wordgen page into the dictionary as a new lexeme
 * (origin 'generated'). Returns 404 if the language doesn't exist or belongs to another user.
 * Body: `{ term: string }`
 * Returns the created lexeme row with status 201.
 */
export async function POST(req: Request, { params }: Params) {
  const user = await getOrCreateDbUser();
  if (!user) return new Response(null, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const result = await addGeneratedWordSvc(user, id, body);

  if (!result.ok) {
    const status =
      result.kind === 'not_found'
        ? 404
        : result.kind === 'invalid_id'
          ? 400
          : result.kind === 'unauthorized'
            ? 401
            : 400;
    const issues = result.kind === 'validation' ? result.issues : undefined;
    return Response.json({ error: result.kind, issues }, { status });
  }

  return Response.json(result.data, { status: 201 });
}
