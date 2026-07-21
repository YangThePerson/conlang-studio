'use client';

import { phonemes } from '@/app/db/schema';
import { PhonemeGroupWithMembers } from '@/app/lib/phoneme-groups';
import { useActionState, useState } from 'react';
import { createGroup, deleteGroup, updateGroup } from './actions';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';

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
        <Input
          name="name"
          placeholder="New Group"
          required
          className="flex-1 font-mono text-lg"
        />
        <Button type="submit" disabled={createPending} className="w-32">
          Add
        </Button>
      </div>
      {createState && !createState.ok && (
        <p className="text-red-400 text-sm">
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
        <Input
          name="name"
          placeholder="Name *"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
          className="w-80 font-mono text-lg text-center"
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
                  className="accent-primary"
                />
                <Label className="w-full font-normal" htmlFor={`phn-${i}`}>
                  {formattedName}
                </Label>
              </div>
            );
          })}
        </section>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending} className="w-32">
          Save
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={cancel}
          className="w-32"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function GroupRow({
  languageId,
  group,
  phonemes,
  canEdit,
}: {
  languageId: string;
  group: PhonemeGroupWithMembers;
  phonemes: Phoneme[];
  canEdit: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);

  const [, deleteAction, deletePending] = useActionState(
    deleteGroup.bind(null, languageId, group.id),
    null,
  );

  // Wrapped (rather than plain-bound) so the row can leave edit mode on
  // success from the event, avoiding a setState-in-effect.
  const [editState, editAction, editPending] = useActionState(
    async (
      prev: Awaited<ReturnType<typeof updateGroup>> | null,
      formData: FormData,
    ) => {
      const result = await updateGroup(languageId, group.id, prev, formData);
      if (result.ok) setIsEditing(false);
      return result;
    },
    null,
  );

  if (isEditing) {
    return (
      <li className="flex flex-row items-center gap-2 rounded-lg border bg-card p-3">
        <EditGroupForm
          formAction={editAction}
          pending={editPending}
          cancel={() => setIsEditing(false)}
          phonemes={phonemes}
          group={group}
        />
        {editState && !editState.ok && (
          <p className="text-red-400 text-sm">
            {editState.kind === 'validation'
              ? 'Invalid input — check name.'
              : 'Something went wrong. Please try again.'}
          </p>
        )}
      </li>
    );
  }

  return (
    <li className="flex flex-row items-center gap-2 rounded-lg border bg-card p-3">
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
      {canEdit && (
        <>
          <Button
            type="button"
            variant="edit"
            disabled={deletePending}
            onClick={() => setIsEditing(true)}
            className="w-32"
          >
            Edit
          </Button>
          <form action={deleteAction}>
            <Button
              type="submit"
              variant="destructive"
              disabled={deletePending}
              className="w-32"
            >
              Delete
            </Button>
          </form>
        </>
      )}
    </li>
  );
}

export default function PhonemeGroupsList({
  languageId,
  groups: initialGroups,
  phonemes,
  canEdit,
}: {
  languageId: string;
  groups: PhonemeGroupWithMembers[];
  phonemes: Phoneme[];
  canEdit: boolean;
}) {
  return (
    <div>
      {canEdit && <AddGroupForm languageId={languageId} />}
      {initialGroups.length === 0 ? (
        <p className="text-muted-foreground">
          No phoneme groups yet. Add one above.
        </p>
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
                canEdit={canEdit}
              />
            ))}
        </ul>
      )}
    </div>
  );
}
