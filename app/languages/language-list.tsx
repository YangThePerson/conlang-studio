'use client';

import { useActionState, useState, useTransition } from 'react';
import Link from 'next/link';
import { createLanguage, updateLanguage, deleteLanguage } from './actions';
import type { languages } from '@/app/db/schema';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';

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
    <li className="flex items-center gap-2 rounded-lg border bg-card p-3">
      {isEditing ? (
        <Input
          autoFocus
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') setIsEditing(false);
          }}
          onBlur={commitRename}
          className="flex-1 h-8"
        />
      ) : (
        <Link
          href={`/languages/${lang.id}`}
          className="flex-1 text-left hover:underline"
        >
          {lang.name}
        </Link>
      )}
      <form action={deleteAction}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isEditing}
          onClick={startEdit}
          className="text-muted-foreground"
        >
          Rename
        </Button>
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          disabled={deletePending}
          className="text-red-400 hover:text-red-300"
        >
          Delete
        </Button>
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
          <Input
            name="name"
            placeholder="New language name"
            required
            className="flex-1"
          />
          <Button type="submit" disabled={createPending}>
            Create
          </Button>
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
        <p className="text-muted-foreground">No languages yet. Create one above.</p>
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
