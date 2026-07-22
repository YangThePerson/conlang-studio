'use client';

import { tags } from '@/app/db/schema';
import { useActionState, useState } from 'react';
import { createTag, deleteTag, renameTag } from './actions';
import { failureMessage, fieldError } from '@/app/components/action-state';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';

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
        <Label htmlFor="new-tag-name">New tag</Label>
        <Input
          id="new-tag-name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-48"
        />
      </div>
      <Button type="submit" disabled={pending} className="w-24">
        {pending ? 'Adding…' : 'Add Tag'}
      </Button>
      {error && <p className="text-red-400 text-sm w-full">{error}</p>}
    </form>
  );
}

/** One tag row with inline rename and delete — sibling forms, matching `SenseEditRow`. */
function TagRow({
  languageId,
  tag,
  canEdit,
}: {
  languageId: string;
  tag: Tag;
  canEdit: boolean;
}) {
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

  if (!canEdit) return <li className="flex items-center">{tag.name}</li>;

  return (
    <li className="flex flex-wrap items-end gap-3">
      <form action={renameAction} className="flex items-end gap-2 flex-1">
        <div className="flex flex-col gap-1 flex-1 min-w-40">
          <Label htmlFor={`tag-name-${tag.id}`}>Name</Label>
          <Input
            id={`tag-name-${tag.id}`}
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <Button
          type="submit"
          disabled={renamePending || deletePending}
          className="w-24"
        >
          {renamePending ? 'Saving…' : 'Save'}
        </Button>
      </form>
      <form action={deleteAction}>
        <Button
          type="submit"
          variant="destructive"
          disabled={renamePending || deletePending}
          className="w-24"
        >
          Delete
        </Button>
      </form>
      {error && <p className="text-red-400 text-sm w-full">{error}</p>}
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
  canEdit,
}: {
  languageId: string;
  tags: Tag[];
  canEdit: boolean;
}) {
  return (
    <details className="rounded-lg border bg-card p-3">
      <summary className="cursor-pointer font-semibold text-sm">
        Manage tags {tags.length > 0 && `(${tags.length})`}
      </summary>
      <div className="flex flex-col gap-3 mt-3">
        {tags.length > 0 && (
          <ul className="flex flex-col gap-2">
            {tags.map((tag) => (
              <TagRow
                key={tag.id}
                languageId={languageId}
                tag={tag}
                canEdit={canEdit}
              />
            ))}
          </ul>
        )}
        {canEdit && <AddTagForm languageId={languageId} />}
      </div>
    </details>
  );
}
