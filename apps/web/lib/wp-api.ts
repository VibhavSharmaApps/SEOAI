/**
 * Server-only helpers for talking to a WordPress site's Workforce REST API.
 *
 * Auth: every endpoint requires an `X-Workforce-Key` header matching the key
 * the user pasted into WP admin → Workforce SEO → Settings.
 */

import { logger } from "./logger";

const STATUS_TIMEOUT_MS = 10_000;
// Pages can carry several KB of content vs the small JSON status payload.
// Give them a longer timeout so larger blog posts aren't cut off on slow hosts.
const PAGE_TIMEOUT_MS = 15_000;

export interface WpStatusInfo {
  status: string;
  version: string;
  site_url: string;
  site_name: string;
  wp_version: string;
  php_version: string;
}

export type WpStatusResult =
  | { ok: true; info: WpStatusInfo; wpRestUrl: string }
  | { ok: false; error: string };

function normalizeBase(wpSiteUrl: string): string {
  return wpSiteUrl.replace(/\/+$/, "");
}

export async function callWpStatus(
  wpSiteUrl: string,
  apiKey: string
): Promise<WpStatusResult> {
  const base = normalizeBase(wpSiteUrl);
  const url = `${base}/wp-json/workforce/v1/status`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), STATUS_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-Workforce-Key": apiKey,
        Accept: "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (response.status === 404) {
      return {
        ok: false,
        error:
          "Plugin endpoint not found. Make sure the Workforce SEO plugin is installed and activated on this site.",
      };
    }
    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        error:
          "API key was rejected. Re-copy the key from this dashboard and paste it into WP admin → Workforce SEO → Settings.",
      };
    }
    if (!response.ok) {
      return {
        ok: false,
        error: `WordPress returned HTTP ${response.status}.`,
      };
    }

    const info = (await response.json()) as WpStatusInfo;
    return {
      ok: true,
      info,
      wpRestUrl: `${base}/wp-json`,
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return {
        ok: false,
        error: "Connection timed out. Make sure the site URL is reachable from the internet.",
      };
    }
    logger.warn("WP status fetch failed", { url, error: String(err) });
    return {
      ok: false,
      error: "Could not reach the site. Check that the URL is correct and the site is online.",
    };
  } finally {
    clearTimeout(timer);
  }
}

// ============================================================
// Single-page fetch
// ============================================================
// These types mirror what the plugin's Workforce_SEO_Analyzer::extract_page_data()
// method returns. Kept here as the canonical TypeScript view of that PHP
// output — if the plugin changes its shape, this is the file to update.

export interface WpHeading {
  level: number;
  text: string;
}

export interface WpFaqCandidate {
  question: string;
  answer: string;
  heading_level: number;
}

export interface WpPageData {
  wp_post_id: number;
  post_type: "post" | "page";
  title: string;
  url: string;
  content: string;
  excerpt: string;
  meta_title: string;
  meta_desc: string;
  focus_keyword: string;
  h1: string;
  headings: WpHeading[];
  word_count: number;
  last_modified: string;
  faq_candidates: WpFaqCandidate[];
  // Existing schema JSON-LD previously injected by this plugin into the
  // post's _workforce_schema meta. `null` when no schema exists.
  current_schema: string | null;
}

export type WpPageResult =
  | { ok: true; data: WpPageData }
  | { ok: false; error: string };

/**
 * Fetch a single post/page's SEO data from a connected WordPress site.
 *
 * Calls GET /wp-json/workforce/v1/pages/{postId} on the site's Workforce plugin
 * and unwraps the { success, data } envelope. Returns a discriminated union so
 * callers handle the error path without try/catch.
 */
export async function fetchPageData(
  wpSiteUrl: string,
  apiKey: string,
  postId: number
): Promise<WpPageResult> {
  const base = normalizeBase(wpSiteUrl);
  const url = `${base}/wp-json/workforce/v1/pages/${postId}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-Workforce-Key": apiKey,
        Accept: "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (response.status === 404) {
      // A 404 can mean either the plugin route is missing (old plugin
      // version) OR the post doesn't exist. The plugin's handler returns
      // { success: false, error: "Post not found" } for the latter, so we
      // try to parse the body for a more specific message.
      try {
        const body = await response.json();
        return { ok: false, error: body?.error ?? "Page not found." };
      } catch {
        return {
          ok: false,
          error: "Plugin endpoint not found. Update the Workforce SEO plugin on this site.",
        };
      }
    }
    if (response.status === 401 || response.status === 403) {
      return { ok: false, error: "API key was rejected by WordPress." };
    }
    if (!response.ok) {
      return { ok: false, error: `WordPress returned HTTP ${response.status}.` };
    }

    const body = (await response.json()) as {
      success: boolean;
      data?: WpPageData;
      error?: string;
    };
    if (!body.success || !body.data) {
      return { ok: false, error: body.error ?? "Plugin returned an unexpected response." };
    }
    return { ok: true, data: body.data };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, error: "Connection timed out fetching page data." };
    }
    logger.warn("WP page fetch failed", { url, error: String(err) });
    return { ok: false, error: "Could not reach the site to fetch page data." };
  } finally {
    clearTimeout(timer);
  }
}

// ============================================================
// Audit log fetch
// ============================================================
// Read-only view of a post's `_workforce_seo_log` entries — written by
// the plugin's log_seo_update() helper after every successful /execute call.

export interface WpAuditEntry {
  operation: string;
  fields: string[];
  // Present on post-B3 entries — array of { name, old, new } objects.
  // Older entries omit this; the dashboard tells revertable from
  // non-revertable entries by checking presence.
  changes?: Array<{ name: string; old: string | null; new: string | null }>;
  timestamp: string;
  source: string;
}

export interface WpAuditData {
  entries: WpAuditEntry[];
}

export type WpAuditResult =
  | { ok: true; data: WpAuditData }
  | { ok: false; error: string };

/**
 * Fetch the change history for a single post from the connected WP site's
 * plugin. Returns the raw entries; ordering, formatting, and display caps
 * are the caller's responsibility.
 */
export async function fetchPageAudit(
  wpSiteUrl: string,
  apiKey: string,
  postId: number
): Promise<WpAuditResult> {
  const base = normalizeBase(wpSiteUrl);
  const url = `${base}/wp-json/workforce/v1/pages/${postId}/audit`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-Workforce-Key": apiKey,
        Accept: "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (response.status === 404) {
      try {
        const body = await response.json();
        return { ok: false, error: body?.error ?? "Audit endpoint not found." };
      } catch {
        return {
          ok: false,
          error: "Plugin endpoint not found. Update the Workforce SEO plugin on this site.",
        };
      }
    }
    if (response.status === 401 || response.status === 403) {
      return { ok: false, error: "API key was rejected by WordPress." };
    }
    if (!response.ok) {
      return { ok: false, error: `WordPress returned HTTP ${response.status}.` };
    }

    const body = (await response.json()) as {
      success: boolean;
      data?: WpAuditData;
      error?: string;
    };
    if (!body.success || !body.data) {
      return { ok: false, error: body.error ?? "Plugin returned an unexpected response." };
    }
    return { ok: true, data: body.data };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, error: "Connection timed out fetching audit history." };
    }
    logger.warn("WP audit fetch failed", { url, error: String(err) });
    return { ok: false, error: "Could not reach the site to fetch audit history." };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Revert a single audit log entry on a connected WP site. The plugin
 * replays each change's `old` value back to the corresponding meta field
 * and logs the revert as a new audit entry. Returns the names of changes
 * that were successfully reverted and the names of any that were skipped
 * (e.g. content/title — `old` wasn't captured for size reasons).
 */
export interface WpRevertResult {
  ok: true;
  reverted: string[];
  skipped: string[];
}

export type WpRevertResponse = WpRevertResult | { ok: false; error: string };

export async function revertAuditEntry(
  wpSiteUrl: string,
  apiKey: string,
  postId: number,
  entryIndex: number
): Promise<WpRevertResponse> {
  const base = normalizeBase(wpSiteUrl);
  const url = `${base}/wp-json/workforce/v1/pages/${postId}/revert`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "X-Workforce-Key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ entry_index: entryIndex }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (response.status === 404) {
      try {
        const body = await response.json();
        return { ok: false, error: body?.error ?? "Audit entry not found." };
      } catch {
        return {
          ok: false,
          error: "Plugin endpoint not found. Update the Workforce SEO plugin on this site.",
        };
      }
    }
    if (response.status === 401 || response.status === 403) {
      return { ok: false, error: "API key was rejected by WordPress." };
    }
    if (response.status === 400) {
      try {
        const body = await response.json();
        return { ok: false, error: body?.error ?? "Revert rejected by plugin." };
      } catch {
        return { ok: false, error: "Revert rejected by plugin." };
      }
    }
    if (!response.ok) {
      return { ok: false, error: `WordPress returned HTTP ${response.status}.` };
    }

    const body = (await response.json()) as {
      success: boolean;
      reverted?: string[];
      skipped?: string[];
      error?: string;
    };
    if (!body.success) {
      return { ok: false, error: body.error ?? "Plugin returned an unexpected response." };
    }
    return {
      ok: true,
      reverted: body.reverted ?? [],
      skipped: body.skipped ?? [],
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, error: "Connection timed out reverting audit entry." };
    }
    logger.warn("WP revert failed", { url, error: String(err) });
    return { ok: false, error: "Could not reach the site to revert." };
  } finally {
    clearTimeout(timer);
  }
}

// ============================================================
// Pages list fetch
// ============================================================
// Lighter shape than WpPageData — used by the dashboard's pages browser
// where we render dozens of rows and don't need content/headings per row.

export interface WpPageSummary {
  wp_post_id: number;
  post_type: "post" | "page";
  title: string;
  url: string;
  last_modified: string;
  status: string;
}

export interface WpPagesListData {
  pages: WpPageSummary[];
  total: number;
  limit: number;
  offset: number;
}

export type WpPagesListResult =
  | { ok: true; data: WpPagesListData }
  | { ok: false; error: string };

export type WpPagesOrderBy = "modified" | "date" | "title";
export type WpPagesOrder = "ASC" | "DESC";
export type WpPagesStatus = "any" | "publish" | "draft";

/**
 * Fetch a paginated list of posts/pages from the connected WordPress site.
 *
 * Calls GET /wp-json/workforce/v1/pages with sort/filter/search params and
 * unwraps the { success, data } envelope. The plugin whitelists every
 * option server-side, so unknown values silently fall back to defaults
 * (`modified DESC`, both statuses, no search) rather than erroring.
 */
export async function fetchPagesList(
  wpSiteUrl: string,
  apiKey: string,
  opts?: {
    limit?: number;
    offset?: number;
    orderby?: WpPagesOrderBy;
    order?: WpPagesOrder;
    status?: WpPagesStatus;
    search?: string;
  }
): Promise<WpPagesListResult> {
  const base = normalizeBase(wpSiteUrl);
  const params = new URLSearchParams();
  if (opts?.limit !== undefined) params.set("limit", String(opts.limit));
  if (opts?.offset !== undefined) params.set("offset", String(opts.offset));
  if (opts?.orderby) params.set("orderby", opts.orderby);
  if (opts?.order) params.set("order", opts.order);
  // Plugin treats "any" as the default (publish+draft) so we only need to
  // send the param when the caller wants to filter to a single status.
  if (opts?.status && opts.status !== "any") params.set("status", opts.status);
  if (opts?.search && opts.search.trim().length > 0) {
    params.set("s", opts.search.trim());
  }
  const qs = params.toString();
  const url = `${base}/wp-json/workforce/v1/pages${qs ? `?${qs}` : ""}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-Workforce-Key": apiKey,
        Accept: "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (response.status === 404) {
      try {
        const body = await response.json();
        return { ok: false, error: body?.error ?? "Pages endpoint not found." };
      } catch {
        return {
          ok: false,
          error: "Plugin endpoint not found. Update the Workforce SEO plugin on this site.",
        };
      }
    }
    if (response.status === 401 || response.status === 403) {
      return { ok: false, error: "API key was rejected by WordPress." };
    }
    if (!response.ok) {
      return { ok: false, error: `WordPress returned HTTP ${response.status}.` };
    }

    const body = (await response.json()) as {
      success: boolean;
      data?: WpPagesListData;
      error?: string;
    };
    if (!body.success || !body.data) {
      return { ok: false, error: body.error ?? "Plugin returned an unexpected response." };
    }
    return { ok: true, data: body.data };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, error: "Connection timed out fetching pages list." };
    }
    logger.warn("WP pages list fetch failed", { url, error: String(err) });
    return { ok: false, error: "Could not reach the site to list pages." };
  } finally {
    clearTimeout(timer);
  }
}
