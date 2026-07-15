import { getOrCreateDbUser } from '@/app/lib/current-user';
import { resultResponse } from '@/app/lib/http';
import { deleteRuleSvc, updateRuleSvc } from '@/app/lib/rules';

/** Route segment params for rule-specific endpoints. */
type Params = { params: Promise<{ id: string; ruleId: string }> };

/**
 * PATCH /api/languages/[id]/rules/[ruleId]
 * Replaces a rule's target, output, and contexts (full replace — `position`
 * is only changed via the move endpoint).
 * Ownership is verified through the language table.
 * Returns 404 if the rule doesn't exist or its language belongs to another user.
 * Body: same shape as the create endpoint.
 */
export async function PATCH(req: Request, { params }: Params) {
  const user = await getOrCreateDbUser();
  if (!user) return new Response(null, { status: 401 });

  const { ruleId } = await params;
  const body = await req.json();
  const result = await updateRuleSvc(user, ruleId, body);
  return resultResponse(result);
}

/**
 * DELETE /api/languages/[id]/rules/[ruleId]
 * Deletes a rule, verifying ownership through the language table. Remaining
 * rules keep their positions (ordering is relative; gaps are fine).
 * Returns 404 if the rule doesn't exist or its language belongs to another user.
 * Returns 204 on success.
 */
export async function DELETE(_req: Request, { params }: Params) {
  const user = await getOrCreateDbUser();
  if (!user) return new Response(null, { status: 401 });

  const { ruleId } = await params;
  const result = await deleteRuleSvc(user, ruleId);
  return resultResponse(result, 204);
}
