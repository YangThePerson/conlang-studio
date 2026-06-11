import { z } from 'zod';

const groupSlot = z.object({
  kind: z.literal('group'),
  groupId: z.uuid(),
  optional: z.boolean(),
});

const phonemeSlot = z.object({
  kind: z.literal('phoneme'),
  phonemeId: z.uuid(),
  optional: z.boolean(),
});

// a word edge; only meaningful inside a rule context
const boundarySlot = z.object({
  kind: z.literal('boundary'),
});

// Syllable template: ordered group/phoneme slots, at least one. No word boundary.
export const templateSchema = z
  .array(z.discriminatedUnion('kind', [groupSlot, phonemeSlot]))
  .min(1);

// Rule context: ordered slots that MAY include a word boundary, and MAY be empty
// (an empty left/right context means "no condition on that side").
export const contextSchema = z.array(
  z.discriminatedUnion('kind', [groupSlot, phonemeSlot, boundarySlot]),
);

export type SyllableTemplate = z.infer<typeof templateSchema>;
export type RuleContext = z.infer<typeof contextSchema>;
