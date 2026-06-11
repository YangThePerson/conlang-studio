import { z } from 'zod';
import { templateSchema, contextSchema } from './json-shapes';

export const createUserSchema = z.object({
  clerk_id: z.string().min(1),
  email: z.email(),
});

// For API routes: user_id is always injected server-side from auth, never from the client.
export const createLanguageInputSchema = z.object({
  name: z.string().min(1),
});

export const createLanguageSchema = z.object({
  user_id: z.uuid(),
  name: z.string().min(1),
});

export const createPhonemeSchema = z.object({
  language_id: z.uuid(),
  symbol: z.string().min(1),
  weight: z.number().positive().optional(),
});

export const createPhonemeGroupSchema = z.object({
  language_id: z.uuid(),
  name: z.string().min(1),
});

export const createGroupMembershipSchema = z.object({
  group_id: z.uuid(),
  phoneme_id: z.uuid(),
});

export const createSyllableStructureSchema = z.object({
  language_id: z.uuid(),
  template: templateSchema,
  weight: z.number().positive().optional(),
});

export const createRuleSchema = z
  .object({
    language_id: z.uuid(),
    position: z.int().nonnegative(),
    target_phoneme_id: z.uuid().optional(),
    target_group_id: z.uuid().optional(),
    output_phoneme_id: z.uuid(),
    left_context: contextSchema,
    right_context: contextSchema,
  })
  .refine(
    (v) =>
      (v.target_phoneme_id !== undefined) !== (v.target_group_id !== undefined),
    { message: 'Exactly one of target_phoneme_id or target_group_id must be set' },
  );

export const createLexemeSchema = z.object({
  language_id: z.uuid(),
  term: z.string().min(1),
  notes: z.string().optional(),
});

export const createSenseSchema = z.object({
  lexeme_id: z.uuid(),
  part_of_speech: z.string().min(1),
  definition: z.string().min(1),
});

export const createTagSchema = z.object({
  language_id: z.uuid(),
  name: z.string().min(1),
});

export const createLexemeTagSchema = z.object({
  lexeme_id: z.uuid(),
  tag_id: z.uuid(),
});
