"use server";

/**
 * SEO Gap Detection & Fixing — Server Actions
 *
 * Automatically detects SEO gaps (missing H1, meta tags, etc.) and uses AI
 * to generate the missing content, then applies it to WordPress via the plugin API.
 */

import { revalidatePath } from "next/cache";
import type {
  AuditLogEntry,
  PageSEOAnalysis,
  SEOGap,
  SEOGapFix,
  SEOGapFixOpResult,
  SEOGapFixResult,
  SEOGapType,
} from "@/types/seo-gaps";
import {
  buildAeoFaqSchema,
  combineSchemas,
  generateSchemaForPageType,
  schemaToJson,
} from "@/lib/schema-factory";
import { serverEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { fetchPageAudit, fetchPageData, revertAuditEntry } from "@/lib/wp-api";
import { getSite } from "./sites";
import {
  tryCreateAIProvider,
  withFallback,
  generateMetaTitleWithAI,
  generateMetaDescriptionWithAI,
  generateH1WithAI,
  generateFocusKeywordWithAI,
  generateSchemaDescriptionWithAI,
  generateFAQContentWithAI,
  type PageInput,
} from "@workforce/ai-agents";

// How many chars of page content to keep as the AI-prompt preview. The full
// HTML body can be hundreds of KB on long blog posts, but the agents only
// need the first chunk or so to understand the page's topic. 2000 chars
// covers ~300-400 words, plenty for headline/meta/keyword generation.
const CONTENT_PREVIEW_MAX = 2000;

function buildAgentPageInput(page: PageSEOAnalysis): PageInput {
  return {
    title: page.title,
    url: page.url,
    contentPreview: page.content_preview,
    focusKeyword: page.current_focus_keyword,
    currentMetaTitle: page.current_meta_title,
    currentMetaDescription: page.current_meta_description,
  };
}

function buildPrimaryAndFallback() {
  const primary = tryCreateAIProvider({
    anthropicKey: serverEnv.ai.anthropicKey,
    openaiKey: serverEnv.ai.openaiKey,
    prefer: "anthropic",
  });
  const fallback = tryCreateAIProvider({
    anthropicKey: serverEnv.ai.anthropicKey,
    openaiKey: serverEnv.ai.openaiKey,
    prefer: "openai",
  });
  const isSameProvider =
    primary && fallback && primary.name === fallback.name;
  return { primary, fallback: isSameProvider ? null : fallback };
}

/**
 * Fetch a real WordPress page through the connected site's plugin and run
 * the SEO gap detection on it. End-to-end entry point used by the dashboard
 * to populate the SEO gaps view with live data.
 *
 * Errors are returned as { ok: false, error } rather than thrown — callers
 * (Server Components) use the discriminated union to decide whether to
 * render the analysis or an error banner.
 *
 * Auth: relies on getSite() which is gated by requireCurrentUser() and
 * scoped by Supabase RLS, so it's safe to pass a user-supplied siteId.
 */
export async function analyzePageFromSite(
  siteId: string,
  postId: number
): Promise<
  | { ok: true; analysis: PageSEOAnalysis }
  | { ok: false; error: string }
> {
  const site = await getSite(siteId);
  if (!site) {
    return { ok: false, error: "Site not found, or you don't have access to it." };
  }
  if (!site.api_key) {
    return { ok: false, error: "Site is missing an API key. Re-run the connection wizard." };
  }

  const wpResult = await fetchPageData(site.wp_site_url, site.api_key, postId);
  if (!wpResult.ok) {
    return { ok: false, error: wpResult.error };
  }

  // Map the plugin's snake_case output into the PageSEOAnalysis shape that
  // detectSEOGaps + generateSEOGapFixes already expect. Empty strings from
  // PHP become `undefined` here so the downstream "missing" checks fire as
  // intended (they test for falsy values).
  const wp = wpResult.data;
  const analysis: PageSEOAnalysis = {
    wp_post_id: wp.wp_post_id,
    url: wp.url,
    title: wp.title,
    post_type: wp.post_type === "post" ? "post" : "page",
    content_preview: wp.content.slice(0, CONTENT_PREVIEW_MAX),
    current_h1: wp.h1 || undefined,
    current_meta_title: wp.meta_title || undefined,
    current_meta_description: wp.meta_desc || undefined,
    current_focus_keyword: wp.focus_keyword || undefined,
    // Plugin returns the existing _workforce_schema JSON as a string, or
    // null when none is set. Normalize null → undefined so detectSEOGaps's
    // falsy check fires the same way regardless of the wire format.
    current_schema: wp.current_schema ?? undefined,
    date_modified: wp.last_modified,
    gaps: [],
  };

  // Populate the gaps list using the same detector the demo path uses.
  // We pass the FULL content (not the truncated preview) here because the
  // detector's checks need the whole HTML body — e.g. it scans for an <h1>
  // anywhere in the content, not just the first 2000 chars.
  analysis.gaps = await detectSEOGaps({
    title: wp.title,
    content: wp.content,
    meta_title: analysis.current_meta_title,
    meta_description: analysis.current_meta_description,
    focus_keyword: analysis.current_focus_keyword,
    h1: analysis.current_h1,
    current_schema: analysis.current_schema,
    post_type: analysis.post_type,
  });

  return { ok: true, analysis };
}

/**
 * Run the full SEO fix flow against a real WordPress page: analyze →
 * generate → apply. End-to-end entry point used by the dashboard's "Apply
 * fixes" button. On success, revalidates the SEO gaps dashboard so the
 * gap count refreshes (gaps the plugin just resolved should disappear).
 *
 * Returns a discriminated union — never throws under normal conditions.
 * Auth is implicit via getSite() → requireCurrentUser() + Supabase RLS, so
 * a user-supplied siteId can't reach another user's site.
 */
export async function applyPageFixes(
  siteId: string,
  postId: number,
  // Optional whitelist of gap types to apply. When omitted (or empty),
  // every detected gap is applied — back-compat with the original
  // all-or-nothing button. The FixesList client component passes this
  // based on user checkbox selection.
  gapTypeFilter?: string[]
): Promise<
  | { ok: true; applied: number; results: SEOGapFixOpResult[] }
  | { ok: false; error: string }
> {
  // Step 1: build the analysis (auth, fetch from WP, detect gaps).
  const analysisResult = await analyzePageFromSite(siteId, postId);
  if (!analysisResult.ok) {
    return { ok: false, error: analysisResult.error };
  }
  const analysis = analysisResult.analysis;

  // Filter detected gaps to only the ones the user selected. We mutate the
  // fresh analysis object here (safe — nothing else references it). Filtering
  // BEFORE generation means we skip AI calls for fixes that wouldn't be
  // applied anyway, which keeps the cost proportional to user intent.
  if (gapTypeFilter && gapTypeFilter.length > 0) {
    const allowed = new Set(gapTypeFilter);
    analysis.gaps = analysis.gaps.filter((g) => allowed.has(g.type));
  }

  // Nothing to fix — bail before hitting the AI provider.
  if (analysis.gaps.length === 0) {
    return { ok: true, applied: 0, results: [] };
  }

  // Step 2: re-fetch the site for credentials. analyzePageFromSite already
  // hit getSite once but doesn't surface the row to its caller — fetching
  // again keeps the credential leak surface narrow. RLS makes this a
  // single indexed query so the cost is negligible.
  const site = await getSite(siteId);
  if (!site || !site.api_key) {
    return {
      ok: false,
      error: "Site connection lost between analysis and apply — try again.",
    };
  }

  // Step 3: generate fixes via AI + apply to WordPress via the plugin's
  // /execute endpoint. fixSEOGaps handles the batching and schema merge.
  const result = await fixSEOGaps(analysis, site.wp_site_url, site.api_key);
  const results = result.results ?? [];

  // Partial success is real success from the user's perspective — at least
  // some fixes landed. We only flip ok:false when the batch failed entirely
  // (network error, all operations rejected, etc.).
  const someSucceeded = results.some((r) => r.success);
  if (!someSucceeded) {
    return {
      ok: false,
      error: result.error ?? "WordPress reported failure applying fixes.",
    };
  }

  // Tell Next.js to drop the cached render so a re-detection runs and the
  // dashboard shows the new (lower) gap count.
  revalidatePath("/dashboard/seo-gaps");

  // `applied` counts successful operations only — the toast shows it
  // separately from the failed count for transparency.
  const applied = results.filter((r) => r.success).length;
  return { ok: true, applied, results };
}

/**
 * Fetch the change-history audit log for a single post. Read-only — used
 * by the dashboard's "Change history" card. Returns newest entries first
 * and caps the response so the UI can render a focused recent list rather
 * than 100 entries of paint.
 *
 * Auth: getSite() is RLS-scoped, so a user-supplied siteId can't reach
 * another user's audit log.
 */
export async function getPageAuditLog(
  siteId: string,
  postId: number,
  limit: number = 10
): Promise<
  | { ok: true; entries: AuditLogEntry[] }
  | { ok: false; error: string }
> {
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

  const result = await fetchPageAudit(site.wp_site_url, site.api_key, postId);
  if (!result.ok) return { ok: false, error: result.error };

  // Plugin appends oldest-first; UI wants newest-first. Reverse a copy
  // (avoid mutating the response object) and cap.
  const entries = [...result.data.entries].reverse().slice(0, limit);
  return { ok: true, entries };
}

/**
 * Revert a specific audit-log entry on a connected WP site. The entry's
 * `old` values get written back to the corresponding meta fields, and a
 * fresh audit entry is appended documenting the revert.
 *
 * Note: the dashboard surfaces entries newest-first (reversed from the
 * plugin's storage order), but the WP-side entry_index is in the
 * plugin's ORIGINAL order. Callers must translate before invoking —
 * see RevertButton component for the convention.
 *
 * Auth: getSite() is RLS-scoped, so a user-supplied siteId can't reach
 * another user's WP site.
 */
export async function revertPageEdit(
  siteId: string,
  postId: number,
  entryIndex: number
): Promise<
  | { ok: true; reverted: string[]; skipped: string[] }
  | { ok: false; error: string }
> {
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

  const result = await revertAuditEntry(
    site.wp_site_url,
    site.api_key,
    postId,
    entryIndex
  );
  if (!result.ok) return { ok: false, error: result.error };

  // Re-render the SEO gaps page so the gap detector picks up the reverted
  // state and the audit card refreshes with the new "revert" entry on top.
  revalidatePath("/dashboard/seo-gaps");

  return { ok: true, reverted: result.reverted, skipped: result.skipped };
}

/**
 * Analyze a page for SEO gaps
 *
 * @param page - Page data from WordPress
 * @returns Array of detected gaps
 */
export async function detectSEOGaps(page: {
  title: string;
  content: string;
  meta_title?: string;
  meta_description?: string;
  focus_keyword?: string;
  h1?: string;
  current_schema?: string;
  // post_type drives the "missing FAQ" check — only flagged for blog posts
  // (`post`), since static pages typically don't benefit from FAQ schema.
  post_type?: "post" | "page";
}): Promise<SEOGap[]> {
  const gaps: SEOGap[] = [];

  // Check for missing H1
  if (!page.h1 || page.h1.trim().length === 0) {
    gaps.push({
      type: "missing_h1",
      severity: "critical",
      message: "Page is missing an H1 heading",
    });
  }

  // Check for missing meta title
  if (!page.meta_title || page.meta_title.trim().length === 0) {
    gaps.push({
      type: "missing_meta_title",
      severity: "critical",
      message: "Page is missing a meta title",
    });
  } else {
    // Check meta title length
    const titleLength = page.meta_title.length;
    if (titleLength < 30) {
      gaps.push({
        type: "short_meta_title",
        severity: "high",
        message: "Meta title is too short",
        currentValue: page.meta_title,
        expectedRange: { min: 50, max: 60 },
      });
    } else if (titleLength > 60) {
      gaps.push({
        type: "long_meta_title",
        severity: "medium",
        message: "Meta title is too long",
        currentValue: page.meta_title,
        expectedRange: { min: 50, max: 60 },
      });
    }
  }

  // Check for missing meta description
  if (!page.meta_description || page.meta_description.trim().length === 0) {
    gaps.push({
      type: "missing_meta_description",
      severity: "critical",
      message: "Page is missing a meta description",
    });
  } else {
    // Check meta description length
    const descLength = page.meta_description.length;
    if (descLength < 120) {
      gaps.push({
        type: "short_meta_description",
        severity: "high",
        message: "Meta description is too short",
        currentValue: page.meta_description,
        expectedRange: { min: 150, max: 160 },
      });
    } else if (descLength > 160) {
      gaps.push({
        type: "long_meta_description",
        severity: "medium",
        message: "Meta description is too long",
        currentValue: page.meta_description,
        expectedRange: { min: 150, max: 160 },
      });
    }
  }

  // Check for missing focus keyword
  if (!page.focus_keyword || page.focus_keyword.trim().length === 0) {
    gaps.push({
      type: "missing_focus_keyword",
      severity: "high",
      message: "Page is missing a focus keyword",
    });
  }

  // Check for missing schema
  const schemaGap = detectSchemaGap(page.current_schema);
  if (schemaGap) {
    gaps.push(schemaGap);
  }

  // GEO: check for missing FAQ schema. Only flagged on blog posts — static
  // pages (about, contact, landing pages) typically aren't FAQ targets and
  // forcing them would dilute the citation signal for AI engines. If the
  // page already has FAQPage in its current schema (either standalone or
  // inside an @graph), no gap is flagged.
  if (page.post_type === "post" && !hasFAQSchema(page.current_schema)) {
    gaps.push({
      type: "missing_faq",
      severity: "medium",
      message:
        "Page is missing FAQ structured data — adding one improves citation by AI search engines (ChatGPT, Perplexity, Google AI Overviews)",
    });
  }

  return gaps;
}

/**
 * Detect whether the given schema JSON string already contains FAQPage
 * structured data — either as a standalone schema or inside an @graph
 * array. Returns false (and silently swallows parse errors) so a corrupt
 * schema doesn't suppress the missing_faq gap.
 */
function hasFAQSchema(currentSchema?: string): boolean {
  if (!currentSchema || currentSchema.trim().length === 0) return false;
  try {
    const parsed = JSON.parse(currentSchema);
    if (parsed?.["@type"] === "FAQPage") return true;
    if (Array.isArray(parsed?.["@graph"])) {
      return parsed["@graph"].some(
        (s: unknown) => (s as { "@type"?: string })?.["@type"] === "FAQPage"
      );
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Detect missing schema markup (internal helper)
 *
 * @param currentSchema - Existing schema JSON string (if any)
 * @returns Schema gap or null
 */
function detectSchemaGap(currentSchema?: string): SEOGap | null {
  // Check if schema exists and is valid
  if (!currentSchema || currentSchema.trim().length === 0) {
    return {
      type: "missing_schema",
      severity: "high",
      message: "Page is missing structured data (JSON-LD schema)",
    };
  }

  // Try to validate JSON
  try {
    const schema = JSON.parse(currentSchema);

    // Schema.org JSON-LD must have @context. Beyond that, EITHER a top-level
    // @type (single-entity schema like Article, FAQPage) OR an @graph array
    // (combined schema produced by combineSchemas() when both an Article
    // and FAQPage land on the same page) is valid.
    if (!schema["@context"]) {
      return {
        type: "missing_schema",
        severity: "high",
        message: "Existing schema is invalid (missing @context)",
        currentValue: currentSchema.substring(0, 100),
      };
    }
    if (!schema["@type"] && !schema["@graph"]) {
      return {
        type: "missing_schema",
        severity: "high",
        message: "Existing schema is invalid (missing @type or @graph)",
        currentValue: currentSchema.substring(0, 100),
      };
    }
  } catch (error) {
    return {
      type: "missing_schema",
      severity: "high",
      message: "Existing schema has invalid JSON syntax",
    };
  }

  return null;
}

/**
 * Generate fixes for SEO gaps using AI
 *
 * @param analysis - Page SEO analysis with detected gaps
 * @returns Generated fixes for each gap
 */
export async function generateSEOGapFixes(
  analysis: PageSEOAnalysis
): Promise<SEOGapFix[]> {
  if (analysis.gaps.length === 0) {
    return [];
  }

  const fixes: SEOGapFix[] = [];

  // `context` is a legacy free-form string that predates the typed PageInput
  // pipeline. Kept here because the helper signatures still accept it, but
  // the real AI prompts are built from analysis fields via buildAgentPageInput.
  const context = `
Page Title: ${analysis.title}
URL: ${analysis.url}
Content Preview: ${analysis.content_preview.substring(0, 500)}
${analysis.current_meta_title ? `Current Meta Title: ${analysis.current_meta_title}` : ""}
${analysis.current_meta_description ? `Current Meta Description: ${analysis.current_meta_description}` : ""}
${analysis.current_focus_keyword ? `Current Focus Keyword: ${analysis.current_focus_keyword}` : ""}
  `.trim();

  // Phase 1 — focus keyword first.
  //
  // The focus keyword feeds every downstream prompt (H1, meta title, meta
  // description) via PageInput.focusKeyword. If the page is missing one, we
  // generate it BEFORE the other agents run, then patch a shallow copy of the
  // analysis with the new keyword so subsequent generators see it. If the
  // page already has a focus keyword, this phase is a no-op and we fall
  // straight through to phase 2 using the original analysis.
  let workingAnalysis: PageSEOAnalysis = analysis;
  const focusKeywordGap = analysis.gaps.find((g) => g.type === "missing_focus_keyword");
  if (focusKeywordGap) {
    try {
      const fix = await generateFocusKeyword(null, context, analysis);
      fixes.push(fix);
      // Shallow copy is fine — we only need to override current_focus_keyword
      // for the duration of this call. The original analysis is untouched.
      workingAnalysis = { ...analysis, current_focus_keyword: fix.generated_content };
    } catch (error) {
      logger.error("Error generating fix for missing_focus_keyword", error, {
        gapType: "missing_focus_keyword",
      });
      // If the focus-keyword generator throws, fall through with the original
      // analysis — downstream agents still work, just without keyword priming.
    }
  }

  // Phase 2 — every other gap, using the enriched analysis. We skip
  // missing_focus_keyword here because it was already handled in phase 1.
  for (const gap of analysis.gaps) {
    if (gap.type === "missing_focus_keyword") continue;

    try {
      let fix: SEOGapFix | null = null;

      switch (gap.type) {
        case "missing_h1":
          fix = await generateH1(null, context, workingAnalysis);
          break;

        case "missing_meta_title":
        case "short_meta_title":
        case "long_meta_title":
          fix = await generateMetaTitle(null, context, workingAnalysis, gap);
          break;

        case "missing_meta_description":
        case "short_meta_description":
        case "long_meta_description":
          fix = await generateMetaDescription(null, context, workingAnalysis, gap);
          break;

        case "missing_schema":
          fix = await generateSchema(workingAnalysis);
          break;

        case "missing_faq":
          fix = await generateFAQ(workingAnalysis);
          break;
      }

      if (fix) {
        fixes.push(fix);
      }
    } catch (error) {
      logger.error(`Error generating fix for ${gap.type}`, error, { gapType: gap.type });
    }
  }

  return fixes;
}

/**
 * Apply SEO gap fixes to WordPress
 *
 * Sends fixes to the WordPress plugin's /execute endpoint to update the post.
 *
 * @param wpPostId - WordPress post ID
 * @param fixes - Array of generated fixes
 * @param wpSiteUrl - WordPress site URL
 * @param apiKey - WordPress plugin API key
 * @returns Result of the application
 */
export async function applySEOGapFixes(
  wpPostId: number,
  fixes: SEOGapFix[],
  wpSiteUrl: string,
  apiKey: string,
  // Optional: the page's CURRENT schema JSON (from analysis.current_schema).
  // When provided AND we have a faqFix but no schemaFix, we combine FAQ
  // with the existing schema instead of overwriting it. Callers that don't
  // pass this accept the overwrite behaviour for FAQ-only fixes.
  existingSchema?: string
): Promise<SEOGapFixResult> {
  if (fixes.length === 0) {
    return {
      wp_post_id: wpPostId,
      fixes: [],
      applied: true,
    };
  }

  try {
    // Prepare batch payload
    const operations: any[] = [];
    // Parallel array tracking which gap_types contributed to each operation
    // at the same index. After the batch response comes back, we use this
    // to map per-op success/failure back to per-fix outcome so the UI can
    // show which specific fixes landed and which didn't.
    const gapTypesPerOp: SEOGapType[][] = [];

    // Group fixes by type
    const metaGapTypes: SEOGapType[] = [];
    const metaFixes: Record<string, string> = {};
    let h1Fix: string | null = null;
    let schemaFix: string | null = null;
    let schemaGapType: SEOGapType | null = null;
    let faqFix: string | null = null;
    let faqGapType: SEOGapType | null = null;

    for (const fix of fixes) {
      switch (fix.gap_type) {
        case "missing_h1":
          h1Fix = fix.generated_content;
          break;

        case "missing_meta_title":
        case "short_meta_title":
        case "long_meta_title":
          metaFixes.meta_title = fix.generated_content;
          metaGapTypes.push(fix.gap_type);
          break;

        case "missing_meta_description":
        case "short_meta_description":
        case "long_meta_description":
          metaFixes.meta_description = fix.generated_content;
          metaGapTypes.push(fix.gap_type);
          break;

        case "missing_focus_keyword":
          metaFixes.focus_keyword = fix.generated_content;
          metaGapTypes.push(fix.gap_type);
          break;

        case "missing_schema":
          schemaFix = fix.generated_content;
          schemaGapType = fix.gap_type;
          break;

        case "missing_faq":
          // FAQ generation can produce an empty string when no AI provider
          // is configured or the model returned 0 valid pairs — treat as
          // "no FAQ to apply" rather than pushing an empty JSON-LD.
          if (fix.generated_content && fix.generated_content.trim().length > 0) {
            faqFix = fix.generated_content;
            faqGapType = fix.gap_type;
          }
          break;

        default:
          // Ignore other gap types
          break;
      }
    }

    // Add meta update operation
    if (Object.keys(metaFixes).length > 0) {
      operations.push({
        action: "update_meta",
        post_id: wpPostId,
        payload: metaFixes,
      });
      gapTypesPerOp.push(metaGapTypes);
    }

    // Add H1 update operation (prepend to content if missing)
    if (h1Fix) {
      operations.push({
        action: "update_post",
        post_id: wpPostId,
        payload: {
          prepend_h1: h1Fix, // Custom field for the plugin to handle
        },
      });
      gapTypesPerOp.push(["missing_h1"]);
    }

    // Schema injection. Four cases to handle:
    //   - Both schemaFix AND faqFix → combine via @graph and push one op
    //   - schemaFix only → push schemaFix as-is
    //   - faqFix only AND existingSchema → combine existing + FAQ
    //   - faqFix only AND no existingSchema → push FAQ alone (will overwrite
    //     anything previously stored, which is the documented limitation
    //     when callers don't pass existingSchema)
    // We push at most ONE update_schema op so the post's _workforce_schema
    // meta is written once per fix run, not twice with the second winning.
    const finalSchemaJson = buildFinalSchemaJson(schemaFix, faqFix, existingSchema);
    if (finalSchemaJson) {
      try {
        const schema = JSON.parse(finalSchemaJson);
        operations.push({
          action: "update_schema",
          post_id: wpPostId,
          payload: {
            schema,
          },
        });
        // Track which gap types contributed to this combined schema op so
        // we can attribute per-op success/failure correctly.
        const schemaGapTypes: SEOGapType[] = [];
        if (schemaGapType) schemaGapTypes.push(schemaGapType);
        if (faqGapType) schemaGapTypes.push(faqGapType);
        gapTypesPerOp.push(schemaGapTypes);
      } catch (error) {
        console.error("[SEO Gaps] Invalid final schema JSON:", error);
      }
    }

    // Send batch request to WordPress
    const wpApiUrl = `${wpSiteUrl.replace(/\/$/, "")}/wp-json/workforce/v1/execute`;

    const response = await fetch(wpApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Workforce-Key": apiKey,
      },
      body: JSON.stringify({
        action: "batch",
        payload: {
          operations,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`WordPress API error: ${response.status} - ${error}`);
    }

    const result = await response.json();

    // Map each WP batch entry back to the gap_types that contributed to
    // that operation. The plugin returns results indexed positionally, so
    // results[i] corresponds to operations[i] which corresponds to
    // gapTypesPerOp[i]. Each entry may attribute to multiple gap types
    // (e.g. the meta op covers meta_title + meta_description + focus_keyword).
    const batchResults = Array.isArray(result.results) ? result.results : [];
    const perGapResults: SEOGapFixOpResult[] = [];
    for (let i = 0; i < operations.length; i++) {
      const opResult = batchResults[i];
      const gapTypes = gapTypesPerOp[i] ?? [];
      const success = opResult?.success === true;
      // Plugin nests the per-op error inside `data.error` for some shapes
      // and at `error` for others — check both before falling back.
      const opError = success
        ? undefined
        : opResult?.data?.error ?? opResult?.error;
      for (const gap_type of gapTypes) {
        perGapResults.push({ gap_type, success, error: opError });
      }
    }

    return {
      wp_post_id: wpPostId,
      fixes,
      applied: result.success === true,
      error: result.success ? undefined : result.error,
      results: perGapResults,
    };
  } catch (error) {
    console.error("[SEO Gaps] Error applying fixes:", error);
    return {
      wp_post_id: wpPostId,
      fixes,
      applied: false,
      error: error instanceof Error ? error.message : "Unknown error",
      results: [],
    };
  }
}

/**
 * Complete flow: Analyze → Generate → Apply
 *
 * @param page - Page data from WordPress
 * @param wpSiteUrl - WordPress site URL
 * @param apiKey - WordPress plugin API key
 * @returns Result with applied fixes
 */
export async function fixSEOGaps(
  page: PageSEOAnalysis,
  wpSiteUrl: string,
  apiKey: string
): Promise<SEOGapFixResult> {
  // Step 1: Detect gaps (already done if using detectSEOGaps)
  if (page.gaps.length === 0) {
    return {
      wp_post_id: page.wp_post_id,
      fixes: [],
      applied: true,
    };
  }

  // Step 2: Generate fixes using AI
  const fixes = await generateSEOGapFixes(page);

  // Step 3: Apply to WordPress. Pass current_schema so applySEOGapFixes can
  // merge FAQ schema with whatever's already on the post instead of
  // overwriting it.
  return await applySEOGapFixes(
    page.wp_post_id,
    fixes,
    wpSiteUrl,
    apiKey,
    page.current_schema
  );
}

// ============================================================================
// Helper functions for generating specific content types
// ============================================================================
// Note: generateMetaTitle, generateMetaDescription, and generateH1 are now
// wired to the real AI agents in @workforce/ai-agents. generateFocusKeyword
// and generateSchema are still stubs / template-driven and are tracked as
// follow-up vertical slices.

async function generateH1(_agent: any, _context: string, page: PageSEOAnalysis): Promise<SEOGapFix> {
  // Build providers (Anthropic primary, OpenAI fallback) and the shared PageInput
  // shape consumed by every agent in @workforce/ai-agents.
  const { primary, fallback } = buildPrimaryAndFallback();
  const input = buildAgentPageInput(page);

  const result = await withFallback(
    primary,
    fallback,
    (provider) => generateH1WithAI(provider, input),
    (err) => logger.warn("H1 primary provider failed, trying fallback", { error: String(err) })
  );

  // If neither provider is configured, fall back to the old stub so that
  // dev/demo flows without API keys keep rendering instead of throwing.
  if (!result) {
    const h1 = `${page.title}`.substring(0, 70);
    return {
      gap_type: "missing_h1",
      generated_content: h1,
      reasoning: `AI provider not configured — used placeholder (${h1.length} chars, optimal 20-70)`,
    };
  }

  return {
    gap_type: "missing_h1",
    generated_content: result.text,
    reasoning: `Generated by ${result.provider} (${result.model}), ${result.text.length} chars${result.inRange ? "" : " — outside 20-70 target"}`,
  };
}

async function generateMetaTitle(
  _agent: any,
  _context: string,
  page: PageSEOAnalysis,
  gap: SEOGap
): Promise<SEOGapFix> {
  const { primary, fallback } = buildPrimaryAndFallback();
  const input = buildAgentPageInput(page);

  const result = await withFallback(
    primary,
    fallback,
    (provider) => generateMetaTitleWithAI(provider, input),
    (err) => logger.warn("Meta title primary provider failed, trying fallback", { error: String(err) })
  );

  if (!result) {
    const metaTitle = `${page.title} | Site Name`.substring(0, 60);
    return {
      gap_type: gap.type as any,
      generated_content: metaTitle,
      reasoning: `AI provider not configured — used placeholder (${metaTitle.length} chars, optimal 50-60)`,
    };
  }

  return {
    gap_type: gap.type as any,
    generated_content: result.text,
    reasoning: `Generated by ${result.provider} (${result.model}), ${result.text.length} chars${result.inRange ? "" : " — outside 50-60 target"}`,
  };
}

async function generateMetaDescription(
  _agent: any,
  _context: string,
  page: PageSEOAnalysis,
  gap: SEOGap
): Promise<SEOGapFix> {
  const { primary, fallback } = buildPrimaryAndFallback();
  const input = buildAgentPageInput(page);

  const result = await withFallback(
    primary,
    fallback,
    (provider) => generateMetaDescriptionWithAI(provider, input),
    (err) => logger.warn("Meta description primary provider failed, trying fallback", { error: String(err) })
  );

  if (!result) {
    const metaDescription = page.content_preview.substring(0, 155);
    return {
      gap_type: gap.type as any,
      generated_content: metaDescription,
      reasoning: `AI provider not configured — used placeholder (${metaDescription.length} chars, optimal 150-160)`,
    };
  }

  return {
    gap_type: gap.type as any,
    generated_content: result.text,
    reasoning: `Generated by ${result.provider} (${result.model}), ${result.text.length} chars${result.inRange ? "" : " — outside 150-160 target"}`,
  };
}

async function generateFocusKeyword(
  _agent: any,
  _context: string,
  page: PageSEOAnalysis
): Promise<SEOGapFix> {
  // Same provider + PageInput plumbing as the other generators. Focus keyword
  // is special in that its output feeds back into downstream agents via
  // PageInput.focusKeyword — so AI quality here compounds across the suite.
  const { primary, fallback } = buildPrimaryAndFallback();
  const input = buildAgentPageInput(page);

  const result = await withFallback(
    primary,
    fallback,
    (provider) => generateFocusKeywordWithAI(provider, input),
    (err) => logger.warn("Focus keyword primary provider failed, trying fallback", { error: String(err) })
  );

  // No-key dev/demo fallback: keep the old title-derived extraction so the
  // dashboard demo still renders something instead of throwing.
  if (!result) {
    const keyword = extractKeywordFromTitle(page.title);
    return {
      gap_type: "missing_focus_keyword",
      generated_content: keyword,
      reasoning: `AI provider not configured — used placeholder extracted from title (${keyword.length} chars)`,
    };
  }

  return {
    gap_type: "missing_focus_keyword",
    generated_content: result.text,
    reasoning: `Generated by ${result.provider} (${result.model}), ${result.text.length} chars${result.inRange ? "" : " — outside 3-50 target"}`,
  };
}

/**
 * Generate JSON-LD schema markup using SchemaFactory.
 *
 * The template (URL, author, dates, type-based shape) stays factory-driven.
 * The `description` field is the one piece that benefits from AI: the old
 * fallback (current meta description, else first 155 chars of content) is
 * weak when both meta description and the page intro are also weak. We
 * generate a schema-tuned description (factual, CTA-free) when an AI
 * provider is available, and fall back to the original logic otherwise.
 *
 * The `keywords` field receives `page.current_focus_keyword` which, in the
 * orchestrator's phase-1/phase-2 flow, has already been replaced with the
 * AI-generated focus keyword via the workingAnalysis copy. So keywords is
 * implicitly AI-enriched without any extra work here.
 *
 * @param page - Page SEO analysis data (post-focus-keyword-priming)
 * @returns SEO gap fix with schema JSON
 */
async function generateSchema(page: PageSEOAnalysis): Promise<SEOGapFix> {
  const { primary, fallback } = buildPrimaryAndFallback();
  const input = buildAgentPageInput(page);

  // Try AI for the description field. If providers aren't configured or both
  // throw, withFallback returns null and we fall back to the legacy logic.
  const aiDesc = await withFallback(
    primary,
    fallback,
    (provider) => generateSchemaDescriptionWithAI(provider, input),
    (err) => logger.warn("Schema description primary provider failed, trying fallback", { error: String(err) })
  );

  // Resolve final description: AI output if available, else the original
  // fallback chain (existing meta description, else 155-char content slice).
  const resolvedDescription =
    aiDesc?.text ?? page.current_meta_description ?? page.content_preview.substring(0, 155);

  const schema = generateSchemaForPageType(page.post_type, {
    title: page.title,
    description: resolvedDescription,
    url: page.url,
    author: page.author,
    datePublished: page.date_published,
    dateModified: page.date_modified,
    keywords: page.current_focus_keyword,
  });

  const schemaJson = schemaToJson(schema);

  // Reasoning string makes the AI vs fallback path visible in the dashboard
  // so we can see at a glance which generator did what.
  const reasoning = aiDesc
    ? `Generated ${page.post_type === "post" ? "Article" : "WebPage"} schema; description by ${aiDesc.provider} (${aiDesc.model}), ${aiDesc.text.length} chars${aiDesc.inRange ? "" : " — outside 100-250 target"}`
    : `Generated ${page.post_type === "post" ? "Article" : "WebPage"} schema; description from ${page.current_meta_description ? "existing meta description" : "content preview truncation"} (AI provider not configured)`;

  return {
    gap_type: "missing_schema",
    generated_content: schemaJson,
    reasoning,
  };
}

/**
 * Generate FAQPage JSON-LD using the FAQ content agent + schema-factory.
 *
 * This is a GEO (Generative Engine Optimization) fix — adding FAQPage
 * schema improves the chance an AI search engine (ChatGPT, Perplexity,
 * Google AI Overviews) will cite the page when answering related queries.
 *
 * Application note: this slice ships generation + dashboard display only.
 * applySEOGapFixes does NOT push FAQ schema to WordPress yet — combining
 * a fresh FAQPage with any existing _workforce_schema needs the @graph
 * combiner AND a plugin-side validation update (the current update_schema
 * action rejects payloads without a top-level @type). Tracked as a
 * follow-up slice.
 */
async function generateFAQ(page: PageSEOAnalysis): Promise<SEOGapFix> {
  const { primary, fallback } = buildPrimaryAndFallback();
  const input = buildAgentPageInput(page);

  const result = await withFallback(
    primary,
    fallback,
    (provider) => generateFAQContentWithAI(provider, input),
    (err) => logger.warn("FAQ primary provider failed, trying fallback", { error: String(err) })
  );

  // No provider configured (dev/demo path with no API keys).
  if (!result) {
    return {
      gap_type: "missing_faq",
      generated_content: "",
      reasoning: "AI provider not configured — FAQ skipped",
    };
  }

  // Provider responded but couldn't produce usable pairs after retry.
  // Surface explicitly instead of building a broken FAQPage schema.
  if (result.faqs.length === 0) {
    return {
      gap_type: "missing_faq",
      generated_content: "",
      reasoning: `AI returned no usable FAQ pairs after retry (${result.provider}, ${result.model}) — FAQ skipped`,
    };
  }

  // Map FAQPair {question, answer} to FaqCandidate {q, a} — the
  // schema-factory uses the shorter shape internally.
  const candidates = result.faqs.map((pair) => ({
    q: pair.question,
    a: pair.answer,
  }));

  const faqSchema = buildAeoFaqSchema(candidates);
  const faqJson = schemaToJson(faqSchema);

  return {
    gap_type: "missing_faq",
    generated_content: faqJson,
    reasoning: `Generated FAQPage schema with ${result.faqs.length} Q&A pair${result.faqs.length === 1 ? "" : "s"} by ${result.provider} (${result.model}) for AI citation${result.inRange ? "" : " — count outside 3-5 target"}`,
  };
}

/**
 * Resolve the final schema JSON-LD string to push to WordPress, given the
 * fix-collected schemaFix and faqFix plus the page's existing schema.
 *
 * Returns null when no schema-side change should be applied. Returns a JSON
 * string (parseable as JSON-LD) in all other cases. Always pushes ONE schema
 * value, never two, so the plugin's _workforce_schema meta is overwritten at
 * most once per apply call.
 *
 * Falls back gracefully on JSON parse errors — bad input shouldn't block a
 * good fix from being applied.
 */
function buildFinalSchemaJson(
  schemaFix: string | null,
  faqFix: string | null,
  existingSchema: string | undefined
): string | null {
  // Case 1: both fixes — combine into one @graph schema.
  if (schemaFix && faqFix) {
    try {
      const base = JSON.parse(schemaFix);
      const faq = JSON.parse(faqFix);
      return JSON.stringify(combineSchemas([base, faq]));
    } catch (err) {
      console.error("[SEO Gaps] Failed to combine schema + FAQ, applying schema only", err);
      return schemaFix;
    }
  }

  // Case 2: schema fix only — push as-is.
  if (schemaFix) {
    return schemaFix;
  }

  // Case 3: FAQ fix only.
  if (faqFix) {
    // If there's an existing schema on the post, combine FAQ with it so we
    // don't blow it away. Otherwise FAQ goes through alone.
    if (existingSchema && existingSchema.trim().length > 0) {
      try {
        const existing = JSON.parse(existingSchema);
        const faq = JSON.parse(faqFix);
        return JSON.stringify(combineSchemas([existing, faq]));
      } catch (err) {
        console.error("[SEO Gaps] Failed to combine existing + FAQ, applying FAQ only", err);
        return faqFix;
      }
    }
    return faqFix;
  }

  return null;
}

/**
 * Helper: Extract a simple keyword from the title as fallback
 */
function extractKeywordFromTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .substring(0, 50);
}
