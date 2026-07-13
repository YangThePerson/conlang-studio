import { getOrCreateDbUser } from '@/app/lib/current-user';
import { addManualWordSvc, getDictionarySvc } from '@/app/lib/dictionary';

/** Route segment params for language-specific dictionary endpoints. */
type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/languages/[id]/dictionary
 * Returns all lexemes (with senses and tags) for a language owned by the authenticated user.
 * Each row also carries `fits_phonotactics` — whether the term fits the language's syllable
 * templates, computed at read time (null when the language has no templates).
 * Returns 404 if the language doesn't exist or belongs to another user.
 */
export async function GET(_req: Request, { params }: Params) {
  const user = await getOrCreateDbUser();
  if (!user) return new Response(null, { status: 401 });

  const { id } = await params;
  const result = await getDictionarySvc(user, id);

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

  return Response.json(result.data);
}

/**
 * POST /api/languages/[id]/dictionary
 * Manually adds a new lexeme (origin 'manual') for the language owned by the authenticated user.
 * Returns 404 if the language doesn't exist or belongs to another user.
 * Body: `{ term: string; notes?: string }`
 * Returns the created lexeme row with status 201.
 */
export async function POST(req: Request, { params }: Params) {
  const user = await getOrCreateDbUser();
  if (!user) return new Response(null, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const result = await addManualWordSvc(user, id, body);

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
