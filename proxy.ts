/**
 * Clerk authentication middleware.
 * Home, sign-in, sign-up, and language-scoped routes are publicly accessible.
 * All other routes — including every API route — require an active Clerk session.
 *
 * Language routes (`/languages/[id]/...`) are public here so an anonymous
 * visitor can reach a public (`is_public`) language's pages — but NOT bare
 * `/languages` (the owner-scoped list). This is routing only, not the
 * authorization boundary: each page independently resolves visibility via
 * `parseAndRequireVisibleLanguage`, and mutation Server Actions independently
 * guard on `getOrCreateDbUser()` — so exposing the route here doesn't weaken
 * anything, it just lets the request reach that per-handler check.
 */
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/languages/:id',
  '/languages/:id/(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    if (req.nextUrl.pathname.startsWith('/api/')) {
      // API routes must return 401, not redirect to sign-in.
      // Real auth enforcement happens in each route handler via getOrCreateDbUser().
      const { userId } = await auth();
      if (!userId) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } else {
      await auth.protect();
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
    // Always run for Clerk-specific frontend API routes
    '/__clerk/(.*)',
  ],
};
