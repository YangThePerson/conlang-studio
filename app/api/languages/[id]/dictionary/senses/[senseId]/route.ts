import { getOrCreateDbUser } from '@/app/lib/current-user';
import { deleteSenseSvc, updateSenseSvc } from '@/app/lib/dictionary';

/** Route segment params for sense-specific endpoints. */
type Params = { params: Promise<{ id: string; senseId: string }> };

/**
 * PATCH /api/languages/[id]/dictionary/senses/[senseId]
 * Updates a sense's part of speech and definition.
 * Ownership is verified through the sense → lexeme → language → user chain.
 * Returns 404 if the sense doesn't exist or its lexeme's language belongs to another user.
 * Body: `{ part_of_speech: string; definition: string }`
 */
export async function PATCH(req: Request, { params }: Params) {
  const user = await getOrCreateDbUser();
  if (!user) return new Response(null, { status: 401 });

  const { senseId } = await params;
  const body = await req.json();
  const result = await updateSenseSvc(user, senseId, body);

  if (!result.ok) {
    const status = result.kind === 'not_found' ? 404 : 400;
    const issues = result.kind === 'validation' ? result.issues : undefined;
    return Response.json({ error: result.kind, issues }, { status });
  }

  return Response.json(result.data);
}

/**
 * DELETE /api/languages/[id]/dictionary/senses/[senseId]
 * Deletes a sense, verifying ownership through the sense → lexeme → language → user chain.
 * Returns 404 if the sense doesn't exist or its lexeme's language belongs to another user.
 * Returns 204 on success.
 */
export async function DELETE(_req: Request, { params }: Params) {
  const user = await getOrCreateDbUser();
  if (!user) return new Response(null, { status: 401 });

  const { senseId } = await params;
  const result = await deleteSenseSvc(user, senseId);

  if (!result.ok) {
    const status = result.kind === 'not_found' ? 404 : 400;
    return Response.json({ error: result.kind }, { status });
  }

  return new Response(null, { status: 204 });
}
