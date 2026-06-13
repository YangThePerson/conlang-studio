'use client';

import { useState, useTransition } from 'react';
import { createLanguage, renameLanguage, deleteLanguage } from './actions';
import type { languages } from '@/app/db/schema';

type Language = typeof languages.$inferSelect;

/**
 * Renders the full language management UI: a create form at the top, then a list
 * where each row supports inline rename (click name → edit in place) and delete.
 * All mutations go through Server Actions; `revalidatePath` in each action refreshes
 * the server-rendered list automatically.
 */
export default function LanguageList({ languages: langs }: { languages: Language[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [, startTransition] = useTransition();

  /** Enters edit mode for a row, seeding the input with the current name. */
  function startEdit(id: string, name: string) {
    setEditingId(id);
    setEditName(name);
  }

  /** Submits the rename if the input is non-empty, otherwise cancels the edit. */
  function commitRename(id: string) {
    if (!editName.trim()) { setEditingId(null); return; }
    startTransition(async () => {
      await renameLanguage(id, editName);
      setEditingId(null);
    });
  }

  return (
    <div>
      <form action={createLanguage} className="flex gap-2 mb-6">
        <input
          name="name"
          placeholder="New language name"
          required
          className="flex-1 border rounded px-3 py-2"
        />
        <button type="submit" className="bg-purple-700 text-white px-4 py-2 rounded">
          Create
        </button>
      </form>

      {langs.length === 0 ? (
        <p className="text-gray-500">No languages yet. Create one above.</p>
      ) : (
        <ul className="space-y-2">
          {langs.map((lang) => (
            <li key={lang.id} className="flex items-center gap-2 p-3 border rounded">
              {editingId === lang.id ? (
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(lang.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  onBlur={() => commitRename(lang.id)}
                  className="flex-1 border rounded px-2 py-1"
                />
              ) : (
                <button
                  type="button"
                  className="flex-1 text-left hover:text-purple-700"
                  onClick={() => startEdit(lang.id, lang.name)}
                >
                  {lang.name}
                </button>
              )}
              <form action={deleteLanguage.bind(null, lang.id)}>
                <button type="submit" className="text-red-500 hover:text-red-700 text-sm px-2 py-1">
                  Delete
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
