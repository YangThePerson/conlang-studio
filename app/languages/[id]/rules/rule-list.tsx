'use client';

import { phonemes as phonemesTable, rules as rulesTable } from '@/app/db/schema';
import type { RuleContext } from '@/app/db/json-shapes';
import type { PhonemeGroupWithMembers } from '@/app/lib/phoneme-groups';
import { formatRule, formatSlot } from '@/app/lib/rule-notation';
import { useActionState, useMemo, useState } from 'react';
import { createRule, deleteRule, moveRule, updateRule } from './actions';
import { failureMessage, type ActionState } from '../dictionary/action-state';

type Phoneme = typeof phonemesTable.$inferSelect;
type Rule = typeof rulesTable.$inferSelect;
type ContextSlot = RuleContext[number];
type TargetKind = 'phoneme' | 'group';

/**
 * One user-facing message for a failed action `Result`. Non-validation kinds
 * go through the shared `failureMessage`; validation failures are summarized
 * from whichever `issues` shape the service produced (a bare message string
 * from `validationMessage`, or `z.treeifyError` output).
 */
function formErrorMessage(state: ActionState): string | undefined {
  if (!state || state.ok) return undefined;
  if (state.kind !== 'validation') return failureMessage(state);
  const issues = state.issues;
  if (typeof issues === 'string') return issues;
  if (typeof issues === 'object' && issues !== null) {
    const { errors, properties } = issues as {
      errors?: string[];
      properties?: Record<string, { errors?: string[] } | undefined>;
    };
    if (errors?.length) return errors[0];
    for (const field of Object.values(properties ?? {})) {
      if (field?.errors?.length) return field.errors[0];
    }
  }
  return 'Some fields are invalid.';
}

/** Add Rule button. Toggles between a single button and the reusable Add/Edit form. */
function AddRuleForm({
  languageId,
  phonemes,
  groups,
  phonemeSymbolById,
  groupNameById,
}: {
  languageId: string;
  phonemes: Phoneme[];
  groups: PhonemeGroupWithMembers[];
  phonemeSymbolById: Map<string, string>;
  groupNameById: Map<string, string>;
}) {
  const [isAdding, setIsAdding] = useState(false);

  // The action is wrapped (rather than plain-bound) so the form can close
  // itself on success from the event, avoiding a setState-in-effect.
  const [state, formAction, pending] = useActionState(
    async (
      prev: Awaited<ReturnType<typeof createRule>> | null,
      formData: FormData,
    ) => {
      const result = await createRule(languageId, prev, formData);
      if (result.ok) setIsAdding(false);
      return result;
    },
    null,
  );

  if (phonemes.length === 0)
    return (
      <p className="mb-6 text-sm text-gray-400">
        Add phonemes to this language before writing rules.
      </p>
    );

  return (
    <div className="mb-6">
      {isAdding ? (
        <RuleForm
          formAction={formAction}
          cancel={() => setIsAdding(false)}
          pending={pending}
          state={state}
          mode="Add"
          initialTargetKind="phoneme"
          initialTargetId={phonemes[0].id}
          initialOutputId={phonemes[0].id}
          initialLeftContext={[]}
          initialRightContext={[]}
          phonemes={phonemes}
          groups={groups}
          phonemeSymbolById={phonemeSymbolById}
          groupNameById={groupNameById}
        />
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => setIsAdding(true)}
          className="w-60 bg-teal-700 text-white px-4 py-3 rounded disabled:opacity-50 cursor-pointer disabled:cursor-progress"
        >
          Add Rule
        </button>
      )}
    </div>
  );
}

/**
 * Single rule row: notation display, ▲/▼ reorder, inline edit, and delete.
 * `isFirst`/`isLast` come from the rendered (position-ordered) list so the
 * edge buttons are disabled instead of firing no-op moves.
 */
function RuleRow({
  languageId,
  rule,
  isFirst,
  isLast,
  phonemes,
  groups,
  phonemeSymbolById,
  groupNameById,
}: {
  languageId: string;
  rule: Rule;
  isFirst: boolean;
  isLast: boolean;
  phonemes: Phoneme[];
  groups: PhonemeGroupWithMembers[];
  phonemeSymbolById: Map<string, string>;
  groupNameById: Map<string, string>;
}) {
  const [isEditing, setIsEditing] = useState(false);

  const [, moveUpAction, moveUpPending] = useActionState(
    moveRule.bind(null, languageId, rule.id, 'up'),
    null,
  );
  const [, moveDownAction, moveDownPending] = useActionState(
    moveRule.bind(null, languageId, rule.id, 'down'),
    null,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteRule.bind(null, languageId, rule.id),
    null,
  );
  // Wrapped (rather than plain-bound) so the row can leave edit mode on
  // success from the event, avoiding a setState-in-effect.
  const [editState, editAction, editPending] = useActionState(
    async (
      prev: Awaited<ReturnType<typeof updateRule>> | null,
      formData: FormData,
    ) => {
      const result = await updateRule(languageId, rule.id, prev, formData);
      if (result.ok) setIsEditing(false);
      return result;
    },
    null,
  );

  const busy = moveUpPending || moveDownPending || deletePending;

  if (isEditing)
    return (
      <RuleForm
        formAction={editAction}
        cancel={() => setIsEditing(false)}
        pending={editPending}
        state={editState}
        mode="Edit"
        initialTargetKind={rule.target_phoneme_id !== null ? 'phoneme' : 'group'}
        initialTargetId={rule.target_phoneme_id ?? rule.target_group_id ?? ''}
        initialOutputId={rule.output_phoneme_id}
        initialLeftContext={rule.left_context}
        initialRightContext={rule.right_context}
        phonemes={phonemes}
        groups={groups}
        phonemeSymbolById={phonemeSymbolById}
        groupNameById={groupNameById}
      />
    );

  return (
    <li className="flex items-center gap-2 p-3 border rounded justify-between">
      <div className="flex items-center gap-3 mx-3 w-full">
        <div className="flex flex-col">
          <form action={moveUpAction}>
            <button
              type="submit"
              disabled={isFirst || busy}
              aria-label="Move rule up"
              className="px-1 text-gray-400 enabled:hover:text-white disabled:opacity-30 cursor-pointer disabled:cursor-auto"
            >
              ▲
            </button>
          </form>
          <form action={moveDownAction}>
            <button
              type="submit"
              disabled={isLast || busy}
              aria-label="Move rule down"
              className="px-1 text-gray-400 enabled:hover:text-white disabled:opacity-30 cursor-pointer disabled:cursor-auto"
            >
              ▼
            </button>
          </form>
        </div>
        <p className="font-mono text-lg">
          {formatRule(rule, phonemeSymbolById, groupNameById)}
        </p>
        {deleteState && !deleteState.ok && (
          <p className="text-sm text-red-400">{formErrorMessage(deleteState)}</p>
        )}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          disabled={busy}
          className="w-32 bg-violet-900 text-white px-4 py-3 rounded disabled:opacity-50 cursor-pointer disabled:cursor-progress"
        >
          Edit
        </button>
        <form action={deleteAction}>
          <button
            type="submit"
            disabled={busy}
            className="w-32 bg-red-800 text-white px-4 py-3 rounded disabled:opacity-50 cursor-pointer disabled:cursor-progress"
          >
            Delete
          </button>
        </form>
      </div>
    </li>
  );
}

/**
 * Editor for one side of a rule's environment. Adapted from the syllable
 * template slot editor with two differences: a word-boundary (`#`) option in
 * the picker, and an empty context is valid ("no restriction on this side").
 */
function ContextEditor({
  label,
  context,
  onChange,
  phonemes,
  groups,
  phonemeSymbolById,
  groupNameById,
}: {
  label: string;
  context: RuleContext;
  onChange: (next: RuleContext) => void;
  phonemes: Phoneme[];
  groups: PhonemeGroupWithMembers[];
  phonemeSymbolById: Map<string, string>;
  groupNameById: Map<string, string>;
}) {
  // newSelection encodes the slot kind and id as "kind:uuid" ("boundary" has
  // no id) so a single <select> covers groups, phonemes, and the boundary.
  const [newSelection, setNewSelection] = useState('boundary');
  const [newOptional, setNewOptional] = useState(false);

  function addSlot() {
    let slot: ContextSlot;
    if (newSelection === 'boundary') {
      slot = { kind: 'boundary' };
    } else {
      const colonIdx = newSelection.indexOf(':');
      if (colonIdx === -1) return;
      const kind = newSelection.slice(0, colonIdx);
      const id = newSelection.slice(colonIdx + 1);
      if (!id) return;
      slot =
        kind === 'group'
          ? { kind: 'group', groupId: id, optional: newOptional }
          : { kind: 'phoneme', phonemeId: id, optional: newOptional };
    }
    onChange([...context, slot]);
    setNewOptional(false);
  }

  function removeSlot(idx: number) {
    onChange(context.filter((_, i) => i !== idx));
  }

  function moveSlot(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= context.length) return;
    const next = [...context];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  }

  return (
    <fieldset className="w-full border rounded p-3">
      <legend className="px-1 text-sm text-gray-300">{label}</legend>

      {/* Slot chips */}
      <div className="flex flex-wrap gap-1 min-h-8 items-center w-full py-2">
        {context.length === 0 ? (
          <span className="text-sm text-gray-400">
            Empty — no restriction on this side.
          </span>
        ) : (
          context.map((slot, idx) => (
            <div
              key={idx}
              className="flex items-center gap-0.5 bg-gray-950 border rounded p-3 text-sm font-mono"
            >
              <span>{formatSlot(slot, phonemeSymbolById, groupNameById)}</span>
              <button
                type="button"
                onClick={() => moveSlot(idx, -1)}
                disabled={idx === 0}
                className="px-0.5 text-gray-400 enabled:hover:text-gray-200 disabled:opacity-30 cursor-pointer disabled:cursor-auto"
                aria-label="Move slot left"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => moveSlot(idx, 1)}
                disabled={idx === context.length - 1}
                className="px-0.5 text-gray-400 enabled:hover:text-gray-200 disabled:opacity-30 cursor-pointer disabled:cursor-auto"
                aria-label="Move slot right"
              >
                →
              </button>
              <button
                type="button"
                onClick={() => removeSlot(idx)}
                className="px-0.5 text-gray-400 hover:text-red-600 cursor-pointer"
                aria-label="Remove slot"
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>

      {/* Add slot controls */}
      <div className="flex flex-wrap items-center gap-4">
        <select
          value={newSelection}
          onChange={(e) => setNewSelection(e.target.value)}
          aria-label={`Add slot to ${label.toLowerCase()}`}
          className="border rounded p-2 text-sm bg-gray-800"
        >
          <option value="boundary"># Word boundary</option>
          {groups.length > 0 && (
            <optgroup label="Groups">
              {groups.map((g) => (
                <option key={g.id} value={`group:${g.id}`}>
                  {g.name}
                </option>
              ))}
            </optgroup>
          )}
          {phonemes.length > 0 && (
            <optgroup label="Phonemes">
              {phonemes.map((p) => (
                <option key={p.id} value={`phoneme:${p.id}`}>
                  {p.symbol}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <label className="flex items-center gap-1 text-sm">
          <input
            type="checkbox"
            checked={newOptional}
            disabled={newSelection === 'boundary'}
            onChange={(e) => setNewOptional(e.target.checked)}
          />
          Optional
        </label>
        <button
          type="button"
          onClick={addSlot}
          className="w-32 bg-gray-600 text-white px-4 py-2 rounded cursor-pointer"
        >
          + Add slot
        </button>
      </div>
    </fieldset>
  );
}

/**
 * Reusable form for adding and editing rules. The two contexts are structured
 * arrays held in local state and shipped as JSON-encoded hidden inputs (the
 * same pattern as the syllable template form); the target picker serializes
 * as a `target_kind` radio + `target_id` select pair that the action
 * translates into the XOR target fields.
 */
function RuleForm({
  formAction,
  cancel,
  pending,
  state,
  mode,
  initialTargetKind,
  initialTargetId,
  initialOutputId,
  initialLeftContext,
  initialRightContext,
  phonemes,
  groups,
  phonemeSymbolById,
  groupNameById,
}: {
  formAction: (payload: FormData) => void;
  cancel: () => void;
  pending: boolean;
  state: ActionState;
  mode: 'Add' | 'Edit';
  initialTargetKind: TargetKind;
  initialTargetId: string;
  initialOutputId: string;
  initialLeftContext: RuleContext;
  initialRightContext: RuleContext;
  phonemes: Phoneme[];
  groups: PhonemeGroupWithMembers[];
  phonemeSymbolById: Map<string, string>;
  groupNameById: Map<string, string>;
}) {
  const [targetKind, setTargetKind] = useState<TargetKind>(initialTargetKind);
  const [targetId, setTargetId] = useState(initialTargetId);
  const [outputId, setOutputId] = useState(initialOutputId);
  const [leftContext, setLeftContext] = useState<RuleContext>([
    ...initialLeftContext,
  ]);
  const [rightContext, setRightContext] = useState<RuleContext>([
    ...initialRightContext,
  ]);

  function switchTargetKind(kind: TargetKind) {
    setTargetKind(kind);
    setTargetId(
      (kind === 'phoneme' ? phonemes[0]?.id : groups[0]?.id) ?? '',
    );
  }

  const targetOptions = targetKind === 'phoneme' ? phonemes : groups;
  const errorMessage = formErrorMessage(state);

  const preview =
    targetId && outputId
      ? formatRule(
          {
            target_phoneme_id: targetKind === 'phoneme' ? targetId : null,
            target_group_id: targetKind === 'group' ? targetId : null,
            output_phoneme_id: outputId,
            left_context: leftContext,
            right_context: rightContext,
          },
          phonemeSymbolById,
          groupNameById,
        )
      : '—';

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 p-5 border rounded mb-3"
    >
      <input
        type="hidden"
        name="left_context"
        value={JSON.stringify(leftContext)}
      />
      <input
        type="hidden"
        name="right_context"
        value={JSON.stringify(rightContext)}
      />

      {/* Target */}
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-sm text-gray-300">Target:</span>
        <label className="flex items-center gap-1 text-sm">
          <input
            type="radio"
            name="target_kind"
            value="phoneme"
            checked={targetKind === 'phoneme'}
            onChange={() => switchTargetKind('phoneme')}
          />
          Phoneme
        </label>
        <label className="flex items-center gap-1 text-sm">
          <input
            type="radio"
            name="target_kind"
            value="group"
            checked={targetKind === 'group'}
            onChange={() => switchTargetKind('group')}
            disabled={groups.length === 0}
          />
          Group
        </label>
        <select
          name="target_id"
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          aria-label="Target"
          className="border rounded p-2 text-sm bg-gray-800"
        >
          {targetOptions.map((t) => (
            <option key={t.id} value={t.id}>
              {'symbol' in t ? t.symbol : t.name}
            </option>
          ))}
        </select>

        <span className="text-sm text-gray-300">becomes</span>
        <select
          name="output_phoneme_id"
          value={outputId}
          onChange={(e) => setOutputId(e.target.value)}
          aria-label="Output phoneme"
          className="border rounded p-2 text-sm bg-gray-800"
        >
          {phonemes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.symbol}
            </option>
          ))}
        </select>
      </div>

      {/* Environment */}
      <ContextEditor
        label="Preceding context (left of target)"
        context={leftContext}
        onChange={setLeftContext}
        phonemes={phonemes}
        groups={groups}
        phonemeSymbolById={phonemeSymbolById}
        groupNameById={groupNameById}
      />
      <ContextEditor
        label="Following context (right of target)"
        context={rightContext}
        onChange={setRightContext}
        phonemes={phonemes}
        groups={groups}
        phonemeSymbolById={phonemeSymbolById}
        groupNameById={groupNameById}
      />

      {/* Live preview */}
      <p className="font-mono text-lg" aria-live="polite">
        Preview: {preview}
      </p>

      {errorMessage && <p className="text-sm text-red-400">{errorMessage}</p>}

      {/* Commit or cancel */}
      <div className="flex flex-row gap-2 self-end">
        <button
          type="submit"
          disabled={pending || !targetId || !outputId}
          className="w-32 bg-teal-700 text-white px-4 py-3 rounded disabled:opacity-50 enabled:cursor-pointer"
        >
          {mode === 'Add' ? 'Add' : 'Save'}
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={pending}
          className="w-32 bg-red-800 text-white px-4 py-3 rounded disabled:opacity-50 cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/**
 * Client component that renders the full rules UI: an add form and the
 * position-ordered, reorderable list of existing rules. Receives
 * server-fetched data as props; mutations go through Server Actions which
 * revalidate the page after success.
 */
export default function RuleList({
  languageId,
  phonemes,
  groups,
  rules,
}: {
  languageId: string;
  phonemes: Phoneme[];
  groups: PhonemeGroupWithMembers[];
  rules: Rule[];
}) {
  const phonemeSymbolById = useMemo(
    () => new Map(phonemes.map((p) => [p.id, p.symbol])),
    [phonemes],
  );
  const groupNameById = useMemo(
    () => new Map(groups.map((g) => [g.id, g.name])),
    [groups],
  );

  return (
    <div>
      <AddRuleForm
        languageId={languageId}
        phonemes={phonemes}
        groups={groups}
        phonemeSymbolById={phonemeSymbolById}
        groupNameById={groupNameById}
      />
      {rules.length === 0 ? (
        <p className="text-gray-400">
          No rules yet. Rules rewrite one sound into another when its
          neighbors match — add one above.
        </p>
      ) : (
        <ul className="space-y-2">
          {rules.map((rule, idx) => (
            <RuleRow
              key={rule.id}
              languageId={languageId}
              rule={rule}
              isFirst={idx === 0}
              isLast={idx === rules.length - 1}
              phonemes={phonemes}
              groups={groups}
              phonemeSymbolById={phonemeSymbolById}
              groupNameById={groupNameById}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
