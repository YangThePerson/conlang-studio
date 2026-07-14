/**
 * The slice of an action `Result` the UI needs to render failures. Typed
 * structurally so this client file doesn't import from `app/lib/*`.
 */
export type ActionState =
  | { ok: true }
  | { ok: false; kind: string; issues?: unknown }
  | null;

/**
 * Extracts the first error message for a field from a validation failure's
 * `issues` (the `z.treeifyError` output). Defensive because `issues` crosses
 * the action boundary typed as `unknown`.
 */
export function fieldError(state: ActionState, field: string): string | undefined {
  if (!state || state.ok || state.kind !== 'validation') return undefined;
  if (typeof state.issues !== 'object' || state.issues === null) return undefined;
  const { properties } = state.issues as {
    properties?: Record<string, { errors?: string[] } | undefined>;
  };
  return properties?.[field]?.errors?.[0];
}

/**
 * User-facing message for non-validation failures. Validation failures return
 * undefined here — they are rendered as field-level errors via `fieldError`.
 */
export function failureMessage(state: ActionState): string | undefined {
  if (!state || state.ok || state.kind === 'validation') return undefined;
  switch (state.kind) {
    case 'unauthorized':
      return 'You must be signed in.';
    case 'not_found':
      return 'Not found — it may have been deleted.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
