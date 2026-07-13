import { getOrCreateDbUser } from '@/app/lib/current-user';
import { resultResponse } from '@/app/lib/http';
import {
  createSyllableStructureSvc,
  listSyllableStructuresSvc,
} from '@/app/lib/syllables';

/** Route segment params for language-specific phoneme endpoints. */
type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/languages/[id]/syllables
 * Returns all the syllable structures in a language owned by the authenticated user.
 * Returns 404 if the language doesn't exist or belongs to another user.
 */
export async function GET(_req: Request, { params }: Params) {
  const user = await getOrCreateDbUser();
  if (!user) return new Response(null, { status: 401 });

  const { id } = await params;
  const result = await listSyllableStructuresSvc(user, id);
  return resultResponse(result);
}

/**
 * POST /api/languages/[id]/syllables
 * Creates a new syllable structure for the language owned by the authenticated user.
 * Returns 404 if the language doesn't exist or belongs to another user.
 * Body: `{ weight?: number; template: ({ kind: "group"; groupId: string; optional: boolean; } | { kind: "phoneme"; phonemeId: string; optional: boolean; })[] }`
 * Returns the created phoneme row with status 201.
 */
export async function POST(req: Request, { params }: Params) {
  const user = await getOrCreateDbUser();
  if (!user) return new Response(null, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const result = await createSyllableStructureSvc(user, id, body);
  return resultResponse(result, 201);
}
