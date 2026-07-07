'use client';

import { lexemes, senses, tags } from '@/app/db/schema';
import { useState, useTransition } from 'react';
import { addSenseToLexeme } from './actions';

type Lexeme = typeof lexemes.$inferSelect;
type Sense = typeof senses.$inferSelect;
type Tag = typeof tags.$inferSelect;

type CompleteLexeme = Lexeme & {
  senses: Sense[];
  tags: Tag[];
};

/**
 * One dictionary entry rendered as a group of table rows: the lexeme's term, notes,
 * and tags span all of its sense rows via `rowSpan`, each sense contributes a
 * part-of-speech/definition row, and a trailing full-width row holds the Add Sense
 * button. Rendered as sibling `<tr>`s (not a nested table) so the sense columns stay
 * aligned with the shared header.
 */
function LexemeRow({ lexeme }: { lexeme: CompleteLexeme }) {
  const [pending, startAddSense] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // The first sense shares a row with the rowSpan-ed lexeme cells; the rest get
  // their own rows. With no senses, the lexeme row keeps empty placeholder cells.
  const [firstSense, ...restSenses] = lexeme.senses;
  const lexemeRowSpan = Math.max(lexeme.senses.length, 1);

  const addSense = () => {
    startAddSense(async () => {
      const result = await addSenseToLexeme(lexeme.language_id, lexeme.id);

      if (!result.ok) {
        setError(
          result.kind === 'not_found'
            ? 'Language not found.'
            : result.kind === 'unauthorized'
              ? 'You must be signed in to add a sense.'
              : 'Something went wrong. Please try again.',
        );
        return;
      }

      setError(null);
    });
  };

  return (
    <>
      <tr>
        <td rowSpan={lexemeRowSpan} className="py-1 font-mono">
          {lexeme.term}
        </td>
        <td className="py-1">{firstSense?.part_of_speech || '—'}</td>
        <td className="py-1">{firstSense?.definition || '—'}</td>
        <td rowSpan={lexemeRowSpan} className="py-1">
          {lexeme.notes || '—'}
        </td>
        <td rowSpan={lexemeRowSpan} className="py-1">
          {lexeme.tags.map((tag) => tag.name).join(', ') || '—'}
        </td>
      </tr>
      {restSenses.map((sense) => (
        <tr key={sense.id}>
          <td className="py-1">{sense.part_of_speech || '—'}</td>
          <td className="py-1">{sense.definition || '—'}</td>
        </tr>
      ))}
      <tr>
        <td colSpan={5} className="pb-2">
          <button
            onClick={addSense}
            disabled={pending}
            className="w-full bg-teal-700 text-white rounded disabled:opacity-50 cursor-pointer"
          >
            {pending ? 'Adding…' : 'Add Sense'}
          </button>
          {error && <p className="text-red-500 text-sm">{error}</p>}
        </td>
      </tr>
    </>
  );
}

export default function DictionaryTable({
  dictionary,
}: {
  dictionary: CompleteLexeme[];
}) {
  return (
    <table className="w-full border">
      <thead>
        <tr>
          <th scope="col" className="py-1">
            Term
          </th>
          <th scope="col" className="py-1">
            Part of Speech
          </th>
          <th scope="col" className="py-1">
            Definition
          </th>
          <th scope="col" className="py-1">
            Notes
          </th>
          <th scope="col" className="py-1">
            Tags
          </th>
        </tr>
      </thead>
      <tbody className="text-center">
        {dictionary.map((lexeme) => (
          <LexemeRow lexeme={lexeme} key={lexeme.id} />
        ))}
      </tbody>
    </table>
  );
}
