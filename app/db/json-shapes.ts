import { z } from 'zod';

/**
 * A slot filled by any phoneme belonging to a named group.
 * Used in syllable templates and phonological rule contexts.
 * `optional` allows the slot to be skipped during word generation/matching.
 */
const groupSlot = z.object({
  kind: z.literal('group'),
  groupId: z.uuid(),
  optional: z.boolean(),
});

/**
 * A slot filled by one specific phoneme.
 * `optional` allows the slot to be skipped during word generation/matching.
 */
const phonemeSlot = z.object({
  kind: z.literal('phoneme'),
  phonemeId: z.uuid(),
  optional: z.boolean(),
});

/** A word-edge marker. Only meaningful inside a rule context, not syllable templates. */
const boundarySlot = z.object({
  kind: z.literal('boundary'),
});

/**
 * Ordered list of slots defining a valid syllable shape (e.g. C V C).
 * Must contain at least one slot. Word boundaries are not permitted here.
 */
export const templateSchema = z
  .array(z.discriminatedUnion('kind', [groupSlot, phonemeSlot]))
  .min(1);

/**
 * Ordered slots for one side of a phonological rule's environment (left or right context).
 * May include word boundary markers. An empty array means "no contextual restriction."
 */
export const contextSchema = z.array(
  z.discriminatedUnion('kind', [groupSlot, phonemeSlot, boundarySlot]),
);

/** A validated syllable template — an ordered sequence of group/phoneme slots. */
export type SyllableTemplate = z.infer<typeof templateSchema>;

/** A validated rule context — the left or right phonological environment of a rule. */
export type RuleContext = z.infer<typeof contextSchema>;

/**
 * How a lexeme's term came into existence: banked from wordgen output, or typed
 * by the user. Set once at creation by the calling service — never client-supplied.
 */
export const LEXEME_ORIGINS = ['generated', 'manual'] as const;

export type LexemeOrigin = (typeof LEXEME_ORIGINS)[number];
