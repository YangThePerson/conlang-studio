'use client';

import { lexemes, senses, tags } from '@/app/db/schema';
import { useActionState, useState } from 'react';
import {
  addSenseToLexeme,
  createLexeme,
  deleteLexeme,
  deleteSense,
  updateLexeme,
  updateSense,
} from './actions';

type Lexeme = typeof lexemes.$inferSelect;
type Sense = typeof senses.$inferSelect;
type Tag = typeof tags.$inferSelect;

type CompleteLexeme = Lexeme & {
  senses: Sense[];
  tags: Tag[];
};

/**
 * The slice of an action `Result` the UI needs to render failures. Typed
 * structurally so this client file doesn't import from `app/lib/*`.
 */
type ActionState =
  | { ok: true }
  | { ok: false; kind: string; issues?: unknown }
  | null;

/**
 * Extracts the first error message for a field from a validation failure's
 * `issues` (the `z.treeifyError` output). Defensive because `issues` crosses
 * the action boundary typed as `unknown`.
 */
function fieldError(state: ActionState, field: string): string | undefined {
  if (!state || state.ok || state.kind !== 'validation') return undefined;
  if (typeof state.issues !== 'object' || state.issues === null)
    return undefined;
  const { properties } = state.issues as {
    properties?: Record<string, { errors?: string[] } | undefined>;
  };
  return properties?.[field]?.errors?.[0];
}

/**
 * User-facing message for non-validation failures. Validation failures return
 * undefined here — they are rendered as field-level errors via `fieldError`.
 */
function failureMessage(state: ActionState): string | undefined {
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

/**
 * Form for adding a word to the dictionary by hand (origin 'manual', as
 * opposed to banking from the wordgen). Creates the lexeme only — senses are
 * added afterwards through the entry's edit card, keeping every submit a
 * single-table write. Fields are controlled so they can be cleared after a
 * successful add (the new entry appears via revalidation).
 */
function AddLexemeForm({ languageId }: { languageId: string }) {
  const [term, setTerm] = useState('');
  const [notes, setNotes] = useState('');

  // Wraps the action rather than binding it so the fields can be cleared on
  // success right here in the transition — a `useEffect` watching the result
  // would trip react-hooks/set-state-in-effect.
  const [state, formAction, pending] = useActionState(
    async (
      prev: Awaited<ReturnType<typeof createLexeme>> | null,
      formData: FormData,
    ) => {
      const result = await createLexeme(languageId, prev, formData);
      if (result.ok) {
        setTerm('');
        setNotes('');
      }
      return result;
    },
    null,
  );

  const error = failureMessage(state) ?? fieldError(state, 'term');

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="new-term" className="text-sm">
          Term
        </label>
        <input
          id="new-term"
          name="term"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          className="border rounded p-2 font-mono w-40"
        />
      </div>
      <div className="flex flex-col gap-1 flex-1 min-w-48">
        <label htmlFor="new-notes" className="text-sm">
          Notes
        </label>
        <input
          id="new-notes"
          name="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="border rounded p-2"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-32 bg-teal-700 text-white px-3 py-2 rounded disabled:opacity-50 cursor-pointer disabled:cursor-progress"
      >
        {pending ? 'Adding…' : 'Add Word'}
      </button>
      {error && <p className="text-red-500 text-sm w-full">{error}</p>}
    </form>
  );
}

/**
 * The Add Sense form inside the edit card — the only place senses are created,
 * so a sense is never born blank. Fields are controlled so they can be cleared
 * after a successful add (the new sense row appears via revalidation).
 */
function AddSenseForm({
  languageId,
  lexemeId,
  deleteLexemePending,
}: {
  languageId: string;
  lexemeId: string;
  deleteLexemePending: boolean;
}) {
  const [pos, setPos] = useState('');
  const [definition, setDefinition] = useState('');

  // Wraps the action rather than binding it so the fields can be cleared on
  // success right here in the transition — a `useEffect` watching the result
  // would trip react-hooks/set-state-in-effect.
  const [state, formAction, pending] = useActionState(
    async (
      prev: Awaited<ReturnType<typeof addSenseToLexeme>> | null,
      formData: FormData,
    ) => {
      const result = await addSenseToLexeme(
        languageId,
        lexemeId,
        prev,
        formData,
      );
      if (result.ok) {
        setPos('');
        setDefinition('');
      }
      return result;
    },
    null,
  );

  const error = failureMessage(state) ?? fieldError(state, 'definition');

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor={`new-pos-${lexemeId}`} className="text-sm">
          Part of speech
        </label>
        <input
          id={`new-pos-${lexemeId}`}
          name="part_of_speech"
          value={pos}
          onChange={(e) => setPos(e.target.value)}
          className="border rounded p-2 w-40"
        />
      </div>
      <div className="flex flex-col gap-1 flex-1 min-w-48">
        <label htmlFor={`new-definition-${lexemeId}`} className="text-sm">
          Definition
        </label>
        <input
          id={`new-definition-${lexemeId}`}
          name="definition"
          value={definition}
          onChange={(e) => setDefinition(e.target.value)}
          className="border rounded p-2"
        />
      </div>
      <button
        type="submit"
        disabled={pending || deleteLexemePending}
        className="w-32 bg-teal-700 text-white px-3 py-2 rounded disabled:opacity-50 cursor-pointer disabled:cursor-progress"
      >
        {pending ? 'Adding…' : 'Add Sense'}
      </button>
      {error && <p className="text-red-500 text-sm w-full">{error}</p>}
    </form>
  );
}

/**
 * One sense inside the edit card, with inline save and delete. Save and Delete
 * are sibling forms (forms can't nest) laid out on one line, each bound to its
 * own action.
 */
function SenseEditRow({
  languageId,
  sense,
  deleteLexemePending,
}: {
  languageId: string;
  sense: Sense;
  deleteLexemePending: boolean;
}) {
  const [pos, setPos] = useState(sense.part_of_speech);
  const [definition, setDefinition] = useState(sense.definition);

  const [saveState, saveAction, savePending] = useActionState(
    updateSense.bind(null, languageId, sense.id),
    null,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteSense.bind(null, languageId, sense.id),
    null,
  );

  const error =
    failureMessage(saveState) ??
    failureMessage(deleteState) ??
    fieldError(saveState, 'definition');

  return (
    <li className="flex flex-wrap items-end gap-3">
      <form
        action={saveAction}
        className="flex flex-wrap items-end gap-3 flex-1"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor={`pos-${sense.id}`} className="text-sm">
            Part of speech
          </label>
          <input
            id={`pos-${sense.id}`}
            name="part_of_speech"
            value={pos}
            onChange={(e) => setPos(e.target.value)}
            className="border rounded p-2 w-40"
          />
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-48">
          <label htmlFor={`definition-${sense.id}`} className="text-sm">
            Definition
          </label>
          <input
            id={`definition-${sense.id}`}
            name="definition"
            value={definition}
            onChange={(e) => setDefinition(e.target.value)}
            className="border rounded p-2"
          />
        </div>
        <button
          type="submit"
          disabled={savePending || deletePending || deleteLexemePending}
          className="w-24 bg-teal-700 text-white px-3 py-2 rounded disabled:opacity-50 cursor-pointer disabled:cursor-progress"
        >
          {savePending ? 'Saving…' : 'Save'}
        </button>
      </form>
      <form action={deleteAction}>
        <button
          type="submit"
          disabled={savePending || deletePending || deleteLexemePending}
          className="w-24 bg-red-800 text-white px-3 py-2 rounded disabled:opacity-50 cursor-pointer disabled:cursor-progress"
        >
          Delete
        </button>
      </form>
      {error && <p className="text-red-500 text-sm w-full">{error}</p>}
    </li>
  );
}

/**
 * Full edit UI for one dictionary entry, shown in place of its view rows: the
 * lexeme's own fields, each sense with inline save/delete, an Add Sense form,
 * and entry deletion. Saves are granular — each form commits independently so
 * every submit maps to a single service call and no multi-table transaction is
 * needed. Tags are display-only for now; tag editing is a separate feature.
 */
function LexemeEditCard({
  lexeme,
  close,
}: {
  lexeme: CompleteLexeme;
  close: () => void;
}) {
  const [term, setTerm] = useState(lexeme.term);
  const [notes, setNotes] = useState(lexeme.notes ?? '');

  const [saveState, saveAction, savePending] = useActionState(
    updateLexeme.bind(null, lexeme.language_id, lexeme.id),
    null,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteLexeme.bind(null, lexeme.language_id, lexeme.id),
    null,
  );

  const lexemeError =
    failureMessage(saveState) ??
    failureMessage(deleteState) ??
    fieldError(saveState, 'term');

  return (
    <div className="flex flex-col gap-4">
      {/* Lexeme fields */}
      <form action={saveAction} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={`term-${lexeme.id}`} className="text-sm">
            Term
          </label>
          <input
            id={`term-${lexeme.id}`}
            name="term"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            className="border rounded p-2 font-mono w-40"
          />
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-48">
          <label htmlFor={`notes-${lexeme.id}`} className="text-sm">
            Notes
          </label>
          <input
            id={`notes-${lexeme.id}`}
            name="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="border rounded p-2"
          />
        </div>
        <button
          type="submit"
          disabled={savePending || deletePending}
          className="w-24 bg-teal-700 text-white px-3 py-2 rounded disabled:opacity-50 cursor-pointer disabled:cursor-progress"
        >
          {savePending ? 'Saving…' : 'Save'}
        </button>
        {lexemeError && (
          <p className="text-red-500 text-sm w-full">{lexemeError}</p>
        )}
      </form>

      {/* Senses */}
      <div className="flex flex-col gap-2 border-t pt-3">
        <p className="font-semibold text-sm">Senses</p>
        {lexeme.senses.length > 0 && (
          <ul className="flex flex-col gap-2">
            {lexeme.senses.map((sense) => (
              <SenseEditRow
                key={sense.id}
                languageId={lexeme.language_id}
                sense={sense}
                deleteLexemePending={deletePending}
              />
            ))}
          </ul>
        )}
        <AddSenseForm
          languageId={lexeme.language_id}
          lexemeId={lexeme.id}
          deleteLexemePending={deletePending}
        />
      </div>

      {/* Entry-level controls */}
      <div className="flex items-center justify-end gap-2 border-t pt-3">
        <form action={deleteAction}>
          <button
            type="submit"
            disabled={savePending || deletePending}
            className="w-32 bg-red-800 text-white px-3 py-2 rounded disabled:opacity-50 cursor-pointer disabled:cursor-progress"
          >
            Delete Entry
          </button>
        </form>
        <button
          type="button"
          onClick={close}
          disabled={savePending || deletePending}
          className="w-24 bg-gray-600 text-white px-3 py-2 rounded cursor-pointer disabled:opacity-50 disabled:cursor-progress"
        >
          Done
        </button>
      </div>
    </div>
  );
}

/**
 * One dictionary entry. In view mode it renders as a group of table rows: the
 * lexeme's term, notes, and tags span all of its sense rows via `rowSpan`, and
 * each sense contributes a part-of-speech/definition row — sibling `<tr>`s
 * (not a nested table) so the sense columns stay aligned with the shared
 * header. With no senses, a single muted cell spans the sense columns instead
 * of fake placeholder values. Editing swaps the whole group for one full-width
 * row holding the edit card.
 */
function LexemeEntry({
  lexeme,
  isEven,
}: {
  lexeme: CompleteLexeme;
  isEven: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);

  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteLexeme.bind(null, lexeme.language_id, lexeme.id),
    null,
  );

  const deleteError = failureMessage(deleteState);

  if (isEditing)
    return (
      <tr className="border-t">
        <td colSpan={6} className="p-4 text-left">
          <LexemeEditCard lexeme={lexeme} close={() => setIsEditing(false)} />
        </td>
      </tr>
    );

  // The first sense shares a row with the rowSpan-ed lexeme cells; the rest
  // get their own rows.
  const [firstSense, ...restSenses] = lexeme.senses;
  const lexemeRowSpan = Math.max(lexeme.senses.length, 1);

  return (
    <>
      <tr className={'border-t ' + (isEven ? 'bg-zinc-900' : 'bg-zinc-800')}>
        <td rowSpan={lexemeRowSpan} className="py-2 font-mono">
          {lexeme.term}
        </td>
        {firstSense ? (
          <>
            <td className="py-2">{firstSense.part_of_speech || '—'}</td>
            <td className="py-2">{firstSense.definition}</td>
          </>
        ) : (
          <td colSpan={2} className="py-2 text-gray-500 italic">
            No senses yet
          </td>
        )}
        <td rowSpan={lexemeRowSpan} className="py-2">
          {lexeme.notes || '—'}
        </td>
        <td rowSpan={lexemeRowSpan} className="py-2">
          {lexeme.tags.map((tag) => tag.name).join(', ') || '—'}
        </td>
        <td rowSpan={lexemeRowSpan} className="py-2">
          <form className="gap-2 flex flex-wrap" action={deleteAction}>
            <button
              type="button"
              disabled={deletePending}
              onClick={() => setIsEditing(true)}
              className="w-24 bg-violet-900 text-white px-3 py-1 rounded cursor-pointer"
            >
              Edit
            </button>
            <button
              type="submit"
              disabled={deletePending}
              className="w-24 bg-red-800 text-white px-3 py-1 rounded disabled:opacity-50 cursor-pointer disabled:cursor-progress"
            >
              Delete
            </button>
            {deleteError && (
              <p className="text-red-500 text-sm w-full text-left">
                {deleteError}
              </p>
            )}
          </form>
        </td>
      </tr>
      {restSenses.map((sense) => (
        <tr key={sense.id} className={isEven ? 'bg-zinc-900' : 'bg-zinc-800'}>
          <td className="py-2">{sense.part_of_speech || '—'}</td>
          <td className="py-2">{sense.definition}</td>
        </tr>
      ))}
    </>
  );
}

/**
 * Dictionary table: read-only by default, with a per-entry edit mode (matching
 * the phonemes/syllables pages) that exposes lexeme and sense editing,
 * sense creation, and entry deletion. Receives server-fetched data as props;
 * mutations go through Server Actions which revalidate the page on success.
 * `languageId` comes from the page rather than the rows so the Add Word form
 * works when the dictionary is empty.
 */
export default function DictionaryTable({
  languageId,
  dictionary,
}: {
  languageId: string;
  dictionary: CompleteLexeme[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <AddLexemeForm languageId={languageId} />
      {dictionary.length === 0 ? (
        <p className="text-gray-500">
          No words yet — add one above, or bank some from the word generator.
        </p>
      ) : (
        <LexemeTable dictionary={dictionary} />
      )}
    </div>
  );
}

/** The dictionary rows themselves; rendered only when at least one word exists. */
function LexemeTable({ dictionary }: { dictionary: CompleteLexeme[] }) {
  return (
    <table className="w-full border table-fixed wrap-break-word">
      <thead>
        <tr>
          <th scope="col" className="py-1 w-[14%]">
            Term
          </th>
          <th scope="col" className="py-1 w-[12%]">
            Part of Speech
          </th>
          <th scope="col" className="py-1">
            Definition
          </th>
          <th scope="col" className="py-1 w-[16%]">
            Notes
          </th>
          <th scope="col" className="py-1 w-[12%]">
            Tags
          </th>
          <th scope="col" className="py-1 w-56">
            Actions
          </th>
        </tr>
      </thead>
      <tbody className="text-center">
        {dictionary.map((lexeme, i) => (
          <LexemeEntry lexeme={lexeme} key={lexeme.id} isEven={i % 2 === 0} />
        ))}
      </tbody>
    </table>
  );
}
