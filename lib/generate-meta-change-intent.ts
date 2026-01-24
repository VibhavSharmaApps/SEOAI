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
 * Checks if a title is generic or weak
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
 * @returns ChangeIntent object structure if changes are needed, null otherwise
 */
export function generateMetaChangeIntent(page: Page): MetaChangeIntent | null {
  const issues: MetaChangeIntent['payload']['issues'] = {}
  let hasIssues = false
  
  // Check title
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
  
  // Note: Meta description is not available in the Page model
  // Since this function must be deterministic and not call APIs,
  // we cannot check meta descriptions. This would require:
  // 1. Storing meta descriptions in the Page model, OR
  // 2. Calling Shopify API (which violates the deterministic requirement)
  // For now, we only check title which is available in the model
  
  // If no issues found, return null
  if (!hasIssues) {
    return null
  }
  
  // Generate recommendations
  const recommendations = generateRecommendations(issues)
  
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

