import Link from 'next/link';
import { SignInButton, SignUpButton } from '@clerk/nextjs';
import { getOrCreateDbUser } from '@/app/lib/current-user';
import { Button } from '@/app/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/app/components/ui/card';

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
          <p className="text-muted-foreground max-w-xl">
            Conlang Studio takes you from a phoneme inventory to generated
            vocabulary — define sounds, syllable shapes, and sound-change
            rules, then generate words that follow them.
          </p>

          {user ? (
            <Button asChild size="lg">
              <Link href="/languages">Go to your languages</Link>
            </Button>
          ) : (
            <div className="flex gap-3">
              <SignUpButton>
                <Button size="lg">Get started</Button>
              </SignUpButton>
              <SignInButton>
                <Button size="lg" variant="outline">
                  Sign in
                </Button>
              </SignInButton>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
          {FEATURES.map(({ label, description }) => (
            <Card key={label} className="p-4 gap-1">
              <CardTitle>{label}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
