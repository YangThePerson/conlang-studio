'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const sections = [
  { label: 'Overview', path: '' },
  { label: 'Phonemes & Groups', path: '/phonemes' },
  { label: 'Syllable Structures', path: '/syllables' },
  { label: 'Rules', path: '/rules' },
  { label: 'Dictionary', path: '/dictionary' },
  { label: 'Word Generator', path: '/wordgen' },
];

export default function SideBar({ languageId }: { languageId: string }) {
  const pathname = usePathname();
  const base = `/languages/${languageId}`;

  return (
    <aside
      className={`
        inset-y-0 left-0 w-64 transform bg-card text-card-foreground border-r shadow-xl
        transition-transform duration-300 ease-in-out
        static translate-x-0 z-auto
      `}
    >
      <nav className="flex flex-col gap-1 p-4">
        {sections.map(({ label, path }) => {
          const href = `${base}${path}`;
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`rounded px-3 py-2 text-sm transition-colors ${
                active
                  ? 'bg-secondary text-secondary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
