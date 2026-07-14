import { getOrCreateDbUser } from '@/app/lib/current-user';
import { resultResponse } from '@/app/lib/http';
import { createTagSvc, listTagsSvc } from '@/app/lib/tags';

/** Route segment params for language-specific tag endpoints. */
type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/languages/[id]/tags
 * Returns all tags for a language owned by the authenticated user, name-sorted.
 * Returns 404 if the language doesn't exist or belongs to another user.
 */
export async function GET(_req: Request, { params }: Params) {
  const user = await getOrCreateDbUser();
  if (!user) return new Response(null, { status: 401 });

  const { id } = await params;
  const result = await listTagsSvc(user, id);
  return resultResponse(result);
}

/**
 * POST /api/languages/[id]/tags
 * Creates a new tag for the language owned by the authenticated user.
 * Returns 404 if the language doesn't exist or belongs to another user.
 * Returns 400 if a tag with the same name already exists in the language.
 * Body: `{ name: string }`
 * Returns the created tag row with status 201.
 */
export async function POST(req: Request, { params }: Params) {
  const user = await getOrCreateDbUser();
  if (!user) return new Response(null, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const result = await createTagSvc(user, id, body);
  return resultResponse(result, 201);
}
