import { getOrCreateDbUser } from '@/app/lib/current-user';
import { resultResponse } from '@/app/lib/http';
import {
  deleteSyllableStructureSvc,
  updateSyllableStructureSvc,
} from '@/app/lib/syllables';

/** Route segment params for phoneme-specific endpoints. */
type Params = { params: Promise<{ id: string; syllableId: string }> };

/**
 * PATCH /api/languages/[id]/syllables/[syllableId]
 * Updates a syllable's weight and/or template.
 * Ownership is verified through the language table — the language must belong to the authenticated user.
 * Returns 404 if the syllable doesn't exist or its language belongs to another user.
 * Body: `{ weight?: number; template?: ({ kind: "group"; groupId: string; optional: boolean; } | { kind: "phoneme"; phonemeId: string; optional: boolean; })[] }`
 */
export async function PATCH(req: Request, { params }: Params) {
  const user = await getOrCreateDbUser();
  if (!user) return new Response(null, { status: 401 });

  const { syllableId } = await params;
  const body = await req.json();
  const result = await updateSyllableStructureSvc(user, syllableId, body);
  return resultResponse(result);
}

/**
 * DELETE /api/languages/[id]/syllables/[syllableId]
 * Deletes a syllable, verifying ownership through the language table.
 * Returns 404 if the syllable doesn't exist or its language belongs to another user.
 * Returns 204 on success.
 */
export async function DELETE(_req: Request, { params }: Params) {
  const user = await getOrCreateDbUser();
  if (!user) return new Response(null, { status: 401 });

  const { syllableId } = await params;
  const result = await deleteSyllableStructureSvc(user, syllableId);
  return resultResponse(result, 204);
}
