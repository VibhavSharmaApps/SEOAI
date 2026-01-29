/**
 * Generate Meta Change Intent
 * Analyzes a Page record and determines if meta tag updates are needed
 * 
 * This function is deterministic and does NOT:
 * - Write to the database
 * - Call Shopify APIs
 * - Perform any side effects
 * 
 * Returns a ChangeIntent object structure if changes are needed, null otherwise
 */

import type { Page } from '@prisma/client'
import { IntentType } from './enums'

/**
 * Minimum recommended title length for SEO (characters)
 */
const MIN_TITLE_LENGTH = 30

/**
 * Maximum recommended title length for SEO (characters)
 * Google typically displays 50-60 characters, but 60 is a safe limit
 */
const MAX_TITLE_LENGTH = 60

/**
 * Generic/weak title patterns that indicate poor SEO
 * These are common placeholder or default titles that should be improved
 */
const WEAK_TITLE_PATTERNS = [
  /^product$/i,
  /^collection$/i,
  /^article$/i,
  /^blog post$/i,
  /^untitled$/i,
  /^new product$/i,
  /^new collection$/i,
  /^test$/i,
  /^sample$/i,
  /^default$/i,
  /^page \d+$/i, // "Page 1", "Page 2", etc.
]

/**
 * WordPress-specific generic title patterns
 * These indicate auto-generated or weak titles that should be improved
 */
const WORDPRESS_WEAK_TITLE_PATTERNS = [
  /^.+?\s*[–—]\s*.+$/i, // "Post Title – Site Name" or "Post Title — Site Name"
  /^.+?\s*\|\s*.+$/i, // "Site Name | Post Title"
  /^.+?\s*-\s*.+$/i, // "Post Title - Site Name" (with dash)
]

/**
 * Interface for the ChangeIntent object structure
 * This matches the Prisma ChangeIntent model but without database fields
 */
export interface MetaChangeIntent {
  intentType: typeof IntentType.UPDATE_META
  payload: {
    pageId: string
    pageType: string
    pageUrl: string
    issues: {
      title?: {
        missing?: boolean
        tooShort?: boolean
        tooLong?: boolean
        generic?: boolean
        currentValue?: string
      }
    }
    recommendations: string[]
  }
}

/**
 * Checks if a title is generic or weak (for Shopify)
 */
function isWeakTitle(title: string): boolean {
  const trimmed = title.trim()
  
  // Check against weak patterns
  for (const pattern of WEAK_TITLE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return true
    }
  }
  
  // Check if title is too short (likely generic)
  if (trimmed.length < MIN_TITLE_LENGTH) {
    return true
  }
  
  return false
}

/**
 * Checks if a WordPress title is generic or auto-generated
 * Stricter rules for WordPress MVP
 */
function isWordPressWeakTitle(title: string): boolean {
  const trimmed = title.trim()
  
  // Check against WordPress-specific weak patterns (auto-generated formats)
  for (const pattern of WORDPRESS_WEAK_TITLE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return true
    }
  }
  
  // Check against general weak patterns
  for (const pattern of WEAK_TITLE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return true
    }
  }
  
  // Check if title is too short (violation for WordPress MVP)
  if (trimmed.length < MIN_TITLE_LENGTH) {
    return true
  }
  
  return false
}

/**
 * Generates recommendations based on detected issues
 */
function generateRecommendations(issues: MetaChangeIntent['payload']['issues']): string[] {
  const recommendations: string[] = []
  
  if (issues.title?.missing) {
    recommendations.push('Add a descriptive title tag (30-60 characters)')
  } else if (issues.title?.tooShort) {
    recommendations.push(`Extend title to at least ${MIN_TITLE_LENGTH} characters for better SEO`)
  } else if (issues.title?.tooLong) {
    recommendations.push(`Shorten title to ${MAX_TITLE_LENGTH} characters or less to avoid truncation in search results`)
  } else if (issues.title?.generic) {
    recommendations.push('Replace generic title with a more descriptive, keyword-rich title')
  }
  
  return recommendations
}

/**
 * Generates a ChangeIntent for meta tag updates if needed
 * 
 * @param page - Page record from database
 * @param htmlContent - Optional HTML content for WordPress pages (fetched from live page)
 * @param cmsType - CMS type ('SHOPIFY' or 'WORDPRESS')
 * @returns ChangeIntent object structure if changes are needed, null otherwise
 */
export async function generateMetaChangeIntent(
  page: Page,
  htmlContent?: string,
  cmsType?: 'SHOPIFY' | 'WORDPRESS'
): Promise<MetaChangeIntent | null> {
  const issues: MetaChangeIntent['payload']['issues'] = {}
  let hasIssues = false
  
  // For WordPress, use HTML content if provided - STRICT ESCALATION RULES
  if (cmsType === 'WORDPRESS' && htmlContent) {
    const { extractMetaTitle, extractMetaDescription } = await import('./wordpress-html-detection')
    const metaTitle = extractMetaTitle(htmlContent)
    const metaDescription = extractMetaDescription(htmlContent)
    
    // WordPress MVP Rule: Generate intent if title is missing, too short, or matches generic patterns
    if (!metaTitle || metaTitle.length === 0) {
      issues.title = {
        missing: true,
        currentValue: '',
      }
      hasIssues = true
    } else {
      const titleIssues: MetaChangeIntent['payload']['issues']['title'] = {}
      
      // Check title length (too short is a violation)
      if (metaTitle.length < MIN_TITLE_LENGTH) {
        titleIssues.tooShort = true
        hasIssues = true
      }
      
      // Check if title matches WordPress generic/auto-generated patterns (violation)
      if (isWordPressWeakTitle(metaTitle)) {
        titleIssues.generic = true
        hasIssues = true
      }
      
      // Note: We don't check for tooLong in WordPress MVP - only missing, too short, or generic
      
      if (Object.keys(titleIssues).length > 0) {
        titleIssues.currentValue = metaTitle
        issues.title = titleIssues
      }
    }
    
    // WordPress MVP Rule: Generate intent if meta description is missing
    if (!metaDescription || metaDescription.length === 0) {
      // Meta description missing is a violation - mark as issue
      hasIssues = true
    }
  } else {
    // For Shopify, use database fields (existing logic)
    const title = page.title?.trim() || ''
    
    if (!title || title.length === 0) {
      issues.title = {
        missing: true,
        currentValue: page.title || '',
      }
      hasIssues = true
    } else {
      const titleIssues: MetaChangeIntent['payload']['issues']['title'] = {}
      
      // Check title length
      if (title.length < MIN_TITLE_LENGTH) {
        titleIssues.tooShort = true
        hasIssues = true
      } else if (title.length > MAX_TITLE_LENGTH) {
        titleIssues.tooLong = true
        hasIssues = true
      }
      
      // Check if title is generic/weak
      if (isWeakTitle(title)) {
        titleIssues.generic = true
        hasIssues = true
      }
      
      if (Object.keys(titleIssues).length > 0) {
        titleIssues.currentValue = title
        issues.title = titleIssues
      }
    }
  }
  
  // If no issues found, return null
  if (!hasIssues) {
    return null
  }
  
  // Generate recommendations
  const recommendations = generateRecommendations(issues)
  
  // Add meta description recommendation for WordPress if missing
  if (cmsType === 'WORDPRESS' && htmlContent) {
    const { extractMetaDescription } = await import('./wordpress-html-detection')
    const metaDescription = extractMetaDescription(htmlContent)
    if (!metaDescription || metaDescription.length === 0) {
      recommendations.push('Add meta description tag (150-160 characters recommended)')
    }
  }
  
  // Return ChangeIntent structure
  return {
    intentType: IntentType.UPDATE_META,
    payload: {
      pageId: page.id,
      pageType: page.type,
      pageUrl: page.url,
      issues,
      recommendations,
    },
  }
}

