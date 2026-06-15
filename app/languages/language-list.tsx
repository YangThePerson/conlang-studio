'use client';

import { useActionState, useState, useTransition } from 'react';
import Link from 'next/link';
import { createLanguage, updateLanguage, deleteLanguage } from './actions';
import type { languages } from '@/app/db/schema';

type Language = typeof languages.$inferSelect;

/**
 * Single language row: supports inline rename (click name → edit in place) and delete.
 * Extracted so each row can hold its own `useActionState` instance for the delete form.
 */
function LanguageItem({ lang }: { lang: Language }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [, startTransition] = useTransition();
  const [, deleteAction, deletePending] = useActionState(
    deleteLanguage.bind(null, lang.id),
    null,
  );

  function startEdit() {
    setIsEditing(true);
    setEditName(lang.name);
  }

  function commitRename() {
    startTransition(async () => {
      await updateLanguage(lang.id, editName);
      setIsEditing(false);
    });
  }

  return (
    <li className="flex items-center gap-2 p-3 border rounded">
      {isEditing ? (
        <input
          autoFocus
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') setIsEditing(false);
          }}
          onBlur={commitRename}
          className="flex-1 border rounded px-2 py-1"
        />
      ) : (
        <Link href={`/languages/${lang.id}`} className="flex-1 text-left hover:underline">
          {lang.name}
        </Link>
      )}
      <form action={deleteAction}>
        <button
          type="button"
          disabled={isEditing}
          onClick={startEdit}
          className="text-slate-500 enabled:hover:text-slate-700 text-sm px-2 py-1 disabled:opacity-50 cursor-pointer"
        >
          Rename
        </button>
        <button
          type="submit"
          disabled={deletePending}
          className="text-red-500 hover:text-red-700 text-sm px-2 py-1 disabled:opacity-50 cursor-pointer"
        >
          Delete
        </button>
      </form>
    </li>
  );
}

/**
 * Renders the full language management UI: a create form at the top, then a list
 * where each row supports inline rename and delete. All mutations go through Server
 * Actions; `revalidatePath` in each action refreshes the server-rendered list.
 */
export default function LanguageList({
  languages: langs,
}: {
  languages: Language[];
}) {
  const [createState, createAction, createPending] = useActionState(
    createLanguage,
    null,
  );

  return (
    <div>
      <form action={createAction} className="flex flex-col gap-2 mb-6">
        <div className="flex gap-2">
          <input
            name="name"
            placeholder="New language name"
            required
            className="flex-1 border rounded px-3 py-2"
          />
          <button
            type="submit"
            disabled={createPending}
            className="bg-teal-700 text-white px-4 py-2 rounded disabled:opacity-50 cursor-pointer"
          >
            Create
          </button>
        </div>
        {createState && !createState.ok && (
          <p className="text-red-500 text-sm">
            {createState.kind === 'validation'
              ? 'Invalid input — please check the form.'
              : 'Something went wrong. Please try again.'}
          </p>
        )}
      </form>

      {langs.length === 0 ? (
        <p className="text-gray-500">No languages yet. Create one above.</p>
      ) : (
        <ul className="space-y-2">
          {langs.map((lang) => (
            <LanguageItem key={lang.id} lang={lang} />
          ))}
        </ul>
      )}
    </div>
  );
}
