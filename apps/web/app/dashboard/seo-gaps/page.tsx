/**
 * SEO Gaps Dashboard
 *
 * Two modes:
 *   - LIVE: pass ?siteId=X&postId=Y to fetch a real WordPress page through
 *     the connected site's plugin and analyse it.
 *   - DEMO: with no query params (or invalid ones), falls back to a
 *     hardcoded EXAMPLE_PAGE so the page still renders for visitors who
 *     haven't connected a site yet. A banner makes the mode explicit.
 */

import {
  analyzePageFromSite,
  detectSEOGaps,
  generateSEOGapFixes,
  getPageAuditLog,
} from "@/app/actions/seo-gaps";
import { FixesList } from "@/components/dashboard/fixes-list";
import { RevertButton } from "@/components/dashboard/revert-button";
import type { AuditLogEntry, PageSEOAnalysis } from "@/types/seo-gaps";

/**
 * Map plugin operation strings to human-readable labels for the audit log
 * card. Unknown ops fall through to the raw string so new operations don't
 * silently vanish from the UI.
 */
function operationLabel(op: string): string {
  switch (op) {
    case "update_post":
      return "Updated post content";
    case "meta_update":
      return "Updated meta tags";
    case "schema_update":
      return "Updated schema";
    default:
      return op;
  }
}

/**
 * Render a MySQL GMT timestamp like "2024-01-15 14:30:00" as a relative
 * "Xm/h/d ago" string, falling back to the raw value if parsing fails.
 * Used inside the audit log card.
 */
function formatRelativeTime(timestamp: string): string {
  if (!timestamp) return "—";
  const iso = timestamp.replace(" ", "T") + "Z";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return timestamp;
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

// Demo page used when no ?siteId/postId is supplied. Intentionally has
// missing/short SEO fields so the gap detector flags several issues and the
// AI fixer has something to do.
const EXAMPLE_PAGE: PageSEOAnalysis = {
  wp_post_id: 123,
  url: "https://example.com/best-coffee-beans",
  title: "Best Coffee Beans for Cold Brew",
  post_type: "post",
  content_preview:
    "If you're looking for the perfect cold brew coffee, you need to start with the right beans. Cold brew requires coarsely ground coffee that can steep for 12-24 hours...",
  current_h1: undefined,
  current_meta_title: "Coffee",
  current_meta_description: undefined,
  current_focus_keyword: undefined,
  current_schema: undefined,
  gaps: [],
};

interface SearchParams {
  siteId?: string;
  postId?: string;
}

interface LoadResult {
  source: "live" | "demo";
  analysis: PageSEOAnalysis;
  notice?: string;
}

/**
 * Decide which analysis to render. Live path runs the plugin fetch + gap
 * detection through analyzePageFromSite. Demo path uses EXAMPLE_PAGE and
 * runs detectSEOGaps locally. Either way the caller gets a PageSEOAnalysis
 * with `gaps` already populated, so the rendering code below doesn't need
 * to know which path produced it.
 */
async function loadAnalysis(params: SearchParams): Promise<LoadResult> {
  const { siteId, postId } = params;

  // No params → demo mode, no notice (this is the default landing experience).
  if (!siteId || !postId) {
    const analysis = await buildDemoAnalysis();
    return { source: "demo", analysis };
  }

  // postId must parse to a positive integer — anything else is a user URL
  // typo, so we surface a notice and fall back to demo.
  const postIdNum = Number.parseInt(postId, 10);
  if (!Number.isFinite(postIdNum) || postIdNum <= 0) {
    return {
      source: "demo",
      analysis: await buildDemoAnalysis(),
      notice: "postId must be a positive integer. Showing demo data.",
    };
  }

  const result = await analyzePageFromSite(siteId, postIdNum);
  if (!result.ok) {
    return {
      source: "demo",
      analysis: await buildDemoAnalysis(),
      notice: `Couldn't load live page: ${result.error} Showing demo data.`,
    };
  }

  return { source: "live", analysis: result.analysis };
}

async function buildDemoAnalysis(): Promise<PageSEOAnalysis> {
  // Shallow copy so we don't mutate the module-level EXAMPLE_PAGE constant
  // across requests.
  const analysis: PageSEOAnalysis = { ...EXAMPLE_PAGE, gaps: [] };
  analysis.gaps = await detectSEOGaps({
    title: analysis.title,
    content: analysis.content_preview,
    meta_title: analysis.current_meta_title,
    meta_description: analysis.current_meta_description,
    focus_keyword: analysis.current_focus_keyword,
    h1: analysis.current_h1,
    current_schema: analysis.current_schema,
    post_type: analysis.post_type,
  });
  return analysis;
}

export default async function SEOGapsDashboard({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { source, analysis, notice } = await loadAnalysis(searchParams);

  // generateSEOGapFixes can throw if an AI provider is misconfigured. The
  // page still renders the gap list even without fixes, so we swallow the
  // error here and log it for debugging.
  let fixes = null;
  if (analysis.gaps.length > 0) {
    try {
      fixes = await generateSEOGapFixes(analysis);
    } catch (error) {
      console.error("Error generating fixes:", error);
    }
  }

  // The Apply button only makes sense when we're looking at a real
  // connected page. The demo path's wp_post_id is hardcoded and the
  // siteId from searchParams may not exist — applying would error out
  // and confuse the user. So we gate the button on source === "live".
  const liveSiteId = source === "live" ? searchParams.siteId : undefined;
  const livePostId = source === "live" ? Number.parseInt(searchParams.postId ?? "", 10) : undefined;
  const canApply =
    source === "live" &&
    typeof liveSiteId === "string" &&
    Number.isFinite(livePostId) &&
    fixes !== null &&
    fixes.length > 0;

  // Fetch the audit log when in live mode. We don't block render on errors
  // — a failed audit fetch is purely cosmetic (the card just doesn't show),
  // and the analysis itself already succeeded above.
  //
  // We pull more than we display (auditFetchCount > display cap) because
  // the plugin returns oldest-first and we reverse client-side. We need
  // the FULL log length to map the displayed (newest-first) index back to
  // the plugin's (oldest-first) entry_index when the user clicks Revert.
  let auditLog: AuditLogEntry[] | null = null;
  let auditTotalCount = 0;
  if (
    source === "live" &&
    typeof liveSiteId === "string" &&
    typeof livePostId === "number" &&
    Number.isFinite(livePostId)
  ) {
    const auditResult = await getPageAuditLog(liveSiteId, livePostId, 100);
    if (auditResult.ok) {
      auditLog = auditResult.entries.slice(0, 10); // display cap
      auditTotalCount = auditResult.entries.length;
    }
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-4xl font-bold mb-4">SEO Gap Detection &amp; Auto-Fix</h1>

      {/* Source banner — makes it obvious which mode the page is in. */}
      {source === "live" ? (
        <div className="border border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/20 rounded p-3 mb-6 text-sm">
          <strong>Live data</strong> from your connected WordPress site
          (post #{analysis.wp_post_id}).
        </div>
      ) : (
        <div className="border border-amber-500/40 bg-amber-50 dark:bg-amber-950/20 rounded p-3 mb-6 text-sm">
          <strong>Demo mode.</strong>{" "}
          {notice ??
            "Pass ?siteId=YOUR_SITE_ID&postId=POST_NUMBER in the URL to analyse a real WordPress page."}
        </div>
      )}

      {/* Page Info */}
      <div className="bg-card border rounded-lg p-6 mb-6">
        <h2 className="text-2xl font-semibold mb-4">Analyzing Page</h2>
        <dl className="space-y-2">
          <div className="flex">
            <dt className="font-medium w-32">Post ID:</dt>
            <dd className="text-muted-foreground">{analysis.wp_post_id}</dd>
          </div>
          <div className="flex">
            <dt className="font-medium w-32">Title:</dt>
            <dd className="text-muted-foreground">{analysis.title}</dd>
          </div>
          <div className="flex">
            <dt className="font-medium w-32">URL:</dt>
            <dd className="text-muted-foreground">{analysis.url}</dd>
          </div>
        </dl>
      </div>

      {/* Detected Gaps */}
      <div className="bg-card border rounded-lg p-6 mb-6">
        <h2 className="text-2xl font-semibold mb-4">
          Detected Gaps ({analysis.gaps.length})
        </h2>

        {analysis.gaps.length === 0 ? (
          <p className="text-muted-foreground">No SEO gaps detected. Page is well-optimized!</p>
        ) : (
          <div className="space-y-3">
            {analysis.gaps.map((gap, idx) => (
              <div
                key={idx}
                className={`border rounded p-4 ${
                  gap.severity === "critical"
                    ? "border-red-500 bg-red-50 dark:bg-red-950/20"
                    : gap.severity === "high"
                    ? "border-orange-500 bg-orange-50 dark:bg-orange-950/20"
                    : "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-medium mb-2 ${
                        gap.severity === "critical"
                          ? "bg-red-600 text-white"
                          : gap.severity === "high"
                          ? "bg-orange-600 text-white"
                          : "bg-yellow-600 text-white"
                      }`}
                    >
                      {gap.severity.toUpperCase()}
                    </span>
                    <h3 className="font-semibold">{gap.message}</h3>
                    {gap.currentValue && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Current: &quot;{gap.currentValue}&quot;
                      </p>
                    )}
                    {gap.expectedRange && (
                      <p className="text-sm text-muted-foreground">
                        Expected: {gap.expectedRange.min}-{gap.expectedRange.max} characters
                      </p>
                    )}
                  </div>
                  <code className="text-xs bg-muted px-2 py-1 rounded">
                    {gap.type}
                  </code>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Generated Fixes — rendered by the FixesList client component which
          owns per-fix selection state. The Apply button lives inside
          FixesList so it can react to selection changes without lifting
          state into this server component. */}
      {fixes && fixes.length > 0 && (
        <FixesList
          fixes={fixes}
          siteId={canApply ? liveSiteId : undefined}
          postId={canApply ? livePostId : undefined}
          canApply={canApply}
        />
      )}

      {/* Change history — live mode only. Renders the most recent N audit
          log entries from the plugin's _workforce_seo_log post meta. The
          per-entry Revert button replays the captured `old` values back
          for entries that have them (post-B3); pre-B3 entries show a
          disabled Revert button with a tooltip. */}
      {auditLog && auditLog.length > 0 && (
        <div className="bg-card border rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">Change History</h2>
          <ul className="space-y-3">
            {auditLog.map((entry, displayIdx) => {
              // The plugin stores entries oldest-first; we display
              // newest-first. Translate the display index back to the
              // plugin-side index so revert hits the right entry.
              const pluginIndex = auditTotalCount - 1 - displayIdx;
              const revertable = Array.isArray(entry.changes) && entry.changes.length > 0;

              return (
                <li
                  key={displayIdx}
                  className="flex items-start justify-between gap-4 border-b last:border-b-0 pb-2 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm">
                      {operationLabel(entry.operation)}
                    </div>
                    {entry.fields.length > 0 && (
                      <div className="text-xs text-muted-foreground truncate">
                        {entry.fields.join(", ")}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <time className="text-xs text-muted-foreground">
                      {formatRelativeTime(entry.timestamp)}
                    </time>
                    {liveSiteId && livePostId !== undefined && Number.isFinite(livePostId) ? (
                      <RevertButton
                        siteId={liveSiteId}
                        postId={livePostId}
                        entryIndex={pluginIndex}
                        revertable={revertable}
                      />
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-muted/50 border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">How It Works</h2>
        <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
          <li>WordPress page is analyzed for SEO gaps (missing H1, short meta, etc.)</li>
          <li>Claude or GPT-4o-mini generates optimized content for each gap</li>
          <li>
            Fixes are sent to{" "}
            <code className="bg-background px-2 py-1 rounded">
              /wp-json/workforce/v1/execute
            </code>
          </li>
          <li>WordPress plugin safely applies updates with sanitization</li>
          <li>
            Audit trail logged to{" "}
            <code className="bg-background px-2 py-1 rounded">_workforce_seo_log</code>
          </li>
        </ol>
      </div>
    </div>
  );
}
