import { getOrCreateDbUser } from '@/app/lib/current-user';
import { removePhonemeFromGroupSvc } from '@/app/lib/phoneme-groups';

/** Route segment params for group membership endpoints. */
type Params = { params: Promise<{ id: string; groupId: string; phonemeId: string }> };

/**
 * DELETE /api/languages/[id]/phonemes/groups/[groupId]/members/[phonemeId]
 * Removes a phoneme from a phoneme group.
 * Ownership is verified through the language table — both the phoneme and group must belong to the authenticated user's language.
 * Returns 404 if the language, phoneme, group, or the membership itself doesn't exist.
 * Returns 204 on success.
 */
export async function DELETE(_req: Request, { params }: Params) {
  const user = await getOrCreateDbUser();
  if (!user) return new Response(null, { status: 401 });

  const { id, groupId, phonemeId } = await params;
  const result = await removePhonemeFromGroupSvc(user, id, phonemeId, groupId);

  if (!result.ok) {
    const status = result.kind === 'not_found' ? 404 : 400;
    return Response.json({ error: result.kind }, { status });
  }

  return new Response(null, { status: 204 });
}
