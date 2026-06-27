import { getOrCreateDbUser } from '@/app/lib/current-user';
import {
  createPhonemeGroupSvc,
  listPhonemeGroupsWithMembersSvc,
} from '@/app/lib/phoneme-groups';

/** Route segment params for language-specific phoneme endpoints. */
type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/languages/[id]/phonemes/groups
 * Returns all the phoneme groups with their members in a language owned by the authenticated user.
 * Returns 404 if the language doesn't exist or belongs to another user.
 */
export async function GET(_req: Request, { params }: Params) {
  const user = await getOrCreateDbUser();
  if (!user) return new Response(null, { status: 401 });

  const { id } = await params;
  const result = await listPhonemeGroupsWithMembersSvc(user, id);

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
 * POST /api/languages/[id]/phonemes/groups
 * Creates a new phoneme group for the language owned by the authenticated user.
 * Returns 404 if the language doesn't exist or belongs to another user.
 * Body: `{ name: string }`
 * Returns the created phoneme group row with status 201.
 */
export async function POST(req: Request, { params }: Params) {
  const user = await getOrCreateDbUser();
  if (!user) return new Response(null, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const result = await createPhonemeGroupSvc(user, id, body);

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
