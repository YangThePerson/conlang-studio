'use client';

import { tags } from '@/app/db/schema';
import { useActionState, useState } from 'react';
import { createTag, deleteTag, renameTag } from './actions';
import { failureMessage, fieldError } from './action-state';

type Tag = typeof tags.$inferSelect;

/**
 * Form for creating a new tag. Controlled so the input can be cleared after a
 * successful add (the new tag appears via revalidation).
 */
function AddTagForm({ languageId }: { languageId: string }) {
  const [name, setName] = useState('');

  const [state, formAction, pending] = useActionState(
    async (
      prev: Awaited<ReturnType<typeof createTag>> | null,
      formData: FormData,
    ) => {
      const result = await createTag(languageId, prev, formData);
      if (result.ok) setName('');
      return result;
    },
    null,
  );

  const error = failureMessage(state) ?? fieldError(state, 'name');

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="new-tag-name" className="text-sm">
          New tag
        </label>
        <input
          id="new-tag-name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border rounded p-2 w-48"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-24 bg-teal-700 text-white px-3 py-2 rounded disabled:opacity-50 cursor-pointer disabled:cursor-progress"
      >
        {pending ? 'Adding…' : 'Add Tag'}
      </button>
      {error && <p className="text-red-500 text-sm w-full">{error}</p>}
    </form>
  );
}

/** One tag row with inline rename and delete — sibling forms, matching `SenseEditRow`. */
function TagRow({ languageId, tag }: { languageId: string; tag: Tag }) {
  const [name, setName] = useState(tag.name);

  const [renameState, renameAction, renamePending] = useActionState(
    renameTag.bind(null, languageId, tag.id),
    null,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteTag.bind(null, languageId, tag.id),
    null,
  );

  const error =
    failureMessage(renameState) ??
    failureMessage(deleteState) ??
    fieldError(renameState, 'name');

  return (
    <li className="flex flex-wrap items-end gap-3">
      <form action={renameAction} className="flex items-end gap-2 flex-1">
        <div className="flex flex-col gap-1 flex-1 min-w-40">
          <label htmlFor={`tag-name-${tag.id}`} className="text-sm">
            Name
          </label>
          <input
            id={`tag-name-${tag.id}`}
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border rounded p-2"
          />
        </div>
        <button
          type="submit"
          disabled={renamePending || deletePending}
          className="w-24 bg-teal-700 text-white px-3 py-2 rounded disabled:opacity-50 cursor-pointer disabled:cursor-progress"
        >
          {renamePending ? 'Saving…' : 'Save'}
        </button>
      </form>
      <form action={deleteAction}>
        <button
          type="submit"
          disabled={renamePending || deletePending}
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
 * Collapsible manager for the language's tags: create, rename, delete.
 * Collapsed by default so it doesn't crowd the dictionary table — tag
 * attach/detach for individual words happens in the lexeme edit card instead.
 */
export default function TagManager({
  languageId,
  tags,
}: {
  languageId: string;
  tags: Tag[];
}) {
  return (
    <details className="border rounded p-3">
      <summary className="cursor-pointer font-semibold text-sm">
        Manage tags {tags.length > 0 && `(${tags.length})`}
      </summary>
      <div className="flex flex-col gap-3 mt-3">
        {tags.length > 0 && (
          <ul className="flex flex-col gap-2">
            {tags.map((tag) => (
              <TagRow key={tag.id} languageId={languageId} tag={tag} />
            ))}
          </ul>
        )}
        <AddTagForm languageId={languageId} />
      </div>
    </details>
  );
}
