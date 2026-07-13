import { getOrCreateDbUser } from '@/app/lib/current-user';
import { resultResponse } from '@/app/lib/http';
import { createPhonemeSvc, listPhonemesSvc } from '@/app/lib/phonemes';

/** Route segment params for language-specific phoneme endpoints. */
type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/languages/[id]/phonemes
 * Returns all the phonemes in a language owned by the authenticated user.
 * Returns 404 if the language doesn't exist or belongs to another user.
 */
export async function GET(_req: Request, { params }: Params) {
  const user = await getOrCreateDbUser();
  if (!user) return new Response(null, { status: 401 });

  const { id } = await params;
  const result = await listPhonemesSvc(user, id);
  return resultResponse(result);
}

/**
 * POST /api/languages/[id]/phonemes
 * Creates a new phoneme for the language owned by the authenticated user.
 * Returns 404 if the language doesn't exist or belongs to another user.
 * Body: `{ symbol: string; ipa?: string; weight?: number }`
 * Returns the created phoneme row with status 201.
 */
export async function POST(req: Request, { params }: Params) {
  const user = await getOrCreateDbUser();
  if (!user) return new Response(null, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const result = await createPhonemeSvc(user, id, body);
  return resultResponse(result, 201);
}
