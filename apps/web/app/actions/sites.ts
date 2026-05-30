"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase";
import { requireCurrentUser } from "@/lib/auth";
import { callWpStatus } from "@/lib/wp-api";
import { logger } from "@/lib/logger";
import { ensureProjectForSite } from "./projects";
import type { Site } from "@/types/database";

const createSiteSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  wp_site_url: z
    .string()
    .url("Enter a full URL including https://")
    .refine((u) => u.startsWith("https://") || u.startsWith("http://"), "URL must start with http(s)://"),
});

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function generateApiKey(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Generate a 32-byte (64 hex char) webhook signing secret. Stronger than
 * the api_key because it's used for HMAC-SHA256 signatures — collisions
 * matter more, and the user only pastes it once into the plugin so length
 * doesn't hurt UX.
 */
function generateWebhookSecret(): string {
  return randomBytes(32).toString("hex");
}

function deriveDomain(wpSiteUrl: string): string {
  try {
    return new URL(wpSiteUrl).hostname.toLowerCase();
  } catch {
    return wpSiteUrl.toLowerCase();
  }
}

export async function listSites(): Promise<Site[]> {
  const user = await requireCurrentUser();
  if (!user.profile) return [];

  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("sites")
    .select("*")
    .eq("user_id", user.profile.id)
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("Failed to list sites", error, { userId: user.profile.id });
    return [];
  }
  return (data ?? []) as Site[];
}

export async function getSite(siteId: string): Promise<Site | null> {
  await requireCurrentUser();
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("sites")
    .select("*")
    .eq("id", siteId)
    .maybeSingle();

  if (error) {
    logger.error("Failed to load site", error, { siteId });
    return null;
  }
  return (data as Site) ?? null;
}

export async function createSite(
  _prev: ActionResult<Site> | null,
  formData: FormData
): Promise<ActionResult<Site>> {
  const parsed = createSiteSchema.safeParse({
    name: formData.get("name"),
    wp_site_url: formData.get("wp_site_url"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const user = await requireCurrentUser();
  if (!user.profile) {
    return { ok: false, error: "User profile not found. Try signing out and back in." };
  }

  const wpSiteUrl = parsed.data.wp_site_url.replace(/\/+$/, "");
  const domain = deriveDomain(wpSiteUrl);
  const apiKey = generateApiKey();
  // Generated alongside the api_key so the wizard can display both
  // together in a single one-time-reveal flow.
  const webhookSecret = generateWebhookSecret();

  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("sites")
    .insert({
      user_id: user.profile.id,
      type: "WORDPRESS",
      name: parsed.data.name,
      domain,
      wp_site_url: wpSiteUrl,
      api_key: apiKey,
      webhook_secret: webhookSecret,
      is_active: false,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "A site with that domain is already connected." };
    }
    logger.error("Failed to create site", error, { domain });
    return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard");
  return { ok: true, data: data as Site };
}

export async function verifySiteConnection(
  siteId: string
): Promise<ActionResult<{ wp_version: string; site_name: string }>> {
  const site = await getSite(siteId);
  if (!site) {
    return { ok: false, error: "Site not found." };
  }
  if (!site.api_key) {
    return { ok: false, error: "Site is missing an API key." };
  }

  const result = await callWpStatus(site.wp_site_url, site.api_key);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  const supabase = createServerSupabase();
  // Backfill the webhook_secret for legacy sites created before migration
  // 00005 — they have NULL secrets, so the verify flow doubles as the
  // opt-in path for webhooks.
  const updatePayload: Record<string, unknown> = {
    is_active: true,
    wp_rest_url: result.wpRestUrl,
  };
  if (!site.webhook_secret) {
    updatePayload.webhook_secret = generateWebhookSecret();
  }
  const { error } = await supabase
    .from("sites")
    .update(updatePayload)
    .eq("id", siteId);

  if (error) {
    logger.error("Failed to update site after verify", error, { siteId });
    return { ok: false, error: "Verified the site but failed to save status. Try again." };
  }

  // Idempotent — only creates a project the first time the site verifies.
  await ensureProjectForSite(siteId);

  revalidatePath("/dashboard");
  return {
    ok: true,
    data: { wp_version: result.info.wp_version, site_name: result.info.site_name },
  };
}

export async function deleteSite(siteId: string): Promise<ActionResult<null>> {
  await requireCurrentUser();
  const supabase = createServerSupabase();
  const { error } = await supabase.from("sites").delete().eq("id", siteId);

  if (error) {
    logger.error("Failed to delete site", error, { siteId });
    return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard");
  return { ok: true, data: null };
}
