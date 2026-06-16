import { redirect } from 'next/navigation';
import { getOrCreateDbUser } from '@/app/lib/current-user';
import { listPhonemes } from '@/app/lib/phonemes';

/** Phonemes editor: lists all phonemes for the language and allows adding, editing, and deleting. */
export default async function PhonemesPage({
  params,
}: PageProps<'/languages/[id]/phonemes'>) {
  const { id } = await params;

  const user = await getOrCreateDbUser();
  if (!user) redirect('/sign-in');

  const result = await listPhonemes(user, id);
  if (!result.ok) redirect('/languages');

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Phonemes</h1>
    </div>
  );
}
