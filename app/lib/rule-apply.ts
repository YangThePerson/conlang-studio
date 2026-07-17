import type { RuleContext } from '../db/json-shapes';

/**
 * One phoneme of a generated word. Generation carries tokens (not a joined
 * string) all the way to rule application because a finished string cannot be
 * re-tokenized unambiguously — multigraph symbols make "tsa" either ts+a or
 * t+s+a (see the same argument in `compilePhonotacticsMatcher`).
 */
export type WordToken = { id: string; symbol: string };

/**
 * The fields of a rule row that compilation needs. Typed structurally (rather
 * than importing the Drizzle row type) so this module stays free of schema
 * imports — pure and unit-testable, like `rule-notation.ts`.
 */
export type RuleParts = {
  target_phoneme_id: string | null;
  target_group_id: string | null;
  output_phoneme_id: string;
  left_context: RuleContext;
  right_context: RuleContext;
};

/**
 * One environment slot resolved to the phoneme-id set it accepts. A group
 * slot with no members compiles to an empty set: required → never matches,
 * optional → only ever skipped. Mirrors the phonotactics matcher's tolerance
 * of empty groups rather than treating them as an error.
 */
type CompiledContextSlot =
  | { kind: 'match'; ids: ReadonlySet<string>; optional: boolean }
  | { kind: 'boundary' };

/** A rule resolved from ids to the sets and output token matching needs. */
export type CompiledRule = {
  /** The target phoneme's id, or every member id of the target group. */
  targetIds: ReadonlySet<string>;
  output: WordToken;
  left: CompiledContextSlot[];
  right: CompiledContextSlot[];
};

function compileContext(
  context: RuleContext,
  memberIdsByGroupId: ReadonlyMap<string, ReadonlySet<string>>,
): CompiledContextSlot[] {
  return context.map((slot) => {
    if (slot.kind === 'boundary') return { kind: 'boundary' };
    return {
      kind: 'match',
      ids:
        slot.kind === 'phoneme'
          ? new Set([slot.phonemeId])
          : (memberIdsByGroupId.get(slot.groupId) ?? new Set()),
      optional: slot.optional,
    };
  });
}

/**
 * Resolves rule rows (already in application order) into {@link CompiledRule}s.
 * `phonemeSymbolById` only needs entries for the rules' **output** phonemes —
 * targets and context phonemes are matched by id and never rendered. An output
 * id missing from the map yields symbol `'?'` rather than throwing; it cannot
 * happen through the service layer (deletion of a referenced phoneme is
 * blocked), so it is not worth failing generation over.
 */
export function compileRules(
  ruleRows: RuleParts[],
  phonemeSymbolById: ReadonlyMap<string, string>,
  memberIdsByGroupId: ReadonlyMap<string, ReadonlySet<string>>,
): CompiledRule[] {
  return ruleRows.map((rule) => ({
    targetIds:
      rule.target_phoneme_id !== null
        ? new Set([rule.target_phoneme_id])
        : (memberIdsByGroupId.get(rule.target_group_id ?? '') ?? new Set()),
    output: {
      id: rule.output_phoneme_id,
      symbol: phonemeSymbolById.get(rule.output_phoneme_id) ?? '?',
    },
    left: compileContext(rule.left_context, memberIdsByGroupId),
    right: compileContext(rule.right_context, memberIdsByGroupId),
  }));
}

/**
 * Matches `slots` right-to-left against the tokens immediately before `end`.
 * `slotIdx` walks backwards (the last slot sits adjacent to the target);
 * optional slots branch into consume-or-skip, so this is a small backtracking
 * recursion — contexts are a handful of slots, cost is negligible.
 * A boundary slot consumes nothing and matches only at the word's start.
 */
function matchLeft(
  word: WordToken[],
  slots: CompiledContextSlot[],
  slotIdx: number,
  end: number,
): boolean {
  if (slotIdx < 0) return true;
  const slot = slots[slotIdx];
  if (slot.kind === 'boundary')
    return end === 0 && matchLeft(word, slots, slotIdx - 1, end);
  if (slot.optional && matchLeft(word, slots, slotIdx - 1, end)) return true;
  return (
    end > 0 &&
    slot.ids.has(word[end - 1].id) &&
    matchLeft(word, slots, slotIdx - 1, end - 1)
  );
}

/**
 * Mirror of {@link matchLeft}: matches `slots` left-to-right against the
 * tokens from `start` onward (the first slot sits adjacent to the target).
 * A boundary slot consumes nothing and matches only at the word's end.
 */
function matchRight(
  word: WordToken[],
  slots: CompiledContextSlot[],
  slotIdx: number,
  start: number,
): boolean {
  if (slotIdx === slots.length) return true;
  const slot = slots[slotIdx];
  if (slot.kind === 'boundary')
    return start === word.length && matchRight(word, slots, slotIdx + 1, start);
  if (slot.optional && matchRight(word, slots, slotIdx + 1, start)) return true;
  return (
    start < word.length &&
    slot.ids.has(word[start].id) &&
    matchRight(word, slots, slotIdx + 1, start + 1)
  );
}

/**
 * Applies compiled rules to a word, in array order (the caller supplies them
 * in `position` order, so earlier rules feed later ones).
 *
 * Within one rule, application is **simultaneous**: all match sites are found
 * against the word as it stood when the rule started, then replaced at once —
 * a rule's own output never retriggers the same rule (`a → b / b _` turns
 * "baa" into "bba", not "bbb"). Because a rule rewrites exactly one phoneme
 * to one phoneme, words never change length and match indices never shift,
 * so the two-pass loop below is all "simultaneous" takes.
 *
 * The input array is not mutated.
 */
export function applyRules(
  word: WordToken[],
  rules: CompiledRule[],
): WordToken[] {
  let current = word;
  for (const rule of rules) {
    const matches: number[] = [];
    for (let i = 0; i < current.length; i++) {
      if (
        rule.targetIds.has(current[i].id) &&
        matchLeft(current, rule.left, rule.left.length - 1, i) &&
        matchRight(current, rule.right, 0, i + 1)
      )
        matches.push(i);
    }
    if (matches.length === 0) continue;
    const next = [...current];
    for (const i of matches) next[i] = rule.output;
    current = next;
  }
  return current;
}
