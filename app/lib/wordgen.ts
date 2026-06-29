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
export type Rng = () => number;
export type LiteralTemplate = {
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
type SyllableStructure = typeof syllable_structures.$inferSelect;
type GroupComplex = {
  id: string;
  name: string;
  language_id: string;
  memberships: {
    group_id: string;
    phoneme_id: string;
    phoneme: {
      symbol: string;
      id: string;
      language_id: string;
      ipa: string | null;
      weight: number;
    };
  }[];
};
type Phoneme = typeof phonemes.$inferSelect;

/** Seeded PRNG (mulberry32). Returns a closure with the same signature as Math.random(). */
export function makeRng(seed: number): Rng {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function selectRandomItemByWeight<T extends { weight: number }>(
  items: T[],
  rng: Rng,
): T {
  const weightScaledItems = items.map((item) => ({
    ...item,
    scaledWeight: Math.round(item.weight * 10),
  }));

  const totalWeight = weightScaledItems.reduce(
    (sum, item) => sum + item.scaledWeight,
    0,
  );

  if (totalWeight === 0) {
    return items[Math.floor(rng() * items.length)];
  }

  let random = Math.floor(rng() * totalWeight);

  for (const item of weightScaledItems) {
    random -= item.scaledWeight;
    if (random < 0) {
      return item;
    }
  }

  return items[items.length - 1];
}

export function* generateRandomSyllableStream(
  templates: LiteralTemplate[],
  rng: Rng,
): Generator<string> {
  while (true) {
    const selected = selectRandomItemByWeight(templates, rng);

    let newSyllable = '';
    // If all optional slots are skipped and the syllable ends up empty, re-attempt
    do
      for (let i = 0; i < selected.template.length; i++) {
        const slot = selected.template[i];
        if (slot.optional && rng() < 0.5) continue;
        const nextPhoneme = selectRandomItemByWeight(slot.phonemes, rng);
        newSyllable += nextPhoneme.symbol;
      }
    while (newSyllable.length === 0);

    yield newSyllable;
  }
}

export function generateRandomWord(
  generator: Generator<string>,
  minSyllables: number,
  maxSyllables: number,
  rng: Rng,
): string {
  let word = '';
  const syllableCount =
    Math.floor(rng() * (maxSyllables - minSyllables + 1)) + minSyllables;
  for (let i = 0; i < syllableCount; i++) word += generator.next().value;
  return word;
}

export function separateTemplateIds(
  parsedStructures: SyllableStructure[],
): [Set<string>, Set<string>] {
  const phonemeIds = new Set<string>();
  const groupIds = new Set<string>();
  for (const { template } of parsedStructures) {
    for (const slot of template) {
      if (slot.kind === 'phoneme') phonemeIds.add(slot.phonemeId);
      else groupIds.add(slot.groupId);
    }
  }
  return [phonemeIds, groupIds];
}

export function builtLiteralTemplates(
  phonemesList: Phoneme[],
  groupsWithMembersList: GroupComplex[],
  parsedStructures: SyllableStructure[],
) {
  const phonemesById = new Map(phonemesList.map((p) => [p.id, p]));
  const groupsById = new Map(groupsWithMembersList.map((g) => [g.id, g]));

  /** Templates with weight and phoneme list */
  const literalTemplates: LiteralTemplate[] = parsedStructures.map(
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

  return literalTemplates;
}

export function generateWordSet(
  wordsToGenerate: number,
  minSyllables: number,
  maxSyllables: number,
  syllableStream: Generator<string>,
  rng: Rng,
) {
  const newWords = new Set<string>();
  const maxAttempts = wordsToGenerate * 10;
  let attempts = 0;
  while (newWords.size < wordsToGenerate && attempts < maxAttempts) {
    newWords.add(
      generateRandomWord(syllableStream, minSyllables, maxSyllables, rng),
    );
    attempts++;
  }

  return newWords;
}

/**
 * Generates a set of unique random words for a language owned by `user`.
 * `rawLanguageId` and `rawInput` are untrusted — schema validation and ownership are enforced here.
 *
 * The returned Set may contain fewer entries than `wordsToGenerate` if the phonological space is
 * too constrained to produce that many unique words within 10× `wordsToGenerate` generation attempts.
 * Callers should check `data.size` against `wordsToGenerate` to detect and surface a partial result.
 *
 * Pass `seed` to make word generation deterministic — the same seed and language definition always
 * produce the same word list. Omit it for random output in production.
 */
export async function generateWordSvc(
  user: DbUser,
  rawLanguageId: unknown,
  rawInput: unknown,
  seed?: number,
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

  const [phonemeIds, groupIds] = separateTemplateIds(parsedStructures);

  const [phonemesList, groupsWithMembersList] = await Promise.all([
    phonemeIds.size
      ? db
          .select()
          .from(phonemes)
          .where(inArray(phonemes.id, [...phonemeIds]))
      : ([] as Phoneme[]),
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
      : ([] as GroupComplex[]),
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

  const literalTemplates = builtLiteralTemplates(
    phonemesList,
    groupsWithMembersList,
    parsedStructures,
  );

  const rng = seed !== undefined ? makeRng(seed) : Math.random;
  const syllableStream = generateRandomSyllableStream(literalTemplates, rng);

  const newWords = generateWordSet(
    wordsToGenerate,
    minSyllables,
    maxSyllables,
    syllableStream,
    rng,
  );

  return { ok: true, data: newWords };
}
