'use client';

import { useActionState, useEffect, useId, useState } from 'react';
import { createPhoneme, updatePhoneme, deletePhoneme } from './actions';
import type { phonemes } from '@/app/db/schema';

type Phoneme = typeof phonemes.$inferSelect;

/** Single phoneme row with inline edit (symbol + weight) and delete. */
function PhonemeRow({
  phoneme,
  languageId,
}: {
  phoneme: Phoneme;
  languageId: string;
}) {
  const [isEditing, setIsEditing] = useState(false);

  const [, deleteAction, deletePending] = useActionState(
    deletePhoneme.bind(null, languageId, phoneme.id),
    null,
  );

  const [editState, editAction, editPending] = useActionState(
    updatePhoneme.bind(null, languageId, phoneme.id),
    null,
  );

  useEffect(() => {
    if (editState?.ok) setIsEditing(false);
  }, [editState]);

  if (isEditing) {
    return (
      <li className="flex flex-col gap-2 p-2 border rounded">
        <PhonemeForm
          mode="Edit"
          formAction={editAction}
          pending={editPending}
          cancel={() => setIsEditing(false)}
          phoneme={phoneme}
        />
        {editState && !editState.ok && (
          <p className="text-red-500 text-sm">
            {editState.kind === 'validation'
              ? 'Invalid input — check symbol and weight.'
              : 'Something went wrong. Please try again.'}
          </p>
        )}
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2 p-3 border rounded">
      <span className="flex-1 font-mono text-lg px-3">
        {'Symbol: ' + phoneme.symbol}
      </span>
      <span className="flex-1 font-mono text-lg px-3">
        {'IPA: ' + (phoneme.ipa ? phoneme.ipa : 'N/A')}
      </span>
      <span className="flex-1 font-mono text-lg px-3">
        {'Weight: ' + phoneme.weight}
      </span>
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
    </li>
  );
}

/** Inline wrapper for form for adding a new phoneme to the language. */
function AddPhonemeForm({ languageId }: { languageId: string }) {
  const [state, formAction, pending] = useActionState(
    createPhoneme.bind(null, languageId),
    null,
  );

  return (
    <div className="mb-6">
      <PhonemeForm mode="Add" formAction={formAction} pending={pending} />
      {state && !state.ok && (
        <p className="text-red-500 text-sm">
          {state.kind === 'validation'
            ? 'Invalid input — check symbol and weight.'
            : state.kind === 'not_found'
              ? 'Language not found.'
              : 'Something went wrong. Please try again.'}
        </p>
      )}
    </div>
  );
}

/**
 * Reusable form for adding and/or editing phonemes
 */
function PhonemeForm({
  formAction,
  pending,
  ...props
}: {
  formAction: (payload: FormData) => void;
  pending: boolean;
} & (
  | { mode: 'Add' }
  | { mode: 'Edit'; phoneme: Phoneme; cancel: () => void }
)) {
  const weightId = useId();
  const [symbol, setSymbol] = useState(
    props.mode === 'Edit' ? props.phoneme.symbol : '',
  );
  const [ipa, setIPA] = useState(
    props.mode === 'Edit' ? props.phoneme.ipa : '',
  );
  const [weight, setWeight] = useState(
    props.mode === 'Edit' ? props.phoneme.weight : 1,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="flex items-center gap-2 px-2">
        <input
          name="symbol"
          placeholder="Symbol *"
          value={symbol}
          onChange={(e) => setSymbol(e.currentTarget.value)}
          required
          className="w-40 border rounded p-3 font-mono text-lg text-center"
        />
        <input
          name="ipa"
          placeholder="IPA"
          value={ipa || ''}
          onChange={(e) => setIPA(e.currentTarget.value)}
          className="w-40 border rounded p-3 font-mono text-lg text-center"
        />
        <div className="flex flex-1 flex-col items-center px-5">
          <input
            id={weightId}
            name="weight"
            type="range"
            min={0}
            max={2}
            step={0.1}
            value={weight}
            onChange={(e) => setWeight(Number(e.currentTarget.value))}
            className="border rounded mx-3 my-2 w-full accent-violet-500"
          />
          <label htmlFor={weightId}>Weight: {weight}</label>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="w-32 bg-teal-700 text-white px-4 py-3 rounded disabled:opacity-50 cursor-pointer disabled:cursor-progress"
        >
          {props.mode === 'Add' ? 'Add' : 'Save'}
        </button>
        {props.mode === 'Edit' && (
          <button
            type="button"
            onClick={props.cancel}
            className="w-32 bg-red-800 text-white px-4 py-3 rounded disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

/**
 * Full phonemes management UI: an add form followed by the phoneme list.
 * Receives the initial list from a Server Component parent; mutations revalidate the route.
 */
export default function PhonemeList({
  phonemes: initialPhonemes,
  languageId,
}: {
  phonemes: Phoneme[];
  languageId: string;
}) {
  return (
    <div>
      <AddPhonemeForm languageId={languageId} />
      {initialPhonemes.length === 0 ? (
        <p className="text-gray-500">No phonemes yet. Add one above.</p>
      ) : (
        <ul className="space-y-2">
          {[...initialPhonemes]
            .sort(({ symbol: sa }, { symbol: sb }) => (sa < sb ? -1 : 1))
            .map((p) => (
              <PhonemeRow key={p.id} phoneme={p} languageId={languageId} />
            ))}
        </ul>
      )}
    </div>
  );
}
