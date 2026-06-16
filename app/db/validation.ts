import { z } from 'zod';
import { templateSchema, contextSchema } from './json-shapes';

/** Validates any UUID string — used to sanitize id params in actions and route handlers. */
export const uuidSchema = z.uuid();

/** Validates the payload for creating a new app user (called internally on first sign-in). */
export const createUserSchema = z.object({
  clerk_id: z.string().min(1),
  email: z.email(),
});

/**
 * Validates the client-supplied body for POST /api/languages.
 * `user_id` is intentionally absent — it is injected server-side from the auth session.
 */
export const createLanguageInputSchema = z.object({
  name: z.string().min(1),
});

/**
 * Validates the client-supplied body for PATCH /api/languages/[id].
 * `id` is intentionally absent — it comes from the route segment, not the request body.
 */
export const updateLanguageInputSchema = z.object({
  name: z.string().min(1),
});

/** Full payload for inserting a language row, including the server-injected `user_id`. */
export const createLanguageSchema = z.object({
  user_id: z.uuid(),
  name: z.string().min(1),
});

/**
 * Validates the client-supplied fields for creating a phoneme.
 * `language_id` is intentionally absent — it comes from the route segment, not the request body.
 */
export const createPhonemeInputSchema = z.object({
  symbol: z.string().min(1),
  ipa: z.string().optional(),
  weight: z.number().min(0).optional(),
});

/**
 * Validates the client-supplied fields for updating a phoneme.
 * Both fields are optional, but at least one must be provided.
 */
export const updatePhonemeInputSchema = z
  .object({
    symbol: z.string().min(1).optional(),
    weight: z.number().min(0).max(2).optional(),
    ipa: z.string().optional(),
  })
  .refine((v) => v.symbol !== undefined || v.weight !== undefined, {
    message: 'At least one of symbol or weight must be provided',
  });

/** Full insert payload for a phoneme row, including the server-injected `language_id`. */
export const createPhonemeSchema = z.object({
  language_id: z.uuid(),
  symbol: z.string().min(1),
  weight: z.number().positive().optional(),
});

/** Validates a new named phoneme group (e.g. "vowels", "nasals"). */
export const createPhonemeGroupSchema = z.object({
  language_id: z.uuid(),
  name: z.string().min(1),
});

/** Validates adding a phoneme to a group. */
export const createGroupMembershipSchema = z.object({
  group_id: z.uuid(),
  phoneme_id: z.uuid(),
});

/** Validates a new syllable structure template. `weight` controls how often this shape is chosen. */
export const createSyllableStructureSchema = z.object({
  language_id: z.uuid(),
  template: templateSchema,
  weight: z.number().positive().optional(),
});

/**
 * Validates a new phonological rewrite rule.
 * Exactly one of `target_phoneme_id` or `target_group_id` must be present —
 * the rule matches either a single phoneme or every member of a group.
 */
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
    {
      message:
        'Exactly one of target_phoneme_id or target_group_id must be set',
    },
  );

/** Validates a new lexeme (dictionary entry). `notes` is optional free-form text. */
export const createLexemeSchema = z.object({
  language_id: z.uuid(),
  term: z.string().min(1),
  notes: z.string().optional(),
});

/** Validates a new sense (meaning) attached to a lexeme. */
export const createSenseSchema = z.object({
  lexeme_id: z.uuid(),
  part_of_speech: z.string().min(1),
  definition: z.string().min(1),
});

/** Validates a new tag for categorizing lexemes within a language. */
export const createTagSchema = z.object({
  language_id: z.uuid(),
  name: z.string().min(1),
});

/** Validates attaching a tag to a lexeme. */
export const createLexemeTagSchema = z.object({
  lexeme_id: z.uuid(),
  tag_id: z.uuid(),
});
