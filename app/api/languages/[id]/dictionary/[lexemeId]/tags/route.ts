import { getOrCreateDbUser } from '@/app/lib/current-user';
import { resultResponse } from '@/app/lib/http';
import { attachTagToLexemeSvc } from '@/app/lib/tags';

/** Route segment params for lexeme-tag endpoints. */
type Params = { params: Promise<{ id: string; lexemeId: string }> };

/**
 * POST /api/languages/[id]/dictionary/[lexemeId]/tags
 * Attaches a tag to a lexeme. Ownership is verified through the lexeme →
 * language → user chain and the tag → language → user chain.
 * Returns 404 if the language, lexeme, or tag doesn't exist or belongs to another user.
 * Returns 400 if the lexeme is already tagged with it.
 * Body: `{ tag_id: string }`
 * Returns the created join row with status 201.
 */
export async function POST(req: Request, { params }: Params) {
  const user = await getOrCreateDbUser();
  if (!user) return new Response(null, { status: 401 });

  const { id, lexemeId } = await params;
  const body = await req.json();
  const result = await attachTagToLexemeSvc(user, id, lexemeId, body.tag_id);
  return resultResponse(result, 201);
}
