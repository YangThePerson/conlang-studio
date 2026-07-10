import { getOrCreateDbUser } from '@/app/lib/current-user';
import { deleteLexemeSvc, updateLexemeSvc } from '@/app/lib/dictionary';

/** Route segment params for lexeme-specific endpoints. */
type Params = { params: Promise<{ id: string; lexemeId: string }> };

/**
 * PATCH /api/languages/[id]/dictionary/[lexemeId]
 * Updates a lexeme's term and/or notes. `origin` cannot be changed via this endpoint.
 * Ownership is verified through the language table — the language must belong to the authenticated user.
 * Returns 404 if the lexeme doesn't exist or its language belongs to another user.
 * Body: `{ term: string; notes?: string }`
 */
export async function PATCH(req: Request, { params }: Params) {
  const user = await getOrCreateDbUser();
  if (!user) return new Response(null, { status: 401 });

  const { lexemeId } = await params;
  const body = await req.json();
  const result = await updateLexemeSvc(user, lexemeId, body);

  if (!result.ok) {
    const status = result.kind === 'not_found' ? 404 : 400;
    const issues = result.kind === 'validation' ? result.issues : undefined;
    return Response.json({ error: result.kind, issues }, { status });
  }

  return Response.json(result.data);
}

/**
 * DELETE /api/languages/[id]/dictionary/[lexemeId]
 * Deletes a lexeme (its senses and tag attachments cascade), verifying ownership
 * through the language table.
 * Returns 404 if the lexeme doesn't exist or its language belongs to another user.
 * Returns 204 on success.
 */
export async function DELETE(_req: Request, { params }: Params) {
  const user = await getOrCreateDbUser();
  if (!user) return new Response(null, { status: 401 });

  const { lexemeId } = await params;
  const result = await deleteLexemeSvc(user, lexemeId);

  if (!result.ok) {
    const status = result.kind === 'not_found' ? 404 : 400;
    return Response.json({ error: result.kind }, { status });
  }

  return new Response(null, { status: 204 });
}
