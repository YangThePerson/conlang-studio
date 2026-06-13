import { eq } from 'drizzle-orm';
import { db } from '@/app/db';
import { languages } from '@/app/db/schema';
import { getOrCreateDbUser } from '@/app/lib/current-user';
import LanguageList from './language-list';

/**
 * /languages — lists all languages owned by the authenticated user.
 * Data is fetched directly from the DB (no HTTP round-trip); `proxy.ts` guarantees
 * this page is never reached by an unauthenticated request.
 */
export default async function LanguagesPage() {
  const user = await getOrCreateDbUser();
  if (!user) return null;

  const langs = await db
    .select()
    .from(languages)
    .where(eq(languages.user_id, user.id));

  return (
    <main className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">My Languages</h1>
      <LanguageList languages={langs} />
    </main>
  );
}
