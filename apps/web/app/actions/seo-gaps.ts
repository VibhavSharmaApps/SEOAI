"use server";

/**
 * SEO Gap Detection & Fixing — Server Actions
 *
 * Automatically detects SEO gaps (missing H1, meta tags, etc.) and uses AI
 * to generate the missing content, then applies it to WordPress via the plugin API.
 */

import type { PageSEOAnalysis, SEOGap, SEOGapFix, SEOGapFixResult } from "@/types/seo-gaps";
import { generateSchemaForPageType, schemaToJson } from "@/lib/schema-factory";
import { serverEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import {
  tryCreateAIProvider,
  withFallback,
  generateMetaTitleWithAI,
  generateMetaDescriptionWithAI,
  generateH1WithAI,
  generateFocusKeywordWithAI,
  generateSchemaDescriptionWithAI,
  type PageInput,
} from "@workforce/ai-agents";

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
 * Helper: Extract a simple keyword from the title as fallback
 */
function extractKeywordFromTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .substring(0, 50);
}
