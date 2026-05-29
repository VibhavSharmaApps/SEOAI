import { createServerSupabase } from "./supabase";
import type { Site } from "@/types/database";

export interface CurrentUser {
  authId: string;
  email: string;
  profile: {
    id: string;
    auth_id: string;
    email: string;
    name: string | null;
    created_at: string;
    updated_at: string;
  } | null;
}

// Returns the current authenticated user (auth + public.users profile row) or
// null if not signed in. Server-side only — calling from a Client Component
// will throw because createServerSupabase uses next/headers cookies().
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = createServerSupabase();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser || !authUser.email) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("auth_id", authUser.id)
    .maybeSingle();

  return {
    authId: authUser.id,
    email: authUser.email,
    profile: profile ?? null,
  };
}

// Throws if not signed in. Use in Server Components inside /dashboard where
// middleware has already guaranteed a session — the throw is defense in depth.
export async function requireCurrentUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Not authenticated — middleware should have redirected");
  }
  return user;
}

// Returns the current user's most-recently-added active site, or null. RLS
// scopes the query to the signed-in user.
export async function getDefaultSiteForCurrentUser(): Promise<Site | null> {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("sites")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Site) ?? null;
}
