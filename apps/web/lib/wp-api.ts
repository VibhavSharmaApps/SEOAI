/**
 * Server-only helpers for talking to a WordPress site's Workforce REST API.
 *
 * Auth: every endpoint requires an `X-Workforce-Key` header matching the key
 * the user pasted into WP admin → Workforce SEO → Settings.
 */

import { logger } from "./logger";

const STATUS_TIMEOUT_MS = 10_000;

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
