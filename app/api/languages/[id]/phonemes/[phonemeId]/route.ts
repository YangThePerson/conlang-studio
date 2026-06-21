import { getOrCreateDbUser } from '@/app/lib/current-user';
import { updatePhonemeSvc, deletePhonemeSvc } from '@/app/lib/phonemes';

/** Route segment params for phoneme-specific endpoints. */
type Params = { params: Promise<{ id: string; phonemeId: string }> };

/**
 * PATCH /api/languages/[id]/phonemes/[phonemeId]
 * Updates a phoneme's symbol, ipa, and/or weight.
 * Ownership is verified through the language table — the language must belong to the authenticated user.
 * Returns 404 if the phoneme doesn't exist or its language belongs to another user.
 * Body: `{ symbol?: string; ipa?: string; weight?: number }`
 */
export async function PATCH(req: Request, { params }: Params) {
  const user = await getOrCreateDbUser();
  if (!user) return new Response(null, { status: 401 });

  const { phonemeId } = await params;
  const body = await req.json();
  const result = await updatePhonemeSvc(user, phonemeId, body);

  if (!result.ok) {
    const status = result.kind === 'not_found' ? 404 : 400;
    const issues = result.kind === 'validation' ? result.issues : undefined;
    return Response.json({ error: result.kind, issues }, { status });
  }

  return Response.json(result.data);
}

/**
 * DELETE /api/languages/[id]/phonemes/[phonemeId]
 * Deletes a phoneme, verifying ownership through the language table.
 * Returns 404 if the phoneme doesn't exist or its language belongs to another user.
 * Returns 204 on success.
 */
export async function DELETE(_req: Request, { params }: Params) {
  const user = await getOrCreateDbUser();
  if (!user) return new Response(null, { status: 401 });

  const { phonemeId } = await params;
  const result = await deletePhonemeSvc(user, phonemeId);

  if (!result.ok) {
    const status = result.kind === 'not_found' ? 404 : 400;
    return Response.json({ error: result.kind }, { status });
  }

  return new Response(null, { status: 204 });
}
