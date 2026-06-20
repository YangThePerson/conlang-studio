import { redirect } from 'next/navigation';
import { getOrCreateDbUser } from '@/app/lib/current-user';
import { listPhonemesSvc } from '@/app/lib/phonemes';
import { listPhonemeGroupsWithMembersSvc } from '@/app/lib/phoneme-groups';
import PhonemeList from './phoneme-list';
import PhonemeGroupsList from './phoneme-groups-list';

/** Phonemes editor: lists all phonemes for the language and allows adding, editing, and deleting. */
export default async function PhonemesPage({
  params,
}: PageProps<'/languages/[id]/phonemes'>) {
  const { id } = await params;

  const user = await getOrCreateDbUser();
  if (!user) redirect('/sign-in');

  const phonemesResult = await listPhonemesSvc(user, id);
  if (!phonemesResult.ok) redirect('/languages');

  const groupsResult = await listPhonemeGroupsWithMembersSvc(user, id);
  if (!groupsResult.ok) redirect('/languages');

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h1 className="text-2xl font-semibold mb-6">Phonemes</h1>
        <PhonemeList phonemes={phonemesResult.data} languageId={id} />
      </section>
      <section>
        <h1 className="text-2xl font-semibold mb-6">Groups</h1>
        <PhonemeGroupsList
          languageId={id}
          groups={groupsResult.data}
          phonemes={phonemesResult.data}
        />
      </section>
    </div>
  );
}
