import 'server-only';
import { cache } from 'react';
import { auth, currentUser } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { db } from '@/app/db';
import { users } from '@/app/db/schema';

/**
 * Resolves the Clerk session to a DB user row, creating one on first sign-in.
 * Returns null if the request is unauthenticated.
 *
 * Wrapped in React's `cache` so repeated calls within the same request share
 * a single DB round-trip.
 *
 * NOTE: This function **writes** — it inserts a user row on first call for a
 * given Clerk account. An otherwise read-only route that calls it (e.g. a GET
 * handler or a Server Component) can therefore trigger a DB insert. That is the
 * intended lazy-provisioning model; callers should be aware of this side effect.
 */
export const getOrCreateDbUser = cache(async () => {
  const { userId } = await auth();
  if (!userId) return null;

  const existing = await db.query.users.findFirst({
    where: eq(users.clerk_id, userId),
  });
  if (existing) return existing;

  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const email = clerkUser.emailAddresses[0]?.emailAddress ?? '';

  const [created] = await db
    .insert(users)
    .values({ clerk_id: userId, email })
    .returning();

  return created ?? null;
});
