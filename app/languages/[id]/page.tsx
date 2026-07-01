import { getOrCreateDbUser } from '@/app/lib/current-user';
import { listLanguagesSvc } from '@/app/lib/languages';
import { redirect } from 'next/navigation';

export default async function LanguagePage({
  params,
}: PageProps<'/languages/[id]'>) {
  const { id } = await params;

  const user = await getOrCreateDbUser();
  if (!user) redirect('/sign-in');

  const languages = await listLanguagesSvc(user);
  if (
    !languages.length ||
    !languages.find(({ id: languageId }) => languageId === id)
  )
    redirect('/languages');

  return <div>{id}</div>;
}
