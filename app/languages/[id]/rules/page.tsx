import { getOrCreateDbUser } from '@/app/lib/current-user';
import { listPhonemeGroupsWithMembersSvc } from '@/app/lib/phoneme-groups';
import { listPhonemesSvc } from '@/app/lib/phonemes';
import { listRulesSvc } from '@/app/lib/rules';
import { redirect } from 'next/navigation';

/**
 * Phonological rules page for a language. Fetches phonemes and groups (the
 * rule form's pickers need them) plus the existing rules in application order,
 * then delegates rendering to `RuleList`.
 * Redirects to `/languages` if the language is not found or not owned by the
 * current user.
 */
export default async function RulesPage({
  params,
}: PageProps<'/languages/[id]/rules'>) {
  const { id } = await params;

  const user = await getOrCreateDbUser();
  if (!user) redirect('/sign-in');

  const [phonemesResult, groupsResult, rulesResult] = await Promise.all([
    listPhonemesSvc(user, id),
    listPhonemeGroupsWithMembersSvc(user, id),
    listRulesSvc(user, id),
  ]);
  if (!phonemesResult.ok || !groupsResult.ok || !rulesResult.ok)
    redirect('/languages');

  return (
    <section>
      <h1 className="text-2xl font-semibold mb-6">Rules</h1>
    </section>
  );
}
