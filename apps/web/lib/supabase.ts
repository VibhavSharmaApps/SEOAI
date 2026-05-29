import { createClient } from "@supabase/supabase-js";
import {
  createServerClient as createSSRServerClient,
  createBrowserClient as createSSRBrowserClient,
  type CookieOptions,
} from "@supabase/ssr";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import { env, serverEnv } from "./env";

// Service role client — bypasses RLS. Use for system operations (cron syncs,
// admin tasks) that need to operate outside of any user's session.
export function createAdminClient() {
  return createClient(env.supabase.url, serverEnv.supabase.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Server Component / Server Action client — reads & writes the auth cookie
// via next/headers. Respects RLS. The setAll / getAll wiring is what keeps
// the user's session refreshed across Server Component renders.
export function createServerSupabase() {
  const cookieStore = cookies();
  return createSSRServerClient(env.supabase.url, env.supabase.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Calling .set() from a Server Component throws — that's expected.
          // Middleware handles the refresh, so swallowing the error here is safe.
        }
      },
    },
  });
}

// Middleware client — refreshes the session cookie on every request.
// Mutates the supplied response to attach updated cookies.
export function createMiddlewareSupabase(
  request: NextRequest,
  response: NextResponse
) {
  return createSSRServerClient(env.supabase.url, env.supabase.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options: CookieOptions }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });
}

// Client Component client — browser-side, handles auth events and real-time.
export function createBrowserSupabase() {
  return createSSRBrowserClient(env.supabase.url, env.supabase.anonKey);
}
