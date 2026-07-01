import { getOrCreateDbUser } from '@/app/lib/current-user';
import { listSyllableStructuresSvc } from '@/app/lib/syllables';
import { redirect } from 'next/navigation';
import WordGenerationForm from './word-generation-form';

/**
 * Server Component: loads the language's syllable structures and hands them to the
 * client-side generation form.
 */
export default async function WordgenPage({
  params,
}: PageProps<'/languages/[id]/wordgen'>) {
  const { id } = await params;

  const user = await getOrCreateDbUser();
  if (!user) redirect('/sign-in');

  const syllableStructures = await listSyllableStructuresSvc(user, id);
  if (!syllableStructures.ok) redirect('/languages');

  return (
    <WordGenerationForm languageId={id} structures={syllableStructures.data} />
  );
}
