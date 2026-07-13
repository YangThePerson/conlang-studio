import { getOrCreateDbUser } from '@/app/lib/current-user';
import { resultResponse } from '@/app/lib/http';
import {
  deletePhonemeGroupSvc,
  updatePhonemeGroupSvc,
} from '@/app/lib/phoneme-groups';

/** Route segment params for phoneme-specific endpoints. */
type Params = { params: Promise<{ id: string; groupId: string }> };

/**
 * PATCH /api/languages/[id]/phonemes//groups/[groupId]
 * Updates a phoneme group's name and members.
 * Ownership is verified through the language table — the language must belong to the authenticated user.
 * Returns 404 if the group doesn't exist or its language belongs to another user.
 * Body: `{ name: string }`
 */
export async function PATCH(req: Request, { params }: Params) {
  const user = await getOrCreateDbUser();
  if (!user) return new Response(null, { status: 401 });

  const { groupId } = await params;
  const body = await req.json();
  const result = await updatePhonemeGroupSvc(user, groupId, body);
  return resultResponse(result);
}

/**
 * DELETE /api/languages/[id]/phonemes//groups/[groupId]
 * Deletes a phoneme group, verifying ownership through the language table.
 * Returns 404 if the group doesn't exist or its language belongs to another user.
 * Returns 204 on success.
 */
export async function DELETE(_req: Request, { params }: Params) {
  const user = await getOrCreateDbUser();
  if (!user) return new Response(null, { status: 401 });

  const { groupId } = await params;
  const result = await deletePhonemeGroupSvc(user, groupId);
  return resultResponse(result, 204);
}
