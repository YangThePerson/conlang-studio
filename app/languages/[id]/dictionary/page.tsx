import { getOrCreateDbUser } from '@/app/lib/current-user';
import { getDictionarySvc } from '@/app/lib/dictionary';
import { redirect } from 'next/navigation';

/** Dictionary editor — populated in a future step. */
export default async function DictionaryPage({
  params,
}: PageProps<'/languages/[id]/dictionary'>) {
  const { id } = await params;

  const user = await getOrCreateDbUser();
  if (!user) redirect('/sign-in');

  const lexemes = await getDictionarySvc(user, id);
  if (!lexemes) redirect('/languages');

  return <div />;
}
