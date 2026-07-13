import { getOrCreateDbUser } from '@/app/lib/current-user';
import { errorResponse } from '@/app/lib/http';
import { generateWordSvc } from '@/app/lib/wordgen';

/** Route segment params for language-specific generation endpoints. */
type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/languages/[id]/generate
 * Generates a set of random words for the authenticated user's language.
 * Query params: `wordsToGenerate`, `structures` (repeatable), `minSyllables?`, `maxSyllables?`
 * Returns `{ words: string[]; requested: number, got: number }` with status 200. `words` may be shorter than
 * `requested` if the phonological space is too constrained to produce that many unique words.
 */
export async function GET(req: Request, { params }: Params) {
  const user = await getOrCreateDbUser();
  if (!user) return new Response(null, { status: 401 });

  const { id } = await params;
  const sp = new URL(req.url).searchParams;

  const rawInput = {
    wordsToGenerate: sp.get('wordsToGenerate'),
    structures: sp.getAll('structures'),
    minSyllables: sp.get('minSyllables'),
    maxSyllables: sp.get('maxSyllables'),
  };

  const result = await generateWordSvc(user, id, rawInput);
  if (!result.ok) return errorResponse(result);

  return Response.json({
    words: [...result.data.words],
    requested: result.data.requested,
    got: result.data.words.size,
  });
}
