"use server";

import { revalidatePath } from "next/cache";
import { getSite } from "./sites";
import { fetchPagesList } from "@/lib/wp-api";
import { createServerSupabase } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import type {
  WpPageSummary,
  WpPagesOrder,
  WpPagesOrderBy,
  WpPagesStatus,
} from "@/lib/wp-api";

/**
 * Pages-table cache layer.
 *
 * Phase 3 originally fetched the WP plugin's /pages endpoint on every
 * dashboard render. With the migration 00004 cache, listSitePages now
 * reads from the local `pages` Supabase table instead and only hits
 * WordPress when:
 *   1. The cache is empty (first visit) — auto-populate.
 *   2. The user explicitly clicks "Refresh from WP" (refresh: true).
 *   3. A future real-time webhook (Wave B B2) triggers a sync.
 *
 * The cache reads always go through Supabase RLS via createServerSupabase,
 * so a user-supplied siteId can't reach another user's cached pages.
 */

const PER_PAGE = 100;

/**
 * Convert a WP MySQL GMT timestamp ("2024-01-15 14:30:00") to an ISO 8601
 * UTC string so Postgres's TIMESTAMPTZ parses it correctly. Empty strings
 * fall back to "now" so we never write a NULL into a NOT NULL column.
 */
function gmtToIso(gmt: string): string {
  if (!gmt || gmt.trim() === "") return new Date().toISOString();
  return gmt.replace(" ", "T") + "Z";
}

/**
 * Walk the WP plugin's /pages endpoint in batches of PER_PAGE and upsert
 * each batch into the local `pages` cache. Idempotent — re-running on the
 * same site just refreshes existing rows in place via the
 * (site_id, wp_post_id, type) unique constraint.
 */
export async function syncPagesForSite(
  siteId: string
): Promise<{ ok: true; synced: number } | { ok: false; error: string }> {
  const site = await getSite(siteId);
  if (!site) {
    return { ok: false, error: "Site not found, or you don't have access to it." };
  }
  if (!site.api_key) {
    return {
      ok: false,
      error: "Site is missing an API key. Re-run the connection wizard.",
    };
  }

  const supabase = createServerSupabase();
  let synced = 0;
  let offset = 0;

  while (true) {
    const result = await fetchPagesList(site.wp_site_url, site.api_key, {
      limit: PER_PAGE,
      offset,
      // Sync EVERYTHING (publish + draft) so filtering by status is a
      // pure cache query later, not a re-sync trigger.
      status: "any",
    });
    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    const { pages, total } = result.data;
    if (pages.length === 0) break;

    const rows = pages.map((p) => ({
      site_id: siteId,
      wp_post_id: p.wp_post_id,
      type: p.post_type === "post" ? "POST" : "PAGE",
      title: p.title,
      url: p.url,
      status: p.status,
      last_updated: gmtToIso(p.last_modified),
    }));

    const { error } = await supabase
      .from("pages")
      .upsert(rows, { onConflict: "site_id,wp_post_id,type" });
    if (error) {
      logger.error("Failed to upsert pages batch", error, { siteId, offset });
      return { ok: false, error: error.message };
    }

    synced += pages.length;
    offset += pages.length;
    if (offset >= total) break;
    // Safety: less than a full page means we've hit the tail.
    if (pages.length < PER_PAGE) break;
  }

  return { ok: true, synced };
}

/**
 * Server-action wrapper around syncPagesForSite that revalidates the
 * pages browser route after sync. Used by the "Refresh from WP" button
 * in the dashboard so the new data appears without a full page reload.
 */
export async function refreshSitePages(
  siteId: string
): Promise<{ ok: true; synced: number } | { ok: false; error: string }> {
  const result = await syncPagesForSite(siteId);
  if (result.ok) {
    revalidatePath(`/dashboard/sites/${siteId}/pages`);
  }
  return result;
}

/**
 * Translate the dashboard's `orderby` values (which match the WP REST
 * args) to the equivalent pages-table column. Unknown values fall back
 * to last_updated to match the WP-side default.
 */
function orderColumn(orderby: WpPagesOrderBy | undefined): string {
  switch (orderby) {
    case "title":
      return "title";
    case "date":
      return "created_at";
    case "modified":
    default:
      return "last_updated";
  }
}

/**
 * Read a paginated, sorted, filtered slice from the local pages cache.
 * Returns the same `WpPageSummary[]` + total shape that the live fetch
 * does so the UI doesn't need to know whether it's looking at cached
 * or live data.
 */
async function readPagesFromCache(
  siteId: string,
  opts?: {
    limit?: number;
    offset?: number;
    orderby?: WpPagesOrderBy;
    order?: WpPagesOrder;
    status?: WpPagesStatus;
    search?: string;
  }
): Promise<
  | {
      ok: true;
      pages: WpPageSummary[];
      total: number;
      limit: number;
      offset: number;
    }
  | { ok: false; error: string }
> {
  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;
  const orderby = opts?.orderby ?? "modified";
  const order = opts?.order ?? "DESC";
  const status = opts?.status ?? "any";
  const search = opts?.search?.trim() ?? "";

  const supabase = createServerSupabase();

  let query = supabase
    .from("pages")
    .select("*", { count: "exact" })
    .eq("site_id", siteId);

  if (status === "publish" || status === "draft") {
    query = query.eq("status", status);
  }

  if (search.length > 0) {
    // % wildcards are added here; escape any user-supplied % or _ so they
    // act as literal characters rather than SQL pattern operators.
    const escaped = search.replace(/[%_]/g, "\\$&");
    query = query.ilike("title", `%${escaped}%`);
  }

  query = query.order(orderColumn(orderby), { ascending: order === "ASC" });
  query = query.range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  if (error) {
    logger.error("Failed to read pages cache", error, { siteId });
    return { ok: false, error: error.message };
  }

  // Map cache rows back to the WpPageSummary wire shape so callers don't
  // need to know about the storage layer.
  const pages: WpPageSummary[] = (data ?? []).map((row) => ({
    wp_post_id: row.wp_post_id,
    post_type: row.type === "POST" ? "post" : "page",
    title: row.title,
    url: row.url,
    last_modified: row.last_updated,
    status: row.status,
  }));

  return {
    ok: true,
    pages,
    total: count ?? 0,
    limit,
    offset,
  };
}

/**
 * List the connected site's posts/pages for the dashboard's pages browser.
 *
 * Reads from the local cache by default. Auto-populates on first visit
 * (empty cache → sync once → re-read). Pass `refresh: true` to force a
 * fresh sync regardless of cache state.
 *
 * Auth: getSite() is gated by requireCurrentUser() and scoped by Supabase
 * RLS, so a user-supplied siteId can't reach pages on another user's site.
 */
export async function listSitePages(
  siteId: string,
  opts?: {
    limit?: number;
    offset?: number;
    orderby?: WpPagesOrderBy;
    order?: WpPagesOrder;
    status?: WpPagesStatus;
    search?: string;
    refresh?: boolean;
  }
): Promise<
  | {
      ok: true;
      pages: WpPageSummary[];
      total: number;
      limit: number;
      offset: number;
    }
  | { ok: false; error: string }
> {
  const site = await getSite(siteId);
  if (!site) {
    return { ok: false, error: "Site not found, or you don't have access to it." };
  }

  // Explicit refresh — sync first, then read.
  if (opts?.refresh) {
    if (!site.api_key) {
      return {
        ok: false,
        error: "Site is missing an API key. Re-run the connection wizard.",
      };
    }
    const syncResult = await syncPagesForSite(siteId);
    if (!syncResult.ok) return { ok: false, error: syncResult.error };
  }

  const cached = await readPagesFromCache(siteId, opts);
  if (!cached.ok) return cached;

  // Lazy populate: empty cache + not already refreshed + have an API key
  // → sync once. If sync fails we return the empty cache rather than
  // surfacing an error to the user — a fresh user with no pages yet
  // shouldn't see a red error toast on their first visit.
  if (cached.total === 0 && !opts?.refresh && site.api_key) {
    const syncResult = await syncPagesForSite(siteId);
    if (!syncResult.ok) {
      logger.warn("Initial pages sync failed, returning empty cache", {
        siteId,
        error: syncResult.error,
      });
      return cached;
    }
    return await readPagesFromCache(siteId, opts);
  }

  return cached;
}
