import Link from 'next/link';
import { SignInButton, SignUpButton } from '@clerk/nextjs';
import { getOrCreateDbUser } from '@/app/lib/current-user';

const FEATURES: { label: string; description: string }[] = [
  {
    label: 'Phonemes & Groups',
    description:
      'Define the sound inventory of your language and organize sounds into reusable groups.',
  },
  {
    label: 'Syllable Structures',
    description:
      'Describe the shapes a syllable can take, built from your phoneme groups.',
  },
  {
    label: 'Rules',
    description:
      'Write sound-change rules that transform words as they are generated.',
  },
  {
    label: 'Dictionary',
    description:
      'Track vocabulary with definitions, tags, and word origins.',
  },
  {
    label: 'Word Generator',
    description:
      'Generate new words that follow your syllable structures and rules.',
  },
];

/**
 * Public landing page. Reads the authenticated user (if any) purely to choose
 * the CTA target — signed-in visitors skip straight to their languages instead
 * of being shown sign-up/sign-in buttons.
 */
export default async function Home() {
  const user = await getOrCreateDbUser();

  return (
    <div className="flex flex-col flex-1 items-center">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center gap-12 py-24 px-6">
        <div className="flex flex-col gap-4 items-center text-center">
          <h1 className="text-4xl font-bold">
            Design constructed languages, end to end.
          </h1>
          <p className="text-gray-600 max-w-xl">
            Conlang Studio takes you from a phoneme inventory to generated
            vocabulary — define sounds, syllable shapes, and sound-change
            rules, then generate words that follow them.
          </p>

          {user ? (
            <Link
              href="/languages"
              className="bg-teal-700 text-white px-6 py-3 rounded font-medium"
            >
              Go to your languages
            </Link>
          ) : (
            <div className="flex gap-3">
              <SignUpButton>
                <button className="bg-teal-700 text-white px-6 py-3 rounded font-medium cursor-pointer">
                  Get started
                </button>
              </SignUpButton>
              <SignInButton>
                <button className="border border-gray-300 px-6 py-3 rounded font-medium cursor-pointer">
                  Sign in
                </button>
              </SignInButton>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
          {FEATURES.map(({ label, description }) => (
            <div key={label} className="rounded border p-4">
              <p className="font-semibold">{label}</p>
              <p className="text-sm text-gray-600">{description}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
