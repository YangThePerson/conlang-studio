import { getOrCreateDbUser } from '@/app/lib/current-user';
import { listPhonemeGroupsWithMembersSvc } from '@/app/lib/phoneme-groups';
import { listPhonemesSvc } from '@/app/lib/phonemes';
import { listSyllableStructuresSvc } from '@/app/lib/syllables';
import { redirect } from 'next/navigation';
import SyllableStructureList from './syllable-structure-list';

/** Syllable structures editor — populated in a future step. */
export default async function SyllablesPage({
  params,
}: PageProps<'/languages/[id]/phonemes'>) {
  const { id } = await params;

  const user = await getOrCreateDbUser();
  if (!user) redirect('/sign-in');

  const phonemesResult = await listPhonemesSvc(user, id);
  if (!phonemesResult.ok) redirect('/languages');

  const groupsResult = await listPhonemeGroupsWithMembersSvc(user, id);
  if (!groupsResult.ok) redirect('/languages');

  const syllableStructureesult = await listSyllableStructuresSvc(user, id);
  if (!syllableStructureesult.ok) redirect('/languages');

  return (
    <section>
      <h1 className="text-2xl font-semibold mb-6">Syllables</h1>
      <SyllableStructureList
        languageId={id}
        phonemes={phonemesResult.data}
        groups={groupsResult.data}
        structures={syllableStructureesult.data}
      />
    </section>
  );
}
