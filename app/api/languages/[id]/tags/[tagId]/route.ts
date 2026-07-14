import { getOrCreateDbUser } from '@/app/lib/current-user';
import { resultResponse } from '@/app/lib/http';
import { deleteTagSvc, updateTagSvc } from '@/app/lib/tags';

/** Route segment params for tag-specific endpoints. */
type Params = { params: Promise<{ id: string; tagId: string }> };

/**
 * PATCH /api/languages/[id]/tags/[tagId]
 * Renames a tag. Ownership is verified through the language table.
 * Returns 404 if the tag doesn't exist or its language belongs to another user.
 * Returns 400 if a tag with the new name already exists in the language.
 * Body: `{ name: string }`
 */
export async function PATCH(req: Request, { params }: Params) {
  const user = await getOrCreateDbUser();
  if (!user) return new Response(null, { status: 401 });

  const { tagId } = await params;
  const body = await req.json();
  const result = await updateTagSvc(user, tagId, body);
  return resultResponse(result);
}

/**
 * DELETE /api/languages/[id]/tags/[tagId]
 * Deletes a tag (its attachments to lexemes cascade), verifying ownership
 * through the language table.
 * Returns 404 if the tag doesn't exist or its language belongs to another user.
 * Returns 204 on success.
 */
export async function DELETE(_req: Request, { params }: Params) {
  const user = await getOrCreateDbUser();
  if (!user) return new Response(null, { status: 401 });

  const { tagId } = await params;
  const result = await deleteTagSvc(user, tagId);
  return resultResponse(result, 204);
}
