import { getOrCreateDbUser } from '@/app/lib/current-user';
import { addSenseToWordSvc } from '@/app/lib/dictionary';

/** Route segment params for lexeme-sense endpoints. */
type Params = { params: Promise<{ id: string; lexemeId: string }> };

/**
 * POST /api/languages/[id]/dictionary/[lexemeId]/senses
 * Adds a sense (part of speech + definition) to a lexeme.
 * Ownership is verified through the lexeme → language → user chain. `lexemeId`
 * comes from the route segment and always overrides any `lexeme_id` in the
 * body, so a client can't attach a sense to a lexeme other than the one named
 * in the URL.
 * Returns 404 if the language or lexeme doesn't exist or belongs to another user.
 * Body: `{ part_of_speech: string; definition: string }`
 * Returns the created sense row with status 201.
 */
export async function POST(req: Request, { params }: Params) {
  const user = await getOrCreateDbUser();
  if (!user) return new Response(null, { status: 401 });

  const { id, lexemeId } = await params;
  const body = await req.json();
  const result = await addSenseToWordSvc(user, id, {
    ...body,
    lexeme_id: lexemeId,
  });

  if (!result.ok) {
    const status =
      result.kind === 'not_found' ? 404 : result.kind === 'invalid_id' ? 400 : 400;
    const issues = result.kind === 'validation' ? result.issues : undefined;
    return Response.json({ error: result.kind, issues }, { status });
  }

  return Response.json(result.data, { status: 201 });
}
