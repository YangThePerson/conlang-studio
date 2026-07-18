import { describe, it, expect } from 'vitest';
import { compilePhonotacticsMatcher } from '../phonotactics';
import { LiteralTemplate } from '../wordgen';

/** Builds a LiteralTemplate from a list of slots given as bare symbol arrays. */
function tpl(
  slots: { symbols: string[]; optional?: boolean }[],
): LiteralTemplate {
  return {
    weight: 1,
    template: slots.map((slot) => ({
      optional: slot.optional ?? false,
      phonemes: slot.symbols.map((symbol) => ({
        // The matcher only reads symbols; a symbol-derived fake id keeps the type happy.
        id: `id-${symbol}`,
        symbol,
        ipa: null,
        weight: 1,
      })),
    })),
  };
}

describe('compilePhonotacticsMatcher', () => {
  describe('single CV template', () => {
    const matches = compilePhonotacticsMatcher([
      tpl([{ symbols: ['t', 'k'] }, { symbols: ['a', 'i'] }]),
    ]);

    it('accepts a single well-formed syllable', () => {
      expect(matches('ta')).toBe(true);
      expect(matches('ki')).toBe(true);
    });

    it('accepts repeated syllables', () => {
      expect(matches('taki')).toBe(true);
      expect(matches('tatata')).toBe(true);
    });

    it('rejects wrong slot order and incomplete syllables', () => {
      expect(matches('at')).toBe(false);
      expect(matches('t')).toBe(false);
      expect(matches('taa')).toBe(false);
    });

    it('rejects symbols outside the inventory', () => {
      expect(matches('xa')).toBe(false);
      expect(matches('tax')).toBe(false);
    });

    it('rejects the empty word', () => {
      expect(matches('')).toBe(false);
    });
  });

  describe('optional slots', () => {
    // CV(C)
    const matches = compilePhonotacticsMatcher([
      tpl([
        { symbols: ['t'] },
        { symbols: ['a'] },
        { symbols: ['t', 'n'], optional: true },
      ]),
    ]);

    it('accepts syllables with and without the optional coda', () => {
      expect(matches('ta')).toBe(true);
      expect(matches('tan')).toBe(true);
      expect(matches('tanta')).toBe(true);
    });

    it('backtracks across syllable boundaries', () => {
      // Greedy left-to-right would read "tat" first and strand "a";
      // only the ta.ta segmentation is valid.
      expect(matches('tata')).toBe(true);
    });

    it('rejects a coda consonant with no syllable to attach to', () => {
      expect(matches('tat')).toBe(true);
      // tan+n: the second n can only be a coda, but there is no syllable left
      expect(matches('tann')).toBe(false);
    });
  });

  describe('multigraph symbols', () => {
    it('resolves tokenization ambiguity that greedy matching gets wrong', () => {
      // C ∈ {ts, t}, V ∈ {sa}: "tsa" parses only as t+sa — longest-match
      // tokenization ("ts" first) would dead-end.
      const matches = compilePhonotacticsMatcher([
        tpl([{ symbols: ['ts', 't'] }, { symbols: ['sa'] }]),
      ]);
      expect(matches('tsa')).toBe(true);
      expect(matches('tssa')).toBe(true); // ts+sa
      expect(matches('ts')).toBe(false);
    });

    it('matches symbols of mixed lengths in one slot', () => {
      const matches = compilePhonotacticsMatcher([
        tpl([{ symbols: ['t', 'tʃ', 'ndr'] }, { symbols: ['a'] }]),
      ]);
      expect(matches('tʃa')).toBe(true);
      expect(matches('ndra')).toBe(true);
      expect(matches('ndr')).toBe(false);
    });
  });

  describe('multiple templates', () => {
    // CV and VC
    const matches = compilePhonotacticsMatcher([
      tpl([{ symbols: ['t'] }, { symbols: ['a'] }]),
      tpl([{ symbols: ['a'] }, { symbols: ['n'] }]),
    ]);

    it('accepts words mixing syllables from different templates', () => {
      expect(matches('taan')).toBe(true);
      expect(matches('anta')).toBe(true);
    });

    it('rejects interleavings that satisfy neither template', () => {
      expect(matches('tn')).toBe(false);
    });
  });

  describe('degenerate template sets', () => {
    it('rejects everything when there are no templates', () => {
      const matches = compilePhonotacticsMatcher([]);
      expect(matches('ta')).toBe(false);
    });

    it('never accepts via an empty syllable (all slots optional and skipped)', () => {
      const matches = compilePhonotacticsMatcher([
        tpl([{ symbols: ['t'], optional: true }]),
      ]);
      expect(matches('')).toBe(false);
      expect(matches('t')).toBe(true);
      expect(matches('x')).toBe(false);
    });
  });

  describe('normalization and weights', () => {
    it('matches NFC and combining-mark spellings of the same grapheme', () => {
      const matches = compilePhonotacticsMatcher([
        tpl([{ symbols: ['ñ'] }, { symbols: ['a'] }]), // precomposed ñ
      ]);
      expect(matches('ña')).toBe(true); // n + combining tilde
      expect(matches('ña')).toBe(true);
    });

    it('ignores weights — a zero-weight phoneme is still legal', () => {
      const matches = compilePhonotacticsMatcher([
        {
          weight: 0,
          template: [
            { optional: false, phonemes: [{ id: 'id-t', symbol: 't', ipa: null, weight: 0 }] },
            { optional: false, phonemes: [{ id: 'id-a', symbol: 'a', ipa: null, weight: 0 }] },
          ],
        },
      ]);
      expect(matches('ta')).toBe(true);
    });
  });
});
