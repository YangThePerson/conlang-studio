'use client';

import { useEffect, useState, useTransition } from 'react';
import { syllable_structures } from '@/app/db/schema';
import { redirect } from 'next/navigation';
import { addWordToDictionary, generateWords } from './actions';

type SyllableStructure = typeof syllable_structures.$inferSelect;

/**
 * Controls panel for triggering word generation. `setWords`/`setShortfall`/`setPending` are
 * lifted to the parent so `WordPanel` (a sibling, not a child) can render the result — this
 * component only owns the min/max syllable inputs and the pending state of its own transition.
 */
function WordGenControls({
  setWords,
  setShortfall,
  languageId,
  structures,
  setPending,
}: {
  setWords: (words: string[]) => void;
  setShortfall: (shortfall: { got: number; requested: number } | null) => void;
  languageId: string;
  structures: SyllableStructure[];
  setPending: (pending: boolean) => void;
}) {
  const [pending, startGenerating] = useTransition();
  const [minSyllables, setMinSyllables] = useState(1);
  const [maxSyllables, setMaxSyllables] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const generateWordsTransition = () => {
    startGenerating(async () => {
      const result = await generateWords(
        languageId,
        20, // fixed batch size — not yet exposed as a user-facing setting
        structures.map(({ id }) => id),
        minSyllables,
        maxSyllables,
      );

      if (!result.ok) {
        setError(
          result.kind === 'validation'
            ? 'Invalid generation settings — check syllable counts and structures.'
            : result.kind === 'not_found'
              ? 'Language or syllable structures not found.'
              : result.kind === 'unauthorized'
                ? 'You must be signed in to generate words.'
                : 'Something went wrong. Please try again.',
        );
        return;
      }

      setError(null);
      setPending(true);
      const { words, requested } = result.data;
      setWords([...words]);
      setShortfall(
        words.size < requested ? { got: words.size, requested } : null,
      );
    });
  };

  // Mirrors this component's own transition state up to the parent so WordPanel
  // (a sibling, not a descendant of this transition) can show its own pending UI.
  useEffect(() => {
    setPending(pending);
  }, [pending]);

  if (!structures.length)
    return (
      <div className="flex-1 py-4 px-16 flex flex-col justify-center items-center gap-4">
        <p className="text-gray-500">No syllable structures yet.</p>
        <button
          role="link"
          onClick={() => redirect(`/languages/${languageId}/syllables`)}
          className="w-40 bg-gray-600 text-white px-4 py-3 rounded disabled:opacity-50 cursor-pointer"
        >
          Go to Syllables
        </button>
      </div>
    );

  return (
    <form className="flex-1 p-4 flex flex-col gap-2 items-center">
      <label>
        Min Syllables:
        <input
          className="border rounded text-center p-2 w-20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          type="number"
          defaultValue={minSyllables}
          onChange={(e) => setMinSyllables(Number(e.currentTarget.value))}
          min={1}
        />
      </label>
      <label>
        Max Syllables:
        <input
          className="border rounded text-center p-2 w-20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          type="number"
          defaultValue={maxSyllables}
          onChange={(e) => setMaxSyllables(Number(e.currentTarget.value))}
          min={1}
        />
      </label>
      <input
        type="button"
        onClick={generateWordsTransition}
        className="w-40 bg-teal-700 text-white px-4 py-3 rounded disabled:opacity-50 cursor-pointer m-2"
        value={pending ? 'Generating...' : 'Generate'}
        disabled={pending}
      />
      {error && <p className="text-red-500 text-sm">{error}</p>}
    </form>
  );
}

/**
 * Renders the generated word list, or an empty/pending placeholder. `shortfall` is non-null
 * only when `generateWordSvc` returned fewer unique words than requested (phonological space
 * too constrained), and surfaces as a warning above the list rather than an error.
 */
function WordPanel({
  words,
  generationPending,
  shortfall,
  languageId,
}: {
  words: string[];
  generationPending: boolean;
  shortfall: { got: number; requested: number } | null;
  languageId: string;
}) {
  const [addWordPending, addWordTransition] = useTransition();
  const [addedWords, setAddedWords] = useState<Set<string>>(new Set());
  const [addError, setAddError] = useState<string | null>(null);

  const addWord = (word: string) => {
    addWordTransition(async () => {
      const result = await addWordToDictionary(languageId, word);

      if (!result.ok) {
        setAddError(
          result.kind === 'validation'
            ? 'Invalid word.'
            : result.kind === 'not_found'
              ? 'Language not found.'
              : result.kind === 'unauthorized'
                ? 'You must be signed in to add words.'
                : 'Something went wrong. Please try again.',
        );
        return;
      }

      setAddError(null);
      setAddedWords((prev) => new Set(prev).add(word));
    });
  };

  if (!words.length)
    return (
      <div className="flex-2 py-4 px-16 border rounded flex flex-col justify-center items-center gap-4">
        <p className="text-gray-500">No words have been generated yet.</p>
      </div>
    );

  if (generationPending)
    return (
      <div className="flex-2 py-4 px-16 border rounded flex flex-col justify-center items-center gap-4">
        <p className="text-gray-500">Generating words...</p>
      </div>
    );

  return (
    <div className="flex-2 border rounded flex flex-col justify-center items-start gap-2">
      {shortfall && (
        <p className="text-amber-600 text-sm">
          Only generated {shortfall.got} of {shortfall.requested} words — the
          phonological space is too constrained for more unique words.
        </p>
      )}
      {addError && <p className="text-red-500 text-sm">{addError}</p>}
      <ul className="flex flex-1 flex-col font-mono justify-around w-full">
        {words.map((word, i) => {
          const added = addedWords.has(word);
          return (
            <li
              className={`flex flex-1 items-center justify-between hover:bg-zinc-900`}
              key={i}
            >
              <span className="ml-12">{word}</span>
              <button
                onClick={() => addWord(word)}
                title={added ? 'Added to Dictionary' : 'Add to Dictionary'}
                disabled={added || addWordPending}
                className="w-fit h-fit rounded mr-2 bg-teal-700 text-white px-4 disabled:opacity-50 cursor-pointer"
              >
                {added ? '✓' : '+'}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Client Component: word generation UI for a language. Owns the generated-words state so it
 * can be shared between `WordGenControls` (which produces it via a Server Action) and
 * `WordPanel` (which displays it) without either needing direct access to the other.
 */
export default function WordGenerationForm({
  languageId,
  structures,
}: {
  languageId: string;
  structures: SyllableStructure[];
}) {
  const [words, setWords] = useState<string[]>([]);
  const [shortfall, setShortfall] = useState<{
    got: number;
    requested: number;
  } | null>(null);

  const [generatingPending, setGeneratingPending] = useState<boolean>(false);

  return (
    <div className="w-full h-full flex flex-row gap-4">
      <WordGenControls
        languageId={languageId}
        structures={structures}
        setWords={setWords}
        setShortfall={setShortfall}
        setPending={setGeneratingPending}
      />
      <WordPanel
        generationPending={generatingPending}
        words={words}
        shortfall={shortfall}
        languageId={languageId}
      />
    </div>
  );
}
