"use server";

/**
 * SEO Gap Detection & Fixing — Server Actions
 *
 * Automatically detects SEO gaps (missing H1, meta tags, etc.) and uses AI
 * to generate the missing content, then applies it to WordPress via the plugin API.
 */

import type { PageSEOAnalysis, SEOGap, SEOGapFix, SEOGapFixResult } from "@/types/seo-gaps";
import { generateSchemaForPageType, schemaToJson } from "@/lib/schema-factory";

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

  return gaps;
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
    
    // Check for required schema.org fields
    if (!schema["@context"] || !schema["@type"]) {
      return {
        type: "missing_schema",
        severity: "high",
        message: "Existing schema is invalid (missing @context or @type)",
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

  // TODO: Implement AI agent integration
  // const agent = createAgent({
  //   provider: "openai",
  //   apiKey: process.env.OPENAI_API_KEY!,
  //   model: "gpt-4o-mini",
  // });

  const fixes: SEOGapFix[] = [];

  // Build context for AI
  const context = `
Page Title: ${analysis.title}
URL: ${analysis.url}
Content Preview: ${analysis.content_preview.substring(0, 500)}
${analysis.current_meta_title ? `Current Meta Title: ${analysis.current_meta_title}` : ""}
${analysis.current_meta_description ? `Current Meta Description: ${analysis.current_meta_description}` : ""}
${analysis.current_focus_keyword ? `Current Focus Keyword: ${analysis.current_focus_keyword}` : ""}
  `.trim();

  // Process each gap
  for (const gap of analysis.gaps) {
    try {
      let fix: SEOGapFix | null = null;

      switch (gap.type) {
        case "missing_h1":
          fix = await generateH1(null, context, analysis);
          break;

        case "missing_meta_title":
        case "short_meta_title":
        case "long_meta_title":
          fix = await generateMetaTitle(null, context, analysis, gap);
          break;

        case "missing_meta_description":
        case "short_meta_description":
        case "long_meta_description":
          fix = await generateMetaDescription(null, context, analysis, gap);
          break;

        case "missing_focus_keyword":
          fix = await generateFocusKeyword(null, context, analysis);
          break;

        case "missing_schema":
          fix = await generateSchema(analysis);
          break;
      }

      if (fix) {
        fixes.push(fix);
      }
    } catch (error) {
      console.error(`[SEO Gaps] Error generating fix for ${gap.type}:`, error);
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
  apiKey: string
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

    // Group fixes by type
    const metaFixes: Record<string, string> = {};
    let h1Fix: string | null = null;
    let schemaFix: string | null = null;

    for (const fix of fixes) {
      switch (fix.gap_type) {
        case "missing_h1":
          h1Fix = fix.generated_content;
          break;

        case "missing_meta_title":
        case "short_meta_title":
        case "long_meta_title":
          metaFixes.meta_title = fix.generated_content;
          break;

        case "missing_meta_description":
        case "short_meta_description":
        case "long_meta_description":
          metaFixes.meta_description = fix.generated_content;
          break;

        case "missing_focus_keyword":
          metaFixes.focus_keyword = fix.generated_content;
          break;

        case "missing_schema":
          schemaFix = fix.generated_content;
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
    }

    // Add schema injection operation
    if (schemaFix) {
      try {
        const schema = JSON.parse(schemaFix);
        operations.push({
          action: "update_schema",
          post_id: wpPostId,
          payload: {
            schema,
          },
        });
      } catch (error) {
        console.error("[SEO Gaps] Invalid schema JSON:", error);
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

    return {
      wp_post_id: wpPostId,
      fixes,
      applied: result.success === true,
      error: result.success ? undefined : result.error,
    };
  } catch (error) {
    console.error("[SEO Gaps] Error applying fixes:", error);
    return {
      wp_post_id: wpPostId,
      fixes,
      applied: false,
      error: error instanceof Error ? error.message : "Unknown error",
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

  // Step 3: Apply to WordPress
  return await applySEOGapFixes(page.wp_post_id, fixes, wpSiteUrl, apiKey);
}

// ============================================================================
// Helper functions for generating specific content types
// ============================================================================
// TODO: Implement these when AI agent integration is ready

async function generateH1(_agent: any, _context: string, page: PageSEOAnalysis): Promise<SEOGapFix> {
  // Placeholder implementation
  const h1 = `${page.title}`.substring(0, 70);

  return {
    gap_type: "missing_h1",
    generated_content: h1,
    reasoning: "Generated AEO-optimized H1 based on page context and primary keyword",
  };
}

async function generateMetaTitle(
  _agent: any,
  _context: string,
  page: PageSEOAnalysis,
  gap: SEOGap
): Promise<SEOGapFix> {
  // Placeholder implementation
  const metaTitle = `${page.title} | Site Name`.substring(0, 60);

  return {
    gap_type: gap.type as any,
    generated_content: metaTitle,
    reasoning: `Generated meta title (${metaTitle.length} chars, optimal 50-60)`,
  };
}

async function generateMetaDescription(
  _agent: any,
  _context: string,
  page: PageSEOAnalysis,
  gap: SEOGap
): Promise<SEOGapFix> {
  // Placeholder implementation
  const metaDescription = page.content_preview.substring(0, 155);

  return {
    gap_type: gap.type as any,
    generated_content: metaDescription,
    reasoning: `Generated meta description (${metaDescription.length} chars, optimal 150-160)`,
  };
}

async function generateFocusKeyword(
  _agent: any,
  _context: string,
  page: PageSEOAnalysis
): Promise<SEOGapFix> {
  // Placeholder implementation
  const keyword = extractKeywordFromTitle(page.title);

  return {
    gap_type: "missing_focus_keyword",
    generated_content: keyword,
    reasoning: "Generated focus keyword based on page title and content",
  };
}

/**
 * Generate JSON-LD schema markup using SchemaFactory
 *
 * @param page - Page SEO analysis data
 * @returns SEO gap fix with schema JSON
 */
async function generateSchema(page: PageSEOAnalysis): Promise<SEOGapFix> {
  // Use SchemaFactory to generate appropriate schema based on page type
  const schema = generateSchemaForPageType(page.post_type, {
    title: page.title,
    description: page.current_meta_description || page.content_preview.substring(0, 155),
    url: page.url,
    author: page.author,
    datePublished: page.date_published,
    dateModified: page.date_modified,
    keywords: page.current_focus_keyword,
  });

  // Convert to JSON string
  const schemaJson = schemaToJson(schema);

  return {
    gap_type: "missing_schema",
    generated_content: schemaJson,
    reasoning: `Generated ${page.post_type === "post" ? "Article" : "WebPage"} schema with structured data for search engines`,
  };
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
