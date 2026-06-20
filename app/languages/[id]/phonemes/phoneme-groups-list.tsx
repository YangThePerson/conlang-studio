'use client';

import { phonemes } from '@/app/db/schema';
import { PhonemeGroupWithMembers } from '@/app/lib/phoneme-groups';
import { useActionState, useEffect, useState } from 'react';
import { createGroup, deleteGroup, updateGroup } from './actions';

type Phoneme = typeof phonemes.$inferSelect;

function formatPhonemePresentation({ symbol, ipa }: Phoneme) {
  return `[ <${symbol}>${ipa?.length ? ` /${ipa}/` : ''} ]`;
}

function AddGroupForm({ languageId }: { languageId: string }) {
  const [createState, createAction, createPending] = useActionState(
    createGroup.bind(null, languageId),
    null,
  );

  return (
    <form action={createAction} className="flex flex-col gap-2 mb-6">
      <div className="flex items-center gap-2 px-2">
        <input
          name="name"
          placeholder="New Group"
          required
          className="flex-1 border rounded p-3 font-mono text-lg"
        />
        <button
          type="submit"
          disabled={createPending}
          className="w-32 bg-teal-700 text-white px-4 py-3 rounded disabled:opacity-50 cursor-pointer disabled:cursor-progress"
        >
          Add
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
  );
}

function EditGroupForm({
  formAction,
  cancel,
  pending,
  phonemes,
  group,
}: {
  formAction: (payload: FormData) => void;
  cancel: () => void;
  pending: boolean;
  phonemes: Phoneme[];
  group: PhonemeGroupWithMembers;
}) {
  const [name, setName] = useState(group.name);

  return (
    <form
      action={formAction}
      className="w-full flex flex-row justify-between items-start"
    >
      {group.members.map((m) => (
        <input key={m.id} type="hidden" name="current_member_id" value={m.id} />
      ))}
      <div className="flex flex-col gap-2">
        <input
          name="name"
          placeholder="Name *"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
          className="w-80 border rounded p-3 font-mono text-lg text-center"
        />
        <section className="grid grid-cols-6">
          {phonemes.map((p, i) => {
            const formattedName = formatPhonemePresentation(p);
            return (
              <div key={p.id} className="w-50 flex items-center p-2 gap-2">
                <input
                  type="checkbox"
                  id={`phn-${i}`}
                  name="phoneme_id"
                  value={p.id}
                  defaultChecked={group.members.some((m) => m.id === p.id)}
                />
                <label className="w-full" htmlFor={`phn-${i}`}>
                  {formattedName}
                </label>
              </div>
            );
          })}
        </section>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="w-32 bg-teal-700 text-white px-4 py-3 rounded disabled:opacity-50 cursor-pointer disabled:cursor-progress"
        >
          Save
        </button>
        <button
          type="button"
          onClick={cancel}
          className="w-32 bg-red-800 text-white px-4 py-3 rounded disabled:opacity-50 cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function GroupRow({
  languageId,
  group,
  phonemes,
}: {
  languageId: string;
  group: PhonemeGroupWithMembers;
  phonemes: Phoneme[];
}) {
  const [isEditing, setIsEditing] = useState(false);

  const [, deleteAction, deletePending] = useActionState(
    deleteGroup.bind(null, languageId, group.id),
    null,
  );

  const [editState, editAction, editPending] = useActionState(
    updateGroup.bind(null, languageId, group.id),
    null,
  );

  useEffect(() => {
    if (editState?.ok) setIsEditing(false);
  }, [editState]);

  if (isEditing) {
    return (
      <li className="flex flex-row items-center gap-2 p-3 border rounded">
        <EditGroupForm
          formAction={editAction}
          pending={editPending}
          cancel={() => setIsEditing(false)}
          phonemes={phonemes}
          group={group}
        />
        {editState && !editState.ok && (
          <p className="text-red-500 text-sm">
            {editState.kind === 'validation'
              ? 'Invalid input — check name.'
              : 'Something went wrong. Please try again.'}
          </p>
        )}
      </li>
    );
  }

  return (
    <li className="flex flex-row items-center gap-2 p-3 border rounded">
      <div className="flex-1 flex flex-row">
        <p className="w-1/4">
          <strong>Name: </strong>
          {group.name}
        </p>
        <p className="w-3/4">
          <strong>Members: </strong>
          {group.members.length
            ? group.members.map(formatPhonemePresentation).join(', ')
            : 'None'}
        </p>
      </div>
      <button
        type="button"
        disabled={deletePending}
        onClick={() => setIsEditing(true)}
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

export default function PhonemeGroupsList({
  languageId,
  groups: initialGroups,
  phonemes,
}: {
  languageId: string;
  groups: PhonemeGroupWithMembers[];
  phonemes: Phoneme[];
}) {
  return (
    <div>
      <AddGroupForm languageId={languageId} />
      {initialGroups.length === 0 ? (
        <p className="text-gray-500">No phoneme groups yet. Add one above.</p>
      ) : (
        <ul className="space-y-2">
          {[...initialGroups]
            .sort(({ name: na }, { name: nb }) => (na < nb ? -1 : 1))
            .map((g) => (
              <GroupRow
                key={g.id}
                group={g}
                languageId={languageId}
                phonemes={phonemes}
              />
            ))}
        </ul>
      )}
    </div>
  );
}
