import type { Metadata } from 'next';
import { Geist, Geist_Mono, Noto_Sans_Mono } from 'next/font/google';
import Link from 'next/link';
import './globals.css';
import { Button } from '@/app/components/ui/button';
import {
  ClerkProvider,
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from '@clerk/nextjs';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const notoSansMono = Noto_Sans_Mono({
  variable: '--font-noto-sans-mono',
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '700'],
});

export const metadata: Metadata = {
  title: 'Conlang Studio',
  description: 'Design constructed languages, end to end.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${notoSansMono.variable} antialiased flex flex-col min-h-screen`}
      >
        <ClerkProvider>
          <header className="shrink-0 sticky top-0 z-40 flex justify-between items-center p-4 gap-4 h-16 bg-gray-950 text-white border-b">
            <Link href="/" className="font-semibold hover:text-teal-500">
              Conlang Studio
            </Link>
            <div className="flex items-center gap-4">
              <Show when="signed-out">
                <SignInButton />
                <SignUpButton>
                  <Button className="rounded-full">Sign Up</Button>
                </SignUpButton>
              </Show>
              <Show when="signed-in">
                <Link
                  href="/languages"
                  className="text-sm font-medium hover:text-teal-500"
                >
                  Languages
                </Link>
                <UserButton />
              </Show>
            </div>
          </header>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
