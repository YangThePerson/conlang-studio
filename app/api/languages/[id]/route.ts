import { getOrCreateDbUser } from '@/app/lib/current-user';
import { resultResponse } from '@/app/lib/http';
import { updateLanguageSvc, deleteLanguageSvc } from '@/app/lib/languages';

/** Route segment params for language-specific endpoints. */
type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/languages/[id]
 * Updates a language's name. Returns 404 if the language doesn't exist or belongs to another user.
 * Body: `{ name: string }`
 */
export async function PATCH(req: Request, { params }: Params) {
  const user = await getOrCreateDbUser();
  if (!user) return new Response(null, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const result = await updateLanguageSvc(user, id, body);
  return resultResponse(result);
}

/**
 * DELETE /api/languages/[id]
 * Deletes a language and all its associated data (cascade). Returns 404 if not found or
 * owned by another user. Returns 204 on success.
 */
export async function DELETE(_req: Request, { params }: Params) {
  const user = await getOrCreateDbUser();
  if (!user) return new Response(null, { status: 401 });

  const { id } = await params;
  const result = await deleteLanguageSvc(user, id);
  return resultResponse(result, 204);
}
