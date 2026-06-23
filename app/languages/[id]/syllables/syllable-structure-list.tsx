'use client';

import { phonemes, syllable_structures } from '@/app/db/schema';
import type { PhonemeGroupWithMembers } from '@/app/lib/phoneme-groups';

type Phoneme = typeof phonemes.$inferSelect;
type SyllableStructure = typeof syllable_structures.$inferSelect;

function AddSyllableStructureForm({ languageId }: { languageId: string }) {
  return <div></div>;
}

function SyllableStructureRow({
  languageId,
  structure,
  phonemes,
  groups,
}: {
  languageId: string;
  structure: SyllableStructure;
  phonemes: Phoneme[];
  groups: PhonemeGroupWithMembers[];
}) {
  return <div></div>;
}

export default function SyllableStructureList({
  languageId,
  phonemes,
  groups,
  structures: initialStructures,
}: {
  languageId: string;
  phonemes: Phoneme[];
  groups: PhonemeGroupWithMembers[];
  structures: SyllableStructure[];
}) {
  return (
    <div>
      <AddSyllableStructureForm languageId={languageId} />
      {initialStructures.length === 0 ? (
        <p className="text-gray-500">No phonemes yet. Add one above.</p>
      ) : (
        <ul className="space-y-2">
          {[...initialStructures].map((s) => (
            <SyllableStructureRow
              key={s.id}
              languageId={languageId}
              structure={s}
              groups={groups}
              phonemes={phonemes}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
