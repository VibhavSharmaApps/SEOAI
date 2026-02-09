/**
 * SEO Gaps Dashboard — Example page showing the complete flow
 *
 * This demonstrates:
 * 1. Detecting SEO gaps from WordPress pages
 * 2. Using AI to generate fixes
 * 3. Applying fixes autonomously via the WordPress plugin API
 */

import { detectSEOGaps, generateSEOGapFixes } from "@/app/actions/seo-gaps";
import type { PageSEOAnalysis } from "@/types/seo-gaps";

// Example: This would come from your WordPress site via API
const EXAMPLE_PAGE: PageSEOAnalysis = {
  wp_post_id: 123,
  url: "https://example.com/best-coffee-beans",
  title: "Best Coffee Beans for Cold Brew",
  post_type: "post",
  content_preview: "If you're looking for the perfect cold brew coffee, you need to start with the right beans. Cold brew requires coarsely ground coffee that can steep for 12-24 hours...",
  current_h1: undefined, // MISSING!
  current_meta_title: "Coffee", // TOO SHORT!
  current_meta_description: undefined, // MISSING!
  current_focus_keyword: undefined, // MISSING!
  current_schema: undefined, // MISSING!
  gaps: [], // Will be populated
};

export default async function SEOGapsDashboard() {
  // Step 1: Detect gaps
  const gaps = await detectSEOGaps({
    title: EXAMPLE_PAGE.title,
    content: EXAMPLE_PAGE.content_preview,
    meta_title: EXAMPLE_PAGE.current_meta_title,
    meta_description: EXAMPLE_PAGE.current_meta_description,
    focus_keyword: EXAMPLE_PAGE.current_focus_keyword,
    h1: EXAMPLE_PAGE.current_h1,
    current_schema: EXAMPLE_PAGE.current_schema,
  });

  EXAMPLE_PAGE.gaps = gaps;

  // Step 2: Generate fixes (Server Component can await!)
  let fixes = null;

  if (gaps.length > 0) {
    try {
      fixes = await generateSEOGapFixes(EXAMPLE_PAGE);
    } catch (error) {
      console.error("Error generating fixes:", error);
    }
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-4xl font-bold mb-8">SEO Gap Detection & Auto-Fix</h1>

      {/* Page Info */}
      <div className="bg-card border rounded-lg p-6 mb-6">
        <h2 className="text-2xl font-semibold mb-4">Analyzing Page</h2>
        <dl className="space-y-2">
          <div className="flex">
            <dt className="font-medium w-32">Post ID:</dt>
            <dd className="text-muted-foreground">{EXAMPLE_PAGE.wp_post_id}</dd>
          </div>
          <div className="flex">
            <dt className="font-medium w-32">Title:</dt>
            <dd className="text-muted-foreground">{EXAMPLE_PAGE.title}</dd>
          </div>
          <div className="flex">
            <dt className="font-medium w-32">URL:</dt>
            <dd className="text-muted-foreground">{EXAMPLE_PAGE.url}</dd>
          </div>
        </dl>
      </div>

      {/* Detected Gaps */}
      <div className="bg-card border rounded-lg p-6 mb-6">
        <h2 className="text-2xl font-semibold mb-4">
          Detected Gaps ({gaps.length})
        </h2>
        
        {gaps.length === 0 ? (
          <p className="text-muted-foreground">No SEO gaps detected. Page is well-optimized!</p>
        ) : (
          <div className="space-y-3">
            {gaps.map((gap, idx) => (
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

      {/* Generated Fixes */}
      {fixes && fixes.length > 0 && (
        <div className="bg-card border rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">
            AI-Generated Fixes ({fixes.length})
          </h2>
          
          <div className="space-y-4">
            {fixes.map((fix, idx) => (
              <div key={idx} className="border rounded p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-lg">{fix.gap_type.replace(/_/g, " ").toUpperCase()}</h3>
                  <code className="text-xs bg-green-100 dark:bg-green-900 px-2 py-1 rounded">
                    AI Generated
                  </code>
                </div>
                <div className="bg-muted p-3 rounded mb-2 font-mono text-sm overflow-x-auto">
                  <pre className="whitespace-pre-wrap break-words">{fix.generated_content}</pre>
                </div>
                <p className="text-sm text-muted-foreground italic">
                  {fix.reasoning}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-muted/50 border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">How It Works</h2>
        <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
          <li>WordPress page is analyzed for SEO gaps (missing H1, short meta, etc.)</li>
          <li>GPT-4o-mini generates optimized content for each gap</li>
          <li>Fixes are sent to <code className="bg-background px-2 py-1 rounded">/wp-json/workforce/v1/execute</code></li>
          <li>WordPress plugin safely applies updates with sanitization</li>
          <li>Audit trail logged to <code className="bg-background px-2 py-1 rounded">_workforce_seo_log</code></li>
        </ol>
      </div>
    </div>
  );
}
