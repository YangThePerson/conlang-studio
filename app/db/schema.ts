import { relations, sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  uuid,
  doublePrecision,
  primaryKey,
  jsonb,
  integer,
  check,
  unique,
} from 'drizzle-orm/pg-core';
import {
  SyllableTemplate,
  RuleContext,
  LEXEME_ORIGINS,
  LexemeOrigin,
} from './json-shapes';

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

/** App users, one row per Clerk account. Created automatically on first sign-in. */
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  clerk_id: text('clerk_id').notNull().unique(),
  email: text('email').notNull().unique(),
});

/** A constructed language owned by a user. All phonology and lexicon data is scoped under this. */
export const languages = pgTable('languages', {
  id: uuid('id').defaultRandom().primaryKey(),
  user_id: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
});

/**
 * Individual sound units (IPA symbols) belonging to a language.
 * `weight` controls how frequently this phoneme is sampled during word generation.
 */
export const phonemes = pgTable(
  'phonemes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    language_id: uuid('language_id')
      .notNull()
      .references(() => languages.id, { onDelete: 'cascade' }),
    symbol: text('symbol').notNull(),
    ipa: text('ipa').default(''),
    weight: doublePrecision('weight').notNull().default(1),
  },
  (t) => [unique().on(t.language_id, t.symbol)],
);

/**
 * Named sets of phonemes (e.g. "vowels", "stops") used as shorthand slots
 * in syllable templates and phonological rules.
 */
export const phoneme_groups = pgTable(
  'phoneme_groups',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    language_id: uuid('language_id')
      .notNull()
      .references(() => languages.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
  },
  (t) => [unique().on(t.language_id, t.name)],
);

/** Join table for the many-to-many relationship between phonemes and phoneme groups. */
export const group_memberships = pgTable(
  'group_memberships',
  {
    group_id: uuid('group_id')
      .notNull()
      .references(() => phoneme_groups.id, { onDelete: 'cascade' }),
    phoneme_id: uuid('phoneme_id')
      .notNull()
      .references(() => phonemes.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.group_id, t.phoneme_id] })],
);

/**
 * Weighted templates defining valid syllable shapes for a language (e.g. CV, CVC, V).
 * A language typically has several structures; `weight` biases how often each is chosen.
 */
export const syllable_structures = pgTable('syllable_structures', {
  id: uuid('id').defaultRandom().primaryKey(),
  language_id: uuid('language_id')
    .notNull()
    .references(() => languages.id, { onDelete: 'cascade' }),
  template: jsonb('template').$type<SyllableTemplate>().notNull(),
  weight: doublePrecision('weight').notNull().default(1.0),
});

/**
 * Phonological rewrite rules applied in `position` order during word generation.
 * Each rule transforms a target phoneme (or any member of a target group) into
 * `output_phoneme_id` when `left_context` and `right_context` both match.
 * Exactly one of `target_phoneme_id` or `target_group_id` must be set (enforced by DB check).
 */
export const rules = pgTable(
  'rules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    language_id: uuid('language_id')
      .notNull()
      .references(() => languages.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    target_phoneme_id: uuid('target_phoneme_id').references(() => phonemes.id, {
      onDelete: 'restrict',
    }),
    target_group_id: uuid('target_group_id').references(
      () => phoneme_groups.id,
      {
        onDelete: 'restrict',
      },
    ),
    output_phoneme_id: uuid('output_phoneme_id')
      .notNull()
      .references(() => phonemes.id, { onDelete: 'restrict' }),
    left_context: jsonb('left_context').$type<RuleContext>().notNull(),
    right_context: jsonb('right_context').$type<RuleContext>().notNull(),
  },
  (t) => [
    // Exactly one of phoneme/group target is set.
    check(
      'target_check',
      sql`(${t.target_phoneme_id} IS NOT NULL AND ${t.target_group_id} IS NULL)
       OR (${t.target_phoneme_id} IS NULL AND ${t.target_group_id} IS NOT NULL)`,
    ),
  ],
);

/**
 * A dictionary entry (word form) in a language. A lexeme can have multiple senses.
 * `origin` records whether the term was banked from wordgen or typed by hand — it
 * drives the (future) irregularity warning, which only applies to manual entries.
 */
export const lexemes = pgTable(
  'lexemes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    language_id: uuid('language_id')
      .notNull()
      .references(() => languages.id, { onDelete: 'cascade' }),
    term: text('term').notNull(),
    notes: text('notes'),
    origin: text('origin').notNull().default('manual').$type<LexemeOrigin>(),
  },
  (t) => [
    check(
      'origin_check',
      sql`${t.origin} IN (${sql.join(
        LEXEME_ORIGINS.map((o) => sql.raw(`'${o}'`)),
        sql.raw(', '),
      )})`,
    ),
  ],
);

/** One meaning of a lexeme, with its part of speech and definition. */
export const senses = pgTable('senses', {
  id: uuid('id').defaultRandom().primaryKey(),
  lexeme_id: uuid('lexeme_id')
    .notNull()
    .references(() => lexemes.id, { onDelete: 'cascade' }),
  part_of_speech: text('part_of_speech').notNull(),
  definition: text('definition').notNull(),
});

/** User-defined labels for categorizing lexemes within a language (e.g. "body parts", "verbs"). */
export const tags = pgTable(
  'tags',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    language_id: uuid('language_id')
      .notNull()
      .references(() => languages.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
  },
  (t) => [unique().on(t.language_id, t.name)],
);

/** Join table for the many-to-many relationship between lexemes and tags. */
export const lexeme_tags = pgTable(
  'lexeme_tags',
  {
    lexeme_id: uuid('lexeme_id')
      .notNull()
      .references(() => lexemes.id, { onDelete: 'cascade' }),
    tag_id: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.lexeme_id, t.tag_id] })],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ many }) => ({
  languages: many(languages),
}));

export const languagesRelations = relations(languages, ({ one, many }) => ({
  user: one(users, { fields: [languages.user_id], references: [users.id] }),
  phonemes: many(phonemes),
  groups: many(phoneme_groups),
  rules: many(rules),
  syllableStructures: many(syllable_structures),
  lexemes: many(lexemes),
  tags: many(tags),
}));

export const phonemesRelations = relations(phonemes, ({ one, many }) => ({
  language: one(languages, {
    fields: [phonemes.language_id],
    references: [languages.id],
  }),
  memberships: many(group_memberships),
}));

export const phonemeGroupsRelations = relations(
  phoneme_groups,
  ({ one, many }) => ({
    language: one(languages, {
      fields: [phoneme_groups.language_id],
      references: [languages.id],
    }),
    memberships: many(group_memberships),
  }),
);

export const groupMembershipsRelations = relations(
  group_memberships,
  ({ one }) => ({
    group: one(phoneme_groups, {
      fields: [group_memberships.group_id],
      references: [phoneme_groups.id],
    }),
    phoneme: one(phonemes, {
      fields: [group_memberships.phoneme_id],
      references: [phonemes.id],
    }),
  }),
);

export const lexemesRelations = relations(lexemes, ({ one, many }) => ({
  language: one(languages, {
    fields: [lexemes.language_id],
    references: [languages.id],
  }),
  senses: many(senses),
  tags: many(lexeme_tags),
}));

export const sensesRelations = relations(senses, ({ one }) => ({
  lexeme: one(lexemes, {
    fields: [senses.lexeme_id],
    references: [lexemes.id],
  }),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
  language: one(languages, {
    fields: [tags.language_id],
    references: [languages.id],
  }),
  lexemes: many(lexeme_tags),
}));

export const lexemeTagsRelations = relations(lexeme_tags, ({ one }) => ({
  lexeme: one(lexemes, {
    fields: [lexeme_tags.lexeme_id],
    references: [lexemes.id],
  }),
  tag: one(tags, { fields: [lexeme_tags.tag_id], references: [tags.id] }),
}));
