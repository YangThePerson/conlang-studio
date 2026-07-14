import { getOrCreateDbUser } from '@/app/lib/current-user';
import { resultResponse } from '@/app/lib/http';
import { detachTagFromLexemeSvc } from '@/app/lib/tags';

/** Route segment params for lexeme-tag-specific endpoints. */
type Params = { params: Promise<{ id: string; lexemeId: string; tagId: string }> };

/**
 * DELETE /api/languages/[id]/dictionary/[lexemeId]/tags/[tagId]
 * Detaches a tag from a lexeme. Ownership is verified through the lexeme →
 * language → user chain and the tag → language → user chain.
 * Returns 404 if the language, lexeme, or tag doesn't exist or belongs to
 * another user, or if the tag wasn't attached to the lexeme.
 * Returns 204 on success.
 */
export async function DELETE(_req: Request, { params }: Params) {
  const user = await getOrCreateDbUser();
  if (!user) return new Response(null, { status: 401 });

  const { id, lexemeId, tagId } = await params;
  const result = await detachTagFromLexemeSvc(user, id, lexemeId, tagId);
  return resultResponse(result, 204);
}
