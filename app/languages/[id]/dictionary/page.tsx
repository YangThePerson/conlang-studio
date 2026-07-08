import { getOrCreateDbUser } from '@/app/lib/current-user';
import { getDictionarySvc } from '@/app/lib/dictionary';
import { redirect } from 'next/navigation';
import DictionaryTable from './dictionary-table';

/** Dictionary editor — populated in a future step. */
export default async function DictionaryPage({
  params,
}: PageProps<'/languages/[id]/dictionary'>) {
  const { id } = await params;

  const user = await getOrCreateDbUser();
  if (!user) redirect('/sign-in');

  const dictionary = await getDictionarySvc(user, id);
  if (!dictionary.ok) redirect('/languages');

  return <DictionaryTable languageId={id} dictionary={dictionary.data} />;
}
