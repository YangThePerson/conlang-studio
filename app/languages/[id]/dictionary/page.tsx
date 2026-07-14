import { getOrCreateDbUser } from '@/app/lib/current-user';
import { getDictionarySvc } from '@/app/lib/dictionary';
import { listTagsSvc } from '@/app/lib/tags';
import { redirect } from 'next/navigation';
import DictionaryTable from './dictionary-table';

/** Dictionary editor — populated in a future step. */
export default async function DictionaryPage({
  params,
}: PageProps<'/languages/[id]/dictionary'>) {
  const { id } = await params;

  const user = await getOrCreateDbUser();
  if (!user) redirect('/sign-in');

  const [dictionary, allTags] = await Promise.all([
    getDictionarySvc(user, id),
    listTagsSvc(user, id),
  ]);
  if (!dictionary.ok || !allTags.ok) redirect('/languages');

  return (
    <DictionaryTable
      languageId={id}
      dictionary={dictionary.data}
      allTags={allTags.data}
    />
  );
}
