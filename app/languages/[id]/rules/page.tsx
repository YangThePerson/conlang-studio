import { getOrCreateDbUser } from '@/app/lib/current-user';
import { parseAndRequireVisibleLanguage } from '@/app/lib/ownership';
import { listPhonemeGroupsWithMembersSvc } from '@/app/lib/phoneme-groups';
import { listPhonemesSvc } from '@/app/lib/phonemes';
import { listRulesSvc } from '@/app/lib/rules';
import { notFound } from 'next/navigation';
import RuleList from './rule-list';

/**
 * Phonological rules page for a language. Fetches phonemes and groups (the
 * rule form's pickers need them) plus the existing rules in application order,
 * then delegates rendering to `RuleList`.
 * 404s if the language is not found or not visible (neither public nor owned) to the current visitor.
 */
export default async function RulesPage({
  params,
}: PageProps<'/languages/[id]/rules'>) {
  const { id } = await params;

  const user = await getOrCreateDbUser();

  const langResult = await parseAndRequireVisibleLanguage(user, id);
  if (!langResult.ok) notFound();
  const canEdit = user !== null && langResult.data.user_id === user.id;

  const [phonemesResult, groupsResult, rulesResult] = await Promise.all([
    listPhonemesSvc(user, id),
    listPhonemeGroupsWithMembersSvc(user, id),
    listRulesSvc(user, id),
  ]);
  if (!phonemesResult.ok || !groupsResult.ok || !rulesResult.ok) notFound();

  return (
    <section>
      <h1 className="text-2xl font-semibold mb-6">Rules</h1>
      <RuleList
        languageId={id}
        phonemes={phonemesResult.data}
        groups={groupsResult.data}
        rules={rulesResult.data}
        canEdit={canEdit}
      />
    </section>
  );
}
