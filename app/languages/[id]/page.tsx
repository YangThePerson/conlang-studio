import { getOrCreateDbUser } from '@/app/lib/current-user';
import { getLanguageOverviewSvc, listLanguagesSvc } from '@/app/lib/languages';
import { formatRelativeTime } from '@/app/lib/relative-time';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { LanguageOverview } from '@/app/lib/languages';

/** Keys of the numeric count fields in {@link LanguageOverview} — the ones rendered as stat cards. */
type StatKey = {
  [K in keyof LanguageOverview]: LanguageOverview[K] extends number ? K : never;
}[keyof LanguageOverview];

const STAT_CARDS: {
  label: string;
  key: StatKey;
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
 * Overview/dashboard for a language: last-activity line, stat cards linking
 * into each subroute, and the newest dictionary entries. When there are no
 * phonemes yet the grid is replaced by a "start here" prompt — syllable
 * structures, rules, and word generation are all unusable until at least one
 * phoneme exists.
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
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{language.name}</h1>
        <p className="text-sm text-gray-400">
          Last activity: {formatRelativeTime(stats.lastActivityAt)}
        </p>
      </div>

      {stats.phonemeCount === 0 ? (
        <div className="rounded border border-dashed border-gray-600 p-8 text-center">
          <p className="text-gray-400 mb-4">
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
              className="rounded border p-4 hover:bg-gray-800 transition-colors"
            >
              <p className="text-3xl text-gray-500 font-semibold">
                {stats[key]}
              </p>
              <p className="text-sm text-gray-400">{label}</p>
            </Link>
          ))}
        </div>
      )}

      {stats.recentLexemes.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Recently added words</h2>
            <Link
              href={`/languages/${id}/dictionary`}
              className="text-sm text-teal-700 hover:underline"
            >
              View dictionary
            </Link>
          </div>
          <ul className="divide-y rounded border">
            {stats.recentLexemes.map((lexeme) => (
              <li
                key={lexeme.id}
                className="flex items-baseline justify-between p-3"
              >
                <span className="font-medium">{lexeme.term}</span>
                <span className="text-sm text-gray-400">
                  {formatRelativeTime(lexeme.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
