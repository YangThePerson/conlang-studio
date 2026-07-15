import { getOrCreateDbUser } from '@/app/lib/current-user';
import { resultResponse } from '@/app/lib/http';
import { moveRuleSvc } from '@/app/lib/rules';

/** Route segment params for the rule move endpoint. */
type Params = { params: Promise<{ id: string; ruleId: string }> };

/**
 * POST /api/languages/[id]/rules/[ruleId]/move
 * Moves a rule one step earlier or later in its language's application order
 * by swapping positions with its nearest neighbor. Moving past the edge is a
 * no-op success. A verb subresource rather than a PATCH field so the PATCH
 * endpoint stays a pure full-replace of rule content.
 * Body: `{ direction: 'up' | 'down' }`.
 * Returns the rule row with its new position.
 */
export async function POST(req: Request, { params }: Params) {
  const user = await getOrCreateDbUser();
  if (!user) return new Response(null, { status: 401 });

  const { ruleId } = await params;
  const body = await req.json();
  const result = await moveRuleSvc(user, ruleId, body);
  return resultResponse(result);
}
