'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';

/** Thin client wrapper — next-themes needs a client boundary; RootLayout stays a Server Component. */
export function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      {children}
    </NextThemesProvider>
  );
}
