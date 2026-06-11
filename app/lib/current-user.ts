import 'server-only';
import { cache } from 'react';
import { auth, currentUser } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { db } from '@/app/db';
import { users } from '@/app/db/schema';

/**
 * Resolves the Clerk session to a DB user row, creating one on first sign-in.
 * Returns null if the request is unauthenticated.
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
