import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";

/**
 * WordPress → Dashboard webhook receiver.
 *
 * Auth: HMAC-SHA256 signature in the X-Workforce-Signature header, computed
 * over the raw request body using the per-site `webhook_secret` stored in
 * the `sites` table (set by createSite / verifySiteConnection).
 *
 * No Supabase session / cookie auth — this route is hit by the plugin
 * running on the customer's WP install, not by a logged-in dashboard user.
 * The signature IS the auth. After verifying, we use the admin client to
 * bypass RLS for the cache upsert.
 *
 * Payload shape:
 *   {
 *     event: "post.updated" | "post.deleted",
 *     timestamp: number,   // unix seconds, validated against MAX_EVENT_AGE
 *     page?: {             // present when event === "post.updated"
 *       wp_post_id: number,
 *       post_type: "post" | "page",
 *       title: string,
 *       url: string,
 *       status: string,
 *       last_modified: string,   // WP GMT format
 *     },
 *     wp_post_id?: number, // present when event === "post.deleted"
 *   }
 */

// Reject events older than 5 minutes (basic replay-attack defence). The
// plugin includes a unix timestamp in the payload and the dashboard
// trusts its own clock.
const MAX_EVENT_AGE_SECONDS = 300;

interface WebhookPayload {
  event: "post.updated" | "post.deleted";
  timestamp: number;
  page?: {
    wp_post_id: number;
    post_type: "post" | "page";
    title: string;
    url: string;
    status: string;
    last_modified: string;
  };
  wp_post_id?: number;
}

function gmtToIso(gmt: string): string {
  if (!gmt || gmt.trim() === "") return new Date().toISOString();
  return gmt.replace(" ", "T") + "Z";
}

/**
 * Constant-time comparison of two hex-encoded HMAC signatures. Returns
 * false on any length mismatch (timingSafeEqual would throw). Required
 * to avoid the leak-through-timing class of attacks.
 */
function signaturesMatch(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { siteId: string } }
) {
  const { siteId } = params;

  // Read the raw body BEFORE parsing JSON so we hash exactly what the
  // sender signed. JSON.stringify roundtrip would re-serialize and
  // potentially produce different bytes.
  const rawBody = await request.text();
  const providedSig = request.headers.get("X-Workforce-Signature") ?? "";

  if (!providedSig) {
    return NextResponse.json({ ok: false, error: "Missing signature" }, { status: 401 });
  }

  // Admin client — RLS bypass justified by HMAC auth above.
  const supabase = createAdminClient();

  const { data: site, error: siteError } = await supabase
    .from("sites")
    .select("id, webhook_secret")
    .eq("id", siteId)
    .maybeSingle();

  // Return 401 (not 404) for the missing-site case too so an attacker
  // can't enumerate site IDs by status code.
  if (siteError || !site?.webhook_secret) {
    return NextResponse.json({ ok: false, error: "Invalid site or signature" }, { status: 401 });
  }

  const expectedSig = createHmac("sha256", site.webhook_secret).update(rawBody).digest("hex");
  if (!signaturesMatch(providedSig, expectedSig)) {
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  // Replay-window check. Plugin's timestamp is unix seconds.
  if (typeof payload.timestamp !== "number") {
    return NextResponse.json({ ok: false, error: "Missing timestamp" }, { status: 400 });
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - payload.timestamp) > MAX_EVENT_AGE_SECONDS) {
    return NextResponse.json(
      { ok: false, error: "Event timestamp outside allowed window" },
      { status: 400 }
    );
  }

  if (payload.event === "post.updated") {
    const page = payload.page;
    if (!page) {
      return NextResponse.json({ ok: false, error: "Missing page data" }, { status: 400 });
    }
    const { error } = await supabase.from("pages").upsert(
      {
        site_id: siteId,
        wp_post_id: page.wp_post_id,
        type: page.post_type === "post" ? "POST" : "PAGE",
        title: page.title,
        url: page.url,
        status: page.status,
        last_updated: gmtToIso(page.last_modified),
      },
      { onConflict: "site_id,wp_post_id,type" }
    );
    if (error) {
      logger.error("Webhook page upsert failed", error, { siteId, wp_post_id: page.wp_post_id });
      return NextResponse.json({ ok: false, error: "Database error" }, { status: 500 });
    }
  } else if (payload.event === "post.deleted") {
    const wpPostId = payload.wp_post_id;
    if (typeof wpPostId !== "number") {
      return NextResponse.json({ ok: false, error: "Missing wp_post_id" }, { status: 400 });
    }
    const { error } = await supabase
      .from("pages")
      .delete()
      .eq("site_id", siteId)
      .eq("wp_post_id", wpPostId);
    if (error) {
      logger.error("Webhook page delete failed", error, { siteId, wp_post_id: wpPostId });
      return NextResponse.json({ ok: false, error: "Database error" }, { status: 500 });
    }
  } else {
    return NextResponse.json({ ok: false, error: "Unknown event" }, { status: 400 });
  }

  // Invalidate the dashboard's cached render of the pages browser so the
  // change shows up on next visit. The user is not currently looking at
  // the page (this is a server-to-server call), but they may be soon.
  revalidatePath(`/dashboard/sites/${siteId}/pages`);

  return NextResponse.json({ ok: true });
}
