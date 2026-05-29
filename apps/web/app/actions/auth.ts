"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

const signUpSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required").max(100),
});

const signInSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export type AuthState =
  | { ok: true; message?: string }
  | { ok: false; error: string };

export async function signUp(
  _prev: AuthState | null,
  formData: FormData
): Promise<AuthState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    name: formData.get("name"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = createServerSupabase();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { name: parsed.data.name },
      emailRedirectTo: `${env.app.url}/auth/callback`,
    },
  });

  if (error) {
    logger.warn("Signup failed", { email: parsed.data.email, error: error.message });
    return { ok: false, error: error.message };
  }

  // Auto-confirm on → we have a session → client navigates to /dashboard.
  // Confirm-email on → session null → client shows the "check your email" state.
  if (data.session) {
    revalidatePath("/", "layout");
    return { ok: true };
  }

  return {
    ok: true,
    message: "Check your email for a confirmation link to finish signing up.",
  };
}

export async function signIn(
  _prev: AuthState | null,
  formData: FormData
): Promise<AuthState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    logger.warn("Sign-in failed", { email: parsed.data.email, error: error.message });
    return { ok: false, error: error.message };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function signOut() {
  const supabase = createServerSupabase();
  await supabase.auth.signOut();
  redirect("/");
}
