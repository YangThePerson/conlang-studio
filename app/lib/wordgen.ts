import { z } from 'zod';
import {
  languages,
  phoneme_groups,
  phonemes,
  syllable_structures,
  users,
} from '../db/schema';
import { generateWordsInputSchema, uuidSchema } from '../db/validation';
import { db } from '../db';
import { and, eq, inArray } from 'drizzle-orm';
import { Result } from './result';

type DbUser = typeof users.$inferSelect;
type literalTemplate = {
  template: {
    phonemes: {
      symbol: string;
      ipa: string | null;
      weight: number;
    }[];
    optional: boolean;
  }[];
  weight: number;
};

function selectRandomItemByWeight<T extends { weight: number }>(items: T[]): T {
  const weightScaledItems = items.map((item) => ({
    ...item,
    scaledWeight: Math.round(item.weight * 10),
  }));

  const totalWeight = weightScaledItems.reduce(
    (sum, item) => sum + item.scaledWeight,
    0,
  );

  if (totalWeight === 0) {
    return items[Math.floor(Math.random() * items.length)];
  }

  let random = Math.floor(Math.random() * totalWeight);

  for (const item of weightScaledItems) {
    random -= item.scaledWeight;
    if (random < 0) {
      return item;
    }
  }

  return items[items.length - 1];
}

function* generateRandomSyllableStream(
  templates: literalTemplate[],
): Generator<string> {
  while (true) {
    const selected = selectRandomItemByWeight(templates);

    let newSyllable = '';
    // If all optional slots are skipped and the syllable ends up empty, re-attempt
    do
      for (let i = 0; i < selected.template.length; i++) {
        const slot = selected.template[i];
        if (slot.optional && Math.random() < 0.5) continue;
        const nextPhoneme = selectRandomItemByWeight(slot.phonemes);
        newSyllable += nextPhoneme.symbol;
      }
    while (newSyllable.length === 0);

    yield newSyllable;
  }
}

function generateRandomWord(
  generator: Generator<string>,
  minSyllables: number,
  maxSyllables: number,
): string {
  let word = '';
  const syllableCount =
    Math.floor(Math.random() * (maxSyllables - minSyllables + 1)) +
    minSyllables;
  for (let i = 0; i < syllableCount; i++) word += generator.next().value;
  return word;
}

/**
 * Generates a set of unique random words for a language owned by `user`.
 * `rawLanguageId` and `rawInput` are untrusted — schema validation and ownership are enforced here.
 *
 * The returned Set may contain fewer entries than `wordsToGenerate` if the phonological space is
 * too constrained to produce that many unique words within 10× `wordsToGenerate` generation attempts.
 * Callers should check `data.size` against `wordsToGenerate` to detect and surface a partial result.
 */
export async function generateWordSvc(
  user: DbUser,
  rawLanguageId: unknown,
  rawInput: unknown,
): Promise<Result<Set<string>>> {
  const parsedInput = generateWordsInputSchema.safeParse(rawInput);
  if (!parsedInput.success)
    return {
      ok: false,
      kind: 'validation',
      issues: z.treeifyError(parsedInput.error),
    };

  const { wordsToGenerate, structures, minSyllables, maxSyllables } =
    parsedInput.data;

  if (maxSyllables < minSyllables)
    return {
      ok: false,
      kind: 'validation',
      issues:
        'The minimum amount of syllables cannot exceed the maximum amount.',
    };

  const parsedId = uuidSchema.safeParse(rawLanguageId);
  if (!parsedId.success) return { ok: false, kind: 'invalid_id' };

  const lang = await db.query.languages.findFirst({
    where: and(eq(languages.id, parsedId.data), eq(languages.user_id, user.id)),
  });
  if (!lang) return { ok: false, kind: 'not_found' };

  const parsedStructures = await db
    .select()
    .from(syllable_structures)
    .where(
      and(
        eq(syllable_structures.language_id, parsedId.data),
        inArray(syllable_structures.id, structures),
      ),
    );

  if (!parsedStructures.length) return { ok: false, kind: 'not_found' };

  const phonemeIds = new Set<string>();
  const groupIds = new Set<string>();
  for (const { template } of parsedStructures) {
    for (const slot of template) {
      if (slot.kind === 'phoneme') phonemeIds.add(slot.phonemeId);
      else groupIds.add(slot.groupId);
    }
  }

  const [phonemesList, groupsWithMembersList] = await Promise.all([
    phonemeIds.size
      ? db
          .select()
          .from(phonemes)
          .where(inArray(phonemes.id, [...phonemeIds]))
      : ([] as (typeof phonemes.$inferSelect)[]),
    groupIds.size
      ? db.query.phoneme_groups.findMany({
          where: inArray(phoneme_groups.id, [...groupIds]),
          with: {
            memberships: {
              with: {
                phoneme: true,
              },
            },
          },
        })
      : [],
  ]);

  const emptyGroup = groupsWithMembersList.find(
    (g) => g.memberships.length === 0,
  );
  if (emptyGroup)
    return {
      ok: false,
      kind: 'validation',
      issues: `Phoneme group "${emptyGroup.name}" has no members and cannot be used in word generation.`,
    };

  const phonemesById = new Map(phonemesList.map((p) => [p.id, p]));
  const groupsById = new Map(groupsWithMembersList.map((g) => [g.id, g]));

  /** Templates with weight and phoneme list */
  const literalTemplates: literalTemplate[] = parsedStructures.map(
    ({ template, weight }) => ({
      template: template.map((slot) => {
        if (slot.kind === 'group')
          return {
            phonemes: groupsById
              .get(slot.groupId)!
              .memberships.map(({ phoneme: { symbol, ipa, weight } }) => ({
                symbol,
                ipa,
                weight,
              })),
            optional: slot.optional,
          };
        else {
          const { symbol, ipa, weight } = phonemesById.get(slot.phonemeId)!;
          return {
            phonemes: [{ symbol, ipa, weight }],
            optional: slot.optional,
          };
        }
      }),
      weight,
    }),
  );

  const syllableStream = generateRandomSyllableStream(literalTemplates);

  const newWords = new Set<string>();
  const maxAttempts = wordsToGenerate * 10;
  let attempts = 0;
  while (newWords.size < wordsToGenerate && attempts < maxAttempts) {
    newWords.add(
      generateRandomWord(syllableStream, minSyllables, maxSyllables),
    );
    attempts++;
  }

  return { ok: true, data: newWords };
}
