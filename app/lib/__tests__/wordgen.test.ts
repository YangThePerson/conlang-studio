import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../db', () => ({
  db: {
    query: {
      languages: { findFirst: vi.fn() },
      phoneme_groups: { findMany: vi.fn() },
    },
    select: vi.fn(),
  },
}));

import { db } from '../../db';
import {
  selectRandomItemByWeight,
  generateRandomSyllableStream,
  generateRandomWord,
  generateWordSvc,
} from '../wordgen';

/** Creates an Rng that cycles through `values` in order, wrapping around. */
function seqRng(values: number[]) {
  let i = 0;
  return () => values[i++ % values.length];
}

const LANG_ID = '550e8400-e29b-41d4-a716-446655440000';
const STRUCT_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const PHONEME_ID_1 = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const PHONEME_ID_2 = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const GROUP_ID = 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

const mockUser = { id: 'ef000000-0000-0000-0000-000000000001' } as any;

// ---------------------------------------------------------------------------
// selectRandomItemByWeight
// ---------------------------------------------------------------------------

describe('selectRandomItemByWeight', () => {
  const items = [
    { label: 'a', weight: 1 },
    { label: 'b', weight: 1 },
    { label: 'c', weight: 1 },
  ];

  it('always returns the sole item in a single-element array', () => {
    const single = [{ label: 'only', weight: 1 }];
    expect(selectRandomItemByWeight(single, () => 0).label).toBe('only');
    expect(selectRandomItemByWeight(single, () => 0.999).label).toBe('only');
  });

  it('selects the first item when rng returns 0', () => {
    expect(selectRandomItemByWeight(items, () => 0).label).toBe('a');
  });

  it('selects the last item when rng returns just below 1', () => {
    expect(selectRandomItemByWeight(items, () => 1 - Number.EPSILON).label).toBe('c');
  });

  it('falls back to uniform index selection when all weights are zero', () => {
    const zeroItems = [
      { label: 'x', weight: 0 },
      { label: 'y', weight: 0 },
    ];
    expect(selectRandomItemByWeight(zeroItems, () => 0).label).toBe('x');
    expect(selectRandomItemByWeight(zeroItems, () => 0.999).label).toBe('y');
  });
});

// ---------------------------------------------------------------------------
// generateRandomSyllableStream
// ---------------------------------------------------------------------------

describe('generateRandomSyllableStream', () => {
  it('yields the sole phoneme from a single required slot', () => {
    const templates = [{
      weight: 1,
      template: [{ phonemes: [{ symbol: 'k', ipa: null, weight: 1 }], optional: false }],
    }];
    const gen = generateRandomSyllableStream(templates, seqRng([0]));
    expect(gen.next().value).toBe('k');
    expect(gen.next().value).toBe('k');
  });

  it('skips an optional slot when rng returns < 0.5', () => {
    const templates = [{
      weight: 1,
      template: [
        { phonemes: [{ symbol: 'a', ipa: null, weight: 1 }], optional: true },
        { phonemes: [{ symbol: 'k', ipa: null, weight: 1 }], optional: false },
      ],
    }];
    // rng call order: template-select (0), optional-check (0.25 < 0.5 → skip), phoneme-select (0)
    const gen = generateRandomSyllableStream(templates, seqRng([0, 0.25, 0]));
    expect(gen.next().value).toBe('k');
  });

  it('includes an optional slot when rng returns >= 0.5', () => {
    const templates = [{
      weight: 1,
      template: [
        { phonemes: [{ symbol: 'a', ipa: null, weight: 1 }], optional: true },
        { phonemes: [{ symbol: 'k', ipa: null, weight: 1 }], optional: false },
      ],
    }];
    // rng call order: template-select (0), optional-check (0.75 >= 0.5 → include), phoneme-selects (0, 0)
    const gen = generateRandomSyllableStream(templates, seqRng([0, 0.75, 0, 0]));
    expect(gen.next().value).toBe('ak');
  });
});

// ---------------------------------------------------------------------------
// generateRandomWord
// ---------------------------------------------------------------------------

describe('generateRandomWord', () => {
  function* repeatSyllable(s: string): Generator<string> {
    while (true) yield s;
  }

  it('concatenates exactly the right number of syllables when min equals max', () => {
    const word = generateRandomWord(repeatSyllable('ka'), 2, 2, () => 0);
    expect(word).toBe('kaka');
  });

  it('produces a word with syllable count within [minSyllables, maxSyllables]', () => {
    // Each syllable is 'x' so word.length equals syllable count
    for (const r of [0, 0.33, 0.66, 0.999]) {
      const word = generateRandomWord(repeatSyllable('x'), 2, 4, () => r);
      expect(word.length).toBeGreaterThanOrEqual(2);
      expect(word.length).toBeLessThanOrEqual(4);
    }
  });
});

// ---------------------------------------------------------------------------
// generateWordSvc
// ---------------------------------------------------------------------------

describe('generateWordSvc', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default: all select chains return empty arrays; tests override as needed
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    } as any);
  });

  it('returns a validation error for malformed input', async () => {
    const result = await generateWordSvc(mockUser, LANG_ID, { wordsToGenerate: 'not-a-number' });
    expect(result).toMatchObject({ ok: false, kind: 'validation' });
  });

  it('returns a validation error when maxSyllables is less than minSyllables', async () => {
    const result = await generateWordSvc(mockUser, LANG_ID, {
      wordsToGenerate: 5,
      structures: [STRUCT_ID],
      minSyllables: 3,
      maxSyllables: 1,
    });
    expect(result).toMatchObject({ ok: false, kind: 'validation' });
  });

  it('returns invalid_id for a non-UUID language id', async () => {
    const result = await generateWordSvc(mockUser, 'not-a-uuid', {
      wordsToGenerate: 5,
      structures: [STRUCT_ID],
    });
    expect(result).toMatchObject({ ok: false, kind: 'invalid_id' });
  });

  it('returns not_found when the language does not belong to the user', async () => {
    // findFirst returns undefined by default after vi.resetAllMocks()
    const result = await generateWordSvc(mockUser, LANG_ID, {
      wordsToGenerate: 5,
      structures: [STRUCT_ID],
    });
    expect(result).toMatchObject({ ok: false, kind: 'not_found' });
  });

  it('returns not_found when no syllable structures match', async () => {
    vi.mocked(db.query.languages.findFirst).mockResolvedValue({ id: LANG_ID } as any);
    // Default select mock returns [] → no structures found
    const result = await generateWordSvc(mockUser, LANG_ID, {
      wordsToGenerate: 5,
      structures: [STRUCT_ID],
    });
    expect(result).toMatchObject({ ok: false, kind: 'not_found' });
  });

  it('returns a validation error when a phoneme group has no members', async () => {
    vi.mocked(db.query.languages.findFirst).mockResolvedValue({ id: LANG_ID } as any);
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{
          id: STRUCT_ID,
          language_id: LANG_ID,
          template: [{ kind: 'group', groupId: GROUP_ID, optional: false }],
          weight: 1,
        }]),
      }),
    } as any);
    vi.mocked(db.query.phoneme_groups.findMany).mockResolvedValue([
      { id: GROUP_ID, name: 'vowels', memberships: [] } as any,
    ]);

    const result = await generateWordSvc(mockUser, LANG_ID, {
      wordsToGenerate: 5,
      structures: [STRUCT_ID],
    });
    expect(result).toMatchObject({ ok: false, kind: 'validation' });
    expect((result as any).issues).toContain('vowels');
  });

  it('generates a deterministic word set given the same seed', async () => {
    const structure = {
      id: STRUCT_ID,
      language_id: LANG_ID,
      template: [
        { kind: 'phoneme', phonemeId: PHONEME_ID_1, optional: false },
        { kind: 'phoneme', phonemeId: PHONEME_ID_2, optional: false },
      ],
      weight: 1,
    };
    const phonemes = [
      { id: PHONEME_ID_1, symbol: 'k', ipa: null, weight: 1 },
      { id: PHONEME_ID_2, symbol: 'a', ipa: null, weight: 1 },
    ];
    const input = {
      wordsToGenerate: 5,
      structures: [STRUCT_ID],
      minSyllables: 1,
      maxSyllables: 2,
    };

    function setupMocks() {
      vi.mocked(db.query.languages.findFirst).mockResolvedValue({ id: LANG_ID } as any);
      vi.mocked(db.query.phoneme_groups.findMany).mockResolvedValue([]);
      // First select call returns structures; second returns phonemes
      const mockWhere = vi.fn()
        .mockResolvedValueOnce([structure])
        .mockResolvedValueOnce(phonemes);
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({ where: mockWhere }),
      } as any);
    }

    setupMocks();
    const result1 = await generateWordSvc(mockUser, LANG_ID, input, 42);

    vi.resetAllMocks();
    setupMocks();
    const result2 = await generateWordSvc(mockUser, LANG_ID, input, 42);

    expect(result1.ok).toBe(true);
    expect(result2.ok).toBe(true);
    if (result1.ok && result2.ok) {
      expect([...result1.data]).toEqual([...result2.data]);
    }
  });
});
