export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; kind: 'validation'; issues: unknown }
  | { ok: false; kind: 'not_found' }
  | { ok: false; kind: 'unauthorized' }
  | { ok: false; kind: 'invalid_id' }
  | { ok: false; kind: 'conflict' };
