'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const sections = [
  { label: 'Overview', path: '' },
  { label: 'Phonemes & Groups', path: '/phonemes' },
  { label: 'Syllable Structures', path: '/syllables' },
  { label: 'Dictionary', path: '/dictionary' },
  { label: 'Word Generator', path: '/wordgen' },
];

export default function SideBar({ languageId }: { languageId: string }) {
  const pathname = usePathname();
  const base = `/languages/${languageId}`;

  return (
    <aside
      className={`
        fixed inset-y-0 left-0 z-50 w-64 transform bg-gray-900 text-white shadow-xl
        transition-transform duration-300 ease-in-out
        lg:static lg:translate-x-0 lg:z-auto
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
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
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
