import type { Result } from '@/app/lib/result';

/**
 * `Result['kind']` → HTTP status for every failure branch a route handler returns.
 * `conflict` is deliberately `400`, not `409` — see CLAUDE.md "Not yet, but on the radar";
 * change it here (and nowhere else) once that lands.
 */
const STATUS_BY_KIND: Record<Extract<Result<never>, { ok: false }>['kind'], number> = {
  validation: 400,
  invalid_id: 400,
  unauthorized: 401,
  not_found: 404,
  conflict: 400,
};

/** Maps a failed `Result` to the `{ error, issues? }` JSON response every route handler returns for it. */
export function errorResponse(result: Extract<Result<unknown>, { ok: false }>): Response {
  const issues = result.kind === 'validation' ? result.issues : undefined;
  return Response.json({ error: result.kind, issues }, { status: STATUS_BY_KIND[result.kind] });
}

/**
 * Maps a `Result` straight to the `Response` a route handler returns: the shared error
 * shape on failure, or `data` as JSON with `successStatus` (default 200) on success.
 * `successStatus: 204` returns an empty body — for deletes, whose services still return
 * the deleted row so services stay uniform, but the route contract is "no content".
 */
export function resultResponse<T>(result: Result<T>, successStatus = 200): Response {
  if (!result.ok) return errorResponse(result);
  if (successStatus === 204) return new Response(null, { status: 204 });
  return Response.json(result.data, { status: successStatus });
}
