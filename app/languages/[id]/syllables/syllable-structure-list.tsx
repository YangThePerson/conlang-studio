'use client';

import { phonemes, syllable_structures } from '@/app/db/schema';
import type { PhonemeGroupWithMembers } from '@/app/lib/phoneme-groups';
import { useActionState, useEffect, useState } from 'react';
import {
  createSyllableStructure,
  deleteSyllableStructure,
  updateSyllableStructure,
} from './actions';
import { templateSchema } from '@/app/db/json-shapes';
import { z } from 'zod';

type Phoneme = typeof phonemes.$inferSelect;
type SyllableStructure = typeof syllable_structures.$inferSelect;
type SyllableTemplate = z.infer<typeof templateSchema>;
type Slot = SyllableTemplate[number];

/** Gets the name of an item in a syllable template slot. */
function slotLabel(
  slot: Slot,
  phonemeList: Phoneme[],
  groups: PhonemeGroupWithMembers[],
): string {
  if (slot.kind === 'group') {
    return groups.find((g) => g.id === slot.groupId)?.name ?? '?';
  }
  return phonemeList.find((p) => p.id === slot.phonemeId)?.symbol ?? '?';
}

/** Add Syllable Button. Toggles between single button and reusable Add/Edit from. */
function AddSyllableStructureForm({
  languageId: languageId,
  phonemes: phonemes,
  groups: groups,
}: {
  languageId: string;
  phonemes: Phoneme[];
  groups: PhonemeGroupWithMembers[];
}) {
  const [isAdding, setIsAdding] = useState(false);

  const [state, formAction, pending] = useActionState(
    createSyllableStructure.bind(null, languageId),
    null,
  );

  useEffect(() => {
    if (state?.ok) setIsAdding(false);
  }, [state]);

  return (
    <div className="mb-6">
      {isAdding ? (
        <SyllableStructureForm
          formAction={formAction}
          cancel={() => setIsAdding(false)}
          pending={pending}
          mode="Add"
          template={[]}
          initialWeight={1}
          phonemes={phonemes}
          groups={groups}
        />
      ) : (
        <button
          type="submit"
          disabled={pending}
          onClick={() => setIsAdding(true)}
          className="w-60 bg-teal-700 text-white px-4 py-3 rounded disabled:opacity-50 cursor-pointer disabled:cursor-progress"
        >
          Add Syllable Structure
        </button>
      )}
    </div>
  );
}

/** Single syllable row with inline edit (template + weight) and delete. */
function SyllableStructureRow({
  languageId,
  structure,
  phonemes,
  groups,
}: {
  languageId: string;
  structure: SyllableStructure;
  phonemes: Phoneme[];
  groups: PhonemeGroupWithMembers[];
}) {
  const [isEditing, setIsEditing] = useState(false);

  const [, deleteAction, deletePending] = useActionState(
    deleteSyllableStructure.bind(null, languageId, structure.id),
    null,
  );

  const [editState, editAction, editPending] = useActionState(
    updateSyllableStructure.bind(null, languageId, structure.id),
    null,
  );

  useEffect(() => {
    if (editState?.ok) setIsEditing(false);
  }, [editState]);

  if (isEditing)
    return (
      <SyllableStructureForm
        formAction={editAction}
        cancel={() => setIsEditing(false)}
        pending={editPending}
        mode="Edit"
        template={structure.template}
        initialWeight={structure.weight}
        phonemes={phonemes}
        groups={groups}
      />
    );

  return (
    <li className="flex items-center gap-2 p-3 border rounded justify-between">
      <div className="flex clex-row mx-3 w-full">
        <p className="flex-2 font-mono">
          Template:
          {structure.template.map((slot) => {
            const label = slotLabel(slot, phonemes, groups);
            return <span> {slot.optional ? `(${label})` : label}</span>;
          })}
        </p>
        <p className="flex-1 font-mono">Weight: {structure.weight}</p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          disabled={deletePending}
          className="w-32 bg-violet-900 text-white px-4 py-3 rounded disabled:opacity-50 cursor-pointer disabled:cursor-progress"
        >
          Edit
        </button>
        <form action={deleteAction}>
          <button
            type="submit"
            disabled={deletePending}
            className="w-32 bg-red-800 text-white px-4 py-3 rounded disabled:opacity-50 cursor-pointer disabled:cursor-progress"
          >
            Delete
          </button>
        </form>
      </div>
    </li>
  );
}

/** Reusable form for adding and/or editing syllables */
function SyllableStructureForm({
  formAction,
  cancel,
  pending,
  mode,
  template: structure,
  initialWeight,
  phonemes: phonemeList,
  groups,
}: {
  formAction: (payload: FormData) => void;
  cancel: () => void;
  pending: boolean;
  mode: 'Add' | 'Edit';
  template: SyllableTemplate;
  initialWeight: number;
  phonemes: Phoneme[];
  groups: PhonemeGroupWithMembers[];
}) {
  const [template, setTemplate] = useState<SyllableTemplate>([...structure]);
  const [weight, setWeight] = useState(initialWeight);

  // newSelection encodes both kind and id as "kind:uuid" so a single <select> covers both groups and phonemes.
  const initialSelection =
    groups.length > 0
      ? `group:${groups[0].id}`
      : phonemeList.length > 0
        ? `phoneme:${phonemeList[0].id}`
        : '';
  const [newSelection, setNewSelection] = useState(initialSelection);
  const [newOptional, setNewOptional] = useState(false);

  function addSlot() {
    const colonIdx = newSelection.indexOf(':');
    if (colonIdx === -1) return;
    const kind = newSelection.slice(0, colonIdx);
    const id = newSelection.slice(colonIdx + 1);
    if (!id) return;
    const slot: Slot =
      kind === 'group'
        ? { kind: 'group', groupId: id, optional: newOptional }
        : { kind: 'phoneme', phonemeId: id, optional: newOptional };
    setTemplate((prev) => [...prev, slot]);
    setNewOptional(false);
  }

  function removeSlot(idx: number) {
    setTemplate((prev) => prev.filter((_, i) => i !== idx));
  }

  function moveSlot(idx: number, dir: -1 | 1) {
    const next = [...template];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setTemplate(next);
  }

  const hasOptions = groups.length > 0 || phonemeList.length > 0;

  return (
    <form
      action={formAction}
      className="flex flex-col items-end gap-2 p-5 border rounded mb-3"
    >
      <input type="hidden" name="template" value={JSON.stringify(template)} />

      {/* Template slot chips */}
      <div className="flex flex-wrap gap-1 min-h-8 items-center w-full py-3 px-7">
        {template.length === 0 ? (
          <span className="text-sm text-gray-400">
            No slots yet — add one below.
          </span>
        ) : (
          template.map((slot, idx) => {
            const label = slotLabel(slot, phonemeList, groups);
            return (
              <div
                key={idx}
                className="flex items-center gap-0.5 bg-gray-950 border rounded p-4 text-sm font-mono"
              >
                <span>{slot.optional ? `(${label})` : label}</span>
                <button
                  type="button"
                  onClick={() => moveSlot(idx, -1)}
                  disabled={idx === 0}
                  className="px-0.5 text-gray-400 enabled:hover:text-gray-700 disabled:opacity-30 cursor-pointer disabled:cursor-auto"
                  aria-label="Move left"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => moveSlot(idx, 1)}
                  disabled={idx === template.length - 1}
                  className="px-0.5 text-gray-400 enabled:hover:text-gray-700 disabled:opacity-30 cursor-pointer disabled:cursor-auto"
                  aria-label="Move right"
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
            );
          })
        )}
      </div>

      {/* Add slot controls */}
      {hasOptions ? (
        <div className="flex flex-start w-full px-7">
          <div className="flex flex-wrap items-center gap-4">
            <select
              value={newSelection}
              onChange={(e) => setNewSelection(e.target.value)}
              className="border rounded p-3 text-sm bg-gray-900"
            >
              {groups.length > 0 && (
                <optgroup label="Groups">
                  {groups.map((g) => (
                    <option key={g.id} value={`group:${g.id}`}>
                      {g.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {phonemeList.length > 0 && (
                <optgroup label="Phonemes">
                  {phonemeList.map((p) => (
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
                onChange={(e) => setNewOptional(e.target.checked)}
              />
              Optional
            </label>
            <button
              type="button"
              onClick={addSlot}
              disabled={!newSelection}
              className="w-32 bg-gray-600 text-white px-4 py-3 rounded disabled:opacity-50 cursor-pointer"
            >
              + Add slot
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-400">
          Add phonemes or groups to this language before building a template.
        </p>
      )}

      {/* Weight slider */}
      <div className="flex flex-1 flex-col items-center px-5 w-full">
        <input
          id={'weight'}
          name="weight"
          type="range"
          min={0}
          max={2}
          step={0.1}
          value={weight}
          onChange={(e) => setWeight(Number(e.currentTarget.value))}
          className="border rounded mx-3 my-2 w-full accent-violet-500"
        />
        <label htmlFor={'weight'}>Weight: {weight}</label>
      </div>

      {/* Commit or Cancel Changes */}
      <div className="flex flex-row gap-2">
        <button
          type="submit"
          disabled={pending || !template.length}
          className={`w-32 bg-teal-700 text-white px-4 py-3 rounded disabled:opacity-50 enabled:cursor-pointer disabled:${pending ? 'cursor-progress' : 'cursor-auto'}`}
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
 * Client component that renders the full syllable structures UI: an add form and an editable
 * list of existing structures. Receives server-fetched data as props; mutations go through
 * Server Actions which revalidate the page after success.
 */
export default function SyllableStructureList({
  languageId,
  phonemes,
  groups,
  structures: initialStructures,
}: {
  languageId: string;
  phonemes: Phoneme[];
  groups: PhonemeGroupWithMembers[];
  structures: SyllableStructure[];
}) {
  return (
    <div>
      <AddSyllableStructureForm
        languageId={languageId}
        phonemes={phonemes}
        groups={groups}
      />
      {initialStructures.length === 0 ? (
        <p className="text-gray-500">
          No syllable structures yet. Add one above.
        </p>
      ) : (
        <ul className="space-y-2">
          {[...initialStructures].map((s) => (
            <SyllableStructureRow
              key={s.id}
              languageId={languageId}
              structure={s}
              groups={groups}
              phonemes={phonemes}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
