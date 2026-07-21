import { getOrCreateDbUser } from '@/app/lib/current-user';
import { parseAndRequireVisibleLanguage } from '@/app/lib/ownership';
import { listPhonemeGroupsWithMembersSvc } from '@/app/lib/phoneme-groups';
import { listPhonemesSvc } from '@/app/lib/phonemes';
import { listSyllableStructuresSvc } from '@/app/lib/syllables';
import { notFound } from 'next/navigation';
import SyllableStructureList from './syllable-structure-list';

/**
 * Syllable structures page for a language. Fetches phonemes, phoneme groups, and existing
 * syllable structures, then delegates rendering to `SyllableStructureList`.
 * 404s if the language is not found or not visible (neither public nor owned) to the current visitor.
 */
export default async function SyllablesPage({
  params,
}: PageProps<'/languages/[id]/syllables'>) {
  const { id } = await params;

  const user = await getOrCreateDbUser();

  const langResult = await parseAndRequireVisibleLanguage(user, id);
  if (!langResult.ok) notFound();
  const canEdit = user !== null && langResult.data.user_id === user.id;

  const phonemesResult = await listPhonemesSvc(user, id);
  if (!phonemesResult.ok) notFound();

  const groupsResult = await listPhonemeGroupsWithMembersSvc(user, id);
  if (!groupsResult.ok) notFound();

  const syllableStructureesult = await listSyllableStructuresSvc(user, id);
  if (!syllableStructureesult.ok) notFound();

  return (
    <section>
      <h1 className="text-2xl font-semibold mb-6">Syllables</h1>
      <SyllableStructureList
        languageId={id}
        phonemes={phonemesResult.data}
        groups={groupsResult.data}
        structures={syllableStructureesult.data}
        canEdit={canEdit}
      />
    </section>
  );
}
