import { getOrCreateDbUser } from '@/app/lib/current-user';
import { listLanguages } from '@/app/lib/languages';
import LanguageList from './language-list';

/**
 * /languages — lists all languages owned by the authenticated user.
 * Data is fetched via the service layer (no HTTP round-trip); `proxy.ts` guarantees
 * this page is never reached by an unauthenticated request.
 */
export default async function LanguagesPage() {
  const user = await getOrCreateDbUser();
  if (!user) return null;

  const langs = await listLanguages(user);

  return (
    <main className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">My Languages</h1>
      <LanguageList languages={langs} />
    </main>
  );
}
