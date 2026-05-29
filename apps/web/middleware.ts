import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareSupabase } from "@/lib/supabase";

const PROTECTED_PREFIXES = ["/dashboard"];
const AUTH_ONLY_PATHS = new Set(["/login", "/signup"]);

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  response.headers.set("X-DNS-Prefetch-Control", "on");
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );

  const supabase = createMiddlewareSupabase(request, response);
  // getUser() revalidates the JWT against Supabase's auth server — never use
  // getSession() for auth gating since it only reads the (potentially spoofed) cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
  const isAuthOnly = AUTH_ONLY_PATHS.has(path);

  if (isProtected && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", path);
    return NextResponse.redirect(loginUrl);
  }
  if (isAuthOnly && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes (have their own auth)
     * - _next/static, _next/image (static assets)
     * - favicon.ico
     * - auth/callback (route handler, no need for the guard)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|auth/callback).*)",
  ],
};
