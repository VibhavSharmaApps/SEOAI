import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Next.js Middleware
 * 
 * Note: Route protection for /dashboard is now handled at the page level
 * using Shopify session token verification instead of Clerk.
 * 
 * API routes verify Shopify session tokens directly in each route handler.
 * 
 * This middleware file is kept for future use but currently does not
 * enforce any authentication. All auth is handled via Shopify session tokens.
 */
export function middleware(request: NextRequest) {
  // Allow all requests - authentication is handled at page/API route level
  // using Shopify session token verification
  return NextResponse.next()
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
