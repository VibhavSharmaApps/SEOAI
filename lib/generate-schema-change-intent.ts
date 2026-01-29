/**
 * Generate Schema Change Intent
 * Analyzes a Page record and determines if schema markup injection is needed
 * 
 * This function is deterministic and does NOT:
 * - Write to the database
 * - Call Shopify APIs
 * - Override existing schema
 * - Perform any side effects
 * 
 * Returns a ChangeIntent object structure if schema is missing, null otherwise
 */

import type { Page } from '@prisma/client'
import { IntentType } from './enums'

/**
 * Interface for the ChangeIntent object structure
 * This matches the Prisma ChangeIntent model but without database fields
 */
export interface SchemaChangeIntent {
  intentType: typeof IntentType.INJECT_SCHEMA
  payload: {
    pageId: string
    pageType: string
    pageUrl: string
    schemaType: 'Article' | 'Product'
    schemaJson: Record<string, any> // JSON-LD schema object
    reason: string
  }
}

/**
 * Checks if a page already has schema markup
 * This is determined by checking for existing INJECT_SCHEMA change intents
 * 
 * @param page - Page record with optional changeIntents relation
 * @returns true if schema already exists, false otherwise
 */
function hasExistingSchema(
  page: Page & { changeIntents?: Array<{ intentType: string; status: string }> }
): boolean {
  if (!page.changeIntents) {
    // If changeIntents relation is not loaded, assume no schema exists
    // This is conservative - we'll generate schema anyway
    return false
  }

  // Check for any INJECT_SCHEMA intents that are PENDING or APPLIED
  // We don't override existing schema, even if it failed or was rolled back
  return page.changeIntents.some(
    (intent) =>
      intent.intentType === 'INJECT_SCHEMA' &&
      (intent.status === 'PENDING' || intent.status === 'APPLIED')
  )
}

/**
 * Generates Article schema.org JSON-LD structure
 * Based on schema.org/Article specification
 */
function generateArticleSchema(page: Page, siteUrl: string): Record<string, any> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: page.title,
    url: page.url,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': page.url,
    },
    // Note: Additional fields like author, datePublished, dateModified, image
    // would require fetching from Shopify API, which we avoid for determinism
    // These can be added later when the schema is actually applied
  }
}

/**
 * Generates Product schema.org JSON-LD structure
 * Based on schema.org/Product specification
 */
function generateProductSchema(page: Page, siteUrl: string): Record<string, any> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: page.title,
    url: page.url,
    // Note: Additional fields like description, image, offers, brand, sku
    // would require fetching from Shopify API, which we avoid for determinism
    // These can be added later when the schema is actually applied
  }
}

/**
 * Extracts the base site URL from a page URL
 * Used for constructing schema.org URLs
 */
function extractSiteUrl(pageUrl: string): string {
  try {
    const url = new URL(pageUrl)
    return `${url.protocol}//${url.host}`
  } catch {
    // Fallback if URL parsing fails
    return ''
  }
}

/**
 * Generates a ChangeIntent for schema markup injection if needed
 * 
 * @param page - Page record from database (optionally with changeIntents relation)
 * @param htmlContent - Optional HTML content for WordPress pages (fetched from live page)
 * @param cmsType - CMS type ('SHOPIFY' or 'WORDPRESS')
 * @returns ChangeIntent object structure if schema is missing, null otherwise
 */
export async function generateSchemaChangeIntent(
  page: Page & { changeIntents?: Array<{ intentType: string; status: string }> },
  htmlContent?: string,
  cmsType?: 'SHOPIFY' | 'WORDPRESS'
): Promise<SchemaChangeIntent | null> {
  // Only support ARTICLE and PRODUCT pages
  if (page.type !== 'ARTICLE' && page.type !== 'PRODUCT') {
    return null
  }

  // Explicitly separate WordPress and Shopify logic - NO cross-CMS fallback
  if (cmsType === 'WORDPRESS') {
    // WordPress logic: ONLY operates on rendered HTML
    if (!htmlContent || htmlContent.trim().length === 0) {
      // Critical: WordPress requires HTML content - do NOT fall back to Shopify logic
      console.warn(`[Schema Intent] WordPress page ${page.id} (${page.url}) missing HTML content - skipping page`)
      return null
    }
    
    const { getSchemaType } = await import('./wordpress-html-detection')
    const existingSchemaType = getSchemaType(htmlContent)
    
    // WordPress MVP Rule: Generate intent if:
    // - No schema exists OR
    // - Existing schema is not Article or BlogPosting (for ARTICLE pages)
    if (existingSchemaType) {
      // Schema exists - check if it's the correct type
      if (page.type === 'ARTICLE') {
        // For articles, only Article or BlogPosting are acceptable
        if (existingSchemaType === 'Article' || existingSchemaType === 'BlogPosting') {
          // Correct schema type exists - do not generate intent
          return null
        }
        // Wrong schema type - generate intent to inject correct schema
      } else if (page.type === 'PRODUCT') {
        // For products, only Product schema is acceptable
        if (existingSchemaType === 'Product') {
          // Correct schema type exists - do not generate intent
          return null
        }
        // Wrong schema type - generate intent to inject correct schema
      }
      // If we reach here, schema exists but is wrong type - generate intent
    }
    // If no schema exists, generate intent (fall through)
  } else if (cmsType === 'SHOPIFY') {
    // Shopify logic: ONLY uses change intents from database
    if (hasExistingSchema(page)) {
      return null
    }
  } else {
    // Unknown CMS type - skip safely
    console.warn(`[Schema Intent] Unknown CMS type for page ${page.id} - skipping`)
    return null
  }

  // Extract site URL for schema construction
  const siteUrl = extractSiteUrl(page.url)

  // Generate appropriate schema based on page type
  let schemaJson: Record<string, any>
  let schemaType: 'Article' | 'Product'

  if (page.type === 'ARTICLE') {
    schemaType = 'Article'
    schemaJson = generateArticleSchema(page, siteUrl)
  } else if (page.type === 'PRODUCT') {
    schemaType = 'Product'
    schemaJson = generateProductSchema(page, siteUrl)
  } else {
    // This should never happen due to the check above, but TypeScript needs it
    return null
  }

  // Return ChangeIntent structure
  return {
    intentType: IntentType.INJECT_SCHEMA,
    payload: {
      pageId: page.id,
      pageType: page.type,
      pageUrl: page.url,
      schemaType,
      schemaJson,
      reason: `Inject ${schemaType} schema markup to improve SEO and enable rich snippets in search results`,
    },
  }
}

