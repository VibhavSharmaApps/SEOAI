/**
 * Generate Internal Link Change Intents
 * Analyzes ARTICLE pages and generates change intents for adding internal links
 * 
 * This function is deterministic and does NOT:
 * - Write to the database
 * - Call Shopify APIs
 * - Modify navigation, footer, or sidebar content
 * - Perform any side effects
 * 
 * Returns an array of ChangeIntent object structures
 */

import type { Page } from '@prisma/client'
import { IntentType } from './enums'

/**
 * Interface for the ChangeIntent object structure
 * This matches the Prisma ChangeIntent model but without database fields
 */
export interface InternalLinkChangeIntent {
  intentType: typeof IntentType.ADD_INTERNAL_LINK
  payload: {
    pageId: string
    pageType: string
    pageUrl: string
    targetPageId: string
    targetPageUrl: string
    targetPageTitle: string
    anchorText?: string // Suggested anchor text (optional)
    context?: string // Where in the article to add the link (optional)
    reason: string // Why this link is being added
  }
}

/**
 * Maximum number of internal link change intents to generate per article
 */
const MAX_INTENTS_PER_PAGE = 2

/**
 * Minimum number of existing internal link intents before we stop generating more
 * If an article already has this many or more, we skip it
 */
const MIN_EXISTING_INTENTS_THRESHOLD = 2

/**
 * Finds suitable target pages for internal linking
 * Prioritizes:
 * 1. Other articles from the same site
 * 2. Products from the same site
 * 3. Collections from the same site
 * 
 * Excludes the source page itself
 */
function findTargetPages(
  sourcePage: Page,
  allPages: Page[],
  maxTargets: number = 2
): Page[] {
  // Filter to pages from the same site, excluding the source page
  const candidatePages = allPages.filter(
    (page) => page.siteId === sourcePage.siteId && page.id !== sourcePage.id
  )

  // Prioritize: Articles > Products > Collections
  const articles = candidatePages.filter((p) => p.type === 'ARTICLE')
  const products = candidatePages.filter((p) => p.type === 'PRODUCT')
  const collections = candidatePages.filter((p) => p.type === 'COLLECTION')

  // Combine in priority order, up to maxTargets
  const targets: Page[] = []
  
  // Add articles first (most relevant for blog-to-blog linking)
  targets.push(...articles.slice(0, maxTargets))
  
  // If we need more, add products
  if (targets.length < maxTargets) {
    const remaining = maxTargets - targets.length
    targets.push(...products.slice(0, remaining))
  }
  
  // If we still need more, add collections
  if (targets.length < maxTargets) {
    const remaining = maxTargets - targets.length
    targets.push(...collections.slice(0, remaining))
  }

  return targets.slice(0, maxTargets)
}

/**
 * Counts existing ADD_INTERNAL_LINK change intents for a page
 * This helps determine if a page already has enough internal link intents
 * 
 * Note: This function assumes the pages array includes changeIntents relation
 * If not, it will return 0 (conservative approach - will generate intents)
 */
function countExistingInternalLinkIntents(page: Page & { changeIntents?: Array<{ intentType: string }> }): number {
  if (!page.changeIntents) {
    // If changeIntents relation is not loaded, return 0
    // This is conservative - we'll generate intents anyway
    return 0
  }

  return page.changeIntents.filter(
    (intent) => intent.intentType === 'ADD_INTERNAL_LINK'
  ).length
}

/**
 * Generates internal link change intents for ARTICLE pages
 * 
 * @param pages - Array of Page records (should include all pages from the same site)
 * @param existingIntentsMap - Optional map of pageId -> count of existing ADD_INTERNAL_LINK intents
 *                            If not provided, assumes 0 existing intents
 * @param htmlContentMap - Optional map of pageId -> HTML content for WordPress pages
 * @param cmsType - CMS type ('SHOPIFY' or 'WORDPRESS')
 * @param appliedIntentsByPage - Optional map of pageId -> Set of applied intent types (for idempotency)
 * @returns Array of InternalLinkChangeIntent objects (max 1-2 per article, 1 for WordPress)
 */
export async function generateInternalLinkChangeIntents(
  pages: (Page & { changeIntents?: Array<{ intentType: string }> })[],
  existingIntentsMap?: Map<string, number>,
  htmlContentMap?: Map<string, string>,
  cmsType?: 'SHOPIFY' | 'WORDPRESS',
  appliedIntentsByPage?: Map<string, Set<string>>
): Promise<InternalLinkChangeIntent[]> {
  const intents: InternalLinkChangeIntent[] = []

  // Filter to only ARTICLE pages
  const articlePages = pages.filter((page) => page.type === 'ARTICLE')

  if (articlePages.length === 0) {
    return intents
  }

  // Process each article
  for (const article of articlePages) {
    // Check if ADD_INTERNAL_LINK intent already applied (idempotency)
    const appliedTypes = appliedIntentsByPage?.get(article.id)
    if (appliedTypes?.has('ADD_INTERNAL_LINK')) {
      // Intent already applied - skip (idempotency: second run generates zero intents)
      continue
    }
    
    // For WordPress, check HTML for contextual internal links - STRICT ESCALATION RULES
    if (cmsType === 'WORDPRESS' && htmlContentMap) {
      const htmlContent = htmlContentMap.get(article.id)
      if (htmlContent) {
        const { countContextualInternalLinks } = await import('./wordpress-html-detection')
        const contextualLinkCount = countContextualInternalLinks(htmlContent, article.url)
        
        // WordPress MVP Rule: Generate intent ONLY if ZERO contextual internal links exist
        // If at least one contextual link exists, do nothing
        if (contextualLinkCount > 0) {
          // Page has contextual links - skip generating intent
          continue
        }
        
        // Zero contextual links - generate ONE intent (one intent per type per page per run)
        // Find one suitable target page
        const targetPages = findTargetPages(article, pages, 1)
        if (targetPages.length > 0) {
          const intent: InternalLinkChangeIntent = {
            intentType: IntentType.ADD_INTERNAL_LINK,
            payload: {
              pageId: article.id,
              pageType: article.type,
              pageUrl: article.url,
              targetPageId: targetPages[0].id,
              targetPageUrl: targetPages[0].url,
              targetPageTitle: targetPages[0].title,
              anchorText: targetPages[0].title,
              reason: `Add contextual internal link to improve SEO. Page has zero contextual internal links.`,
            },
          }
          intents.push(intent)
        }
        // Continue to next article (WordPress MVP: one intent per page)
        continue
      }
    }
    
    // Shopify logic (unchanged)
    // Check existing internal link intents
    let existingCount = 0
    
    if (existingIntentsMap) {
      existingCount = existingIntentsMap.get(article.id) || 0
    } else {
      existingCount = countExistingInternalLinkIntents(article)
    }

    // Skip if article already has enough internal link intents
    if (existingCount >= MIN_EXISTING_INTENTS_THRESHOLD) {
      continue
    }

    // Calculate how many new intents to generate (max 2, but respect existing count)
    const intentsToGenerate = Math.min(
      MAX_INTENTS_PER_PAGE,
      MIN_EXISTING_INTENTS_THRESHOLD - existingCount
    )

    if (intentsToGenerate <= 0) {
      continue
    }

    // Find suitable target pages for internal linking
    const targetPages = findTargetPages(article, pages, intentsToGenerate)

    if (targetPages.length === 0) {
      // No suitable targets found - skip this article
      continue
    }

    // Generate change intents for each target
    for (const targetPage of targetPages) {
      const intent: InternalLinkChangeIntent = {
        intentType: IntentType.ADD_INTERNAL_LINK,
        payload: {
          pageId: article.id,
          pageType: article.type,
          pageUrl: article.url,
          targetPageId: targetPage.id,
          targetPageUrl: targetPage.url,
          targetPageTitle: targetPage.title,
          anchorText: targetPage.title, // Default to target page title as anchor text
          reason: `Add internal link to improve SEO and user navigation. Target: ${targetPage.type} page "${targetPage.title}"`,
        },
      }

      intents.push(intent)
    }
  }

  return intents
}

