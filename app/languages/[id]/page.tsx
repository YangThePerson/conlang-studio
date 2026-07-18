import { getOrCreateDbUser } from '@/app/lib/current-user';
import { getLanguageOverviewSvc, listLanguagesSvc } from '@/app/lib/languages';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { LanguageOverview } from '@/app/lib/languages';

const STAT_CARDS: {
  label: string;
  key: keyof LanguageOverview;
  href: string;
}[] = [
  { label: 'Phonemes', key: 'phonemeCount', href: '/phonemes' },
  { label: 'Phoneme Groups', key: 'groupCount', href: '/phonemes' },
  {
    label: 'Syllable Structures',
    key: 'syllableStructureCount',
    href: '/syllables',
  },
  { label: 'Rules', key: 'ruleCount', href: '/rules' },
  { label: 'Dictionary Entries', key: 'lexemeCount', href: '/dictionary' },
  { label: 'Tags', key: 'tagCount', href: '/dictionary' },
];

/**
 * Overview/dashboard for a language: stat cards linking into each subroute,
 * or a "start here" prompt in place of the grid when there are no phonemes
 * yet — syllable structures, rules, and word generation are all unusable
 * until at least one phoneme exists.
 */
export default async function LanguagePage({
  params,
}: PageProps<'/languages/[id]'>) {
  const { id } = await params;

  const user = await getOrCreateDbUser();
  if (!user) redirect('/sign-in');

  const languages = await listLanguagesSvc(user);
  const language = languages.find(({ id: languageId }) => languageId === id);
  if (!language) redirect('/languages');

  const overview = await getLanguageOverviewSvc(user, id);
  if (!overview.ok) redirect('/languages');

  const stats = overview.data;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{language.name}</h1>

      {stats.phonemeCount === 0 ? (
        <div className="rounded border border-dashed border-gray-300 p-8 text-center">
          <p className="text-gray-600 mb-4">
            This language doesn&apos;t have any phonemes yet. Phonemes are the
            building blocks everything else — syllable structures, rules, and
            word generation — depends on.
          </p>
          <Link
            href={`/languages/${id}/phonemes`}
            className="inline-block bg-teal-700 text-white px-4 py-2 rounded"
          >
            Add your first phoneme
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {STAT_CARDS.map(({ label, key, href }) => (
            <Link
              key={label}
              href={`/languages/${id}${href}`}
              className="rounded border p-4 hover:bg-gray-50 transition-colors"
            >
              <p className="text-3xl font-semibold">{stats[key]}</p>
              <p className="text-sm text-gray-600">{label}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
