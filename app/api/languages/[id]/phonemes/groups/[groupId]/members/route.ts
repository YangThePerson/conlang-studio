import { getOrCreateDbUser } from '@/app/lib/current-user';
import { resultResponse } from '@/app/lib/http';
import {
  addPhonemeToGroupSvc,
  getPhonemeMembersInGroupSvc,
} from '@/app/lib/phoneme-groups';

/** Route segment params for group membership endpoints. */
type Params = { params: Promise<{ id: string; groupId: string }> };

/**
 * GET /api/languages/[id]/phonemes/groups/[groupId]/members
 * Returns all the phonemes in a group in a language owned by the authenticated user.
 * Returns 404 if the language doesn't exist or belongs to another user.
 */
export async function GET(_req: Request, { params }: Params) {
  const user = await getOrCreateDbUser();
  if (!user) return new Response(null, { status: 401 });

  const { id, groupId } = await params;
  const result = await getPhonemeMembersInGroupSvc(user, id, groupId);
  return resultResponse(result);
}

/**
 * POST /api/languages/[id]/phonemes/groups/[groupId]/members
 * Adds a phoneme to a phoneme group.
 * Ownership is verified through the language table — both the phoneme and group must belong to the authenticated user's language.
 * Returns 404 if the language, phoneme, or group doesn't exist or belongs to another user.
 * Returns 400 if the phoneme is already a member of the group.
 * Body: `{ phonemeId: string }`
 */
export async function POST(req: Request, { params }: Params) {
  const user = await getOrCreateDbUser();
  if (!user) return new Response(null, { status: 401 });

  const { id, groupId } = await params;
  const body = await req.json();
  const result = await addPhonemeToGroupSvc(user, id, body.phonemeId, groupId);
  return resultResponse(result, 201);
}
