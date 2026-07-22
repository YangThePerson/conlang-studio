/**
 * The slice of an action `Result` the UI needs to render failures. Typed
 * structurally so this client file doesn't import from `app/lib/*`. Lives in
 * `app/components/`, not `app/lib/`, for the same reason as `cn()` in
 * `app/components/utils.ts` — `app/lib/` is server-only and this must be
 * importable from Client Components.
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
 * Extracts the first error message from a validation failure's `issues`
 * regardless of which field it's attached to — for forms with no single
 * field the failure should anchor to (e.g. a rule's target/context slots).
 * Checks top-level `errors` before per-field `properties`, mirroring
 * `z.treeifyError`'s shape (cross-field issues surface at the root).
 */
export function anyFieldError(state: ActionState): string | undefined {
  if (!state || state.ok || state.kind !== 'validation') return undefined;
  const issues = state.issues;
  if (typeof issues === 'string') return issues;
  if (typeof issues !== 'object' || issues === null) return undefined;
  const { errors, properties } = issues as {
    errors?: string[];
    properties?: Record<string, { errors?: string[] } | undefined>;
  };
  if (errors?.length) return errors[0];
  for (const field of Object.values(properties ?? {})) {
    if (field?.errors?.length) return field.errors[0];
  }
  return undefined;
}

/**
 * User-facing message for non-validation failures. Validation failures return
 * undefined here — they are rendered as field-level errors via `fieldError`
 * (or `anyFieldError`).
 */
export function failureMessage(state: ActionState): string | undefined {
  if (!state || state.ok || state.kind === 'validation') return undefined;
  switch (state.kind) {
    case 'unauthorized':
      return 'You must be signed in.';
    case 'not_found':
      return 'Not found — it may have been deleted.';
    case 'conflict':
      return "Can't be changed — it's still in use elsewhere.";
    default:
      return 'Something went wrong. Please try again.';
  }
}
