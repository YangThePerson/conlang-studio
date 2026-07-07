import { LiteralTemplate } from './wordgen';

/**
 * Checks whether a term is phonotactically legal, i.e. whether it can be split
 * into one or more syllables that each instantiate one of the language's
 * templates. Compiled once per language via {@link compilePhonotacticsMatcher}.
 */
export type PhonotacticsMatcher = (term: string) => boolean;

/**
 * One slot of a compiled template: the set of symbols it accepts, plus the
 * distinct symbol lengths so matching only probes substring lengths that can
 * actually occur. `ipa` and `weight` from the source template are intentionally
 * dropped — validity is defined over symbols only (IPA is display data, and
 * weights only bias generation, never legality).
 */
type CompiledSlot = {
  symbols: Set<string>;
  lengths: number[];
  optional: boolean;
};

/**
 * Compiles a language's syllable templates into a matcher for checking terms
 * against them. Compilation is the amortized step: build the matcher once per
 * language, then run it over every dictionary row.
 *
 * Input is the same `LiteralTemplate[]` shape that `builtLiteralTemplates`
 * (wordgen) produces, so both features share one resolved-template
 * representation. Pass templates built from ALL of the language's syllable
 * structures — unlike generation, which uses a user-selected subset, legality
 * is defined against the full inventory.
 *
 * The matcher cannot tokenize the term into phonemes first: multigraph symbols
 * make tokenization ambiguous ("tsa" may be ts+a or t+s+a) and syllable
 * boundaries are ambiguous too. Instead it explores all tokenizations and
 * segmentations simultaneously — a dynamic program over (template, slot,
 * position) states, i.e. simulation of the NFA for the regular language
 * (T1|…|Tk)+. Cost per term is O(length × total slots × distinct symbol
 * lengths).
 *
 * Symbols and terms are both NFC-normalized before comparison so that
 * precomposed and combining-mark spellings of the same grapheme (e.g. "ñ")
 * match. Lengths/slices are in UTF-16 code units, which is consistent on both
 * sides, so astral-plane symbols still compare correctly.
 */
export function compilePhonotacticsMatcher(
  templates: LiteralTemplate[],
): PhonotacticsMatcher {
  const compiled: CompiledSlot[][] = templates.map(({ template }) =>
    template.map((slot) => {
      const symbols = new Set<string>();
      for (const { symbol } of slot.phonemes) {
        const normalized = symbol.normalize('NFC');
        // An empty symbol would let a slot match without consuming input and
        // break termination — exclude it (validation should prevent it anyway).
        if (normalized.length > 0) symbols.add(normalized);
      }
      return {
        symbols,
        lengths: [...new Set([...symbols].map((s) => s.length))],
        optional: slot.optional,
      };
    }),
  );

  // +1 because slotIdx ranges 0..slotCount inclusive (slotCount = "template
  // fully matched"). Used as the mixed-radix width when encoding states.
  const slotRadix = Math.max(1, ...compiled.map((t) => t.length + 1));

  return (term: string): boolean => {
    const word = term.normalize('NFC');
    const n = word.length;
    if (n === 0 || compiled.length === 0) return false;

    // canStart[p] — the prefix word[0..p) is a complete syllable sequence, so
    // a new syllable may begin at p. The word is legal iff canStart[n].
    const canStart = new Array<boolean>(n + 1).fill(false);
    const visited = new Set<number>();
    const worklist: number[] = [];

    // State (templateIdx t, slotIdx s, position pos) encoded as one integer so
    // `visited` stays a flat Set<number>.
    const push = (t: number, s: number, pos: number) => {
      const id = (t * slotRadix + s) * (n + 1) + pos;
      if (visited.has(id)) return;
      visited.add(id);
      worklist.push(id);
    };

    const markStart = (pos: number) => {
      if (canStart[pos]) return;
      canStart[pos] = true;
      for (let t = 0; t < compiled.length; t++) push(t, 0, pos);
    };

    markStart(0);

    while (worklist.length > 0) {
      const id = worklist.pop()!;
      const pos = id % (n + 1);
      const rest = (id - pos) / (n + 1);
      const s = rest % slotRadix;
      const t = (rest - s) / slotRadix;

      const slots = compiled[t];
      if (s === slots.length) {
        // Template fully matched — pos is a syllable boundary. A syllable that
        // consumed nothing (all optional slots skipped) re-marks its own start,
        // a no-op, so empty syllables can never create a false accept.
        markStart(pos);
        continue;
      }

      const slot = slots[s];
      if (slot.optional) push(t, s + 1, pos);
      for (const len of slot.lengths) {
        if (pos + len <= n && slot.symbols.has(word.slice(pos, pos + len)))
          push(t, s + 1, pos + len);
      }
    }

    return canStart[n];
  };
}
