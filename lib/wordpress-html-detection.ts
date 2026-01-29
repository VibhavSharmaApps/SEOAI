/**
 * WordPress HTML Detection Utilities
 * Fetches and parses live HTML for WordPress pages to detect SEO elements
 */

/**
 * Fetches HTML content from a URL
 */
export async function fetchPageHTML(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SEOBot/1.0)',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch page: ${response.status} ${response.statusText}`)
    }

    return await response.text()
  } catch (error) {
    throw new Error(`Error fetching page HTML: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Extracts meta title from HTML
 */
export function extractMetaTitle(html: string): string | null {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  return titleMatch ? titleMatch[1].trim() : null
}

/**
 * Extracts meta description from HTML
 */
export function extractMetaDescription(html: string): string | null {
  const metaMatch = html.match(/<meta\s+name=["']description["'][^>]*content=["']([^"']+)["']/i)
  return metaMatch ? metaMatch[1].trim() : null
}

/**
 * Checks if HTML contains schema markup
 * Returns the schema type if found, null otherwise
 */
export function getSchemaType(html: string): string | null {
  // Look for JSON-LD schema
  const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i)
  if (jsonLdMatch) {
    try {
      const schema = JSON.parse(jsonLdMatch[1])
      // Check if it's a valid schema.org object
      if (schema['@context'] && schema['@type']) {
        return schema['@type']
      }
    } catch {
      // Invalid JSON, ignore
    }
  }
  return null
}

/**
 * Checks if HTML contains schema markup (legacy function for backward compatibility)
 */
export function hasSchemaMarkup(html: string): boolean {
  return getSchemaType(html) !== null
}

/**
 * Counts contextual internal links in HTML body (excluding nav, footer, header, sidebar)
 * Only counts links within the main content area
 */
export function countContextualInternalLinks(html: string, pageUrl: string): number {
  try {
    const pageDomain = new URL(pageUrl).hostname
    
    // Extract body content, excluding nav, footer, header, sidebar
    // Strategy: Remove these sections before counting links
    let bodyContent = html
    
    // Remove nav elements
    bodyContent = bodyContent.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    
    // Remove footer elements
    bodyContent = bodyContent.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    
    // Remove header elements (but keep the page title/head)
    bodyContent = bodyContent.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    
    // Remove sidebar elements
    bodyContent = bodyContent.replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
    bodyContent = bodyContent.replace(/<div[^>]*class=["'][^"']*sidebar[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '')
    
    // Try to extract main content area if it exists
    const mainMatch = bodyContent.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
    if (mainMatch) {
      bodyContent = mainMatch[1]
    } else {
      // Try article tag
      const articleMatch = bodyContent.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
      if (articleMatch) {
        bodyContent = articleMatch[1]
      } else {
        // Try content div
        const contentMatch = bodyContent.match(/<div[^>]*class=["'][^"']*content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)
        if (contentMatch) {
          bodyContent = contentMatch[1]
        }
      }
    }
    
    // Now count links in the contextual content
    const linkMatches = bodyContent.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi)
    
    let contextualLinkCount = 0
    
    for (const match of linkMatches) {
      const href = match[1]
      
      // Skip anchors, javascript:, mailto:, etc.
      if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) {
        continue
      }
      
      try {
        // Resolve relative URLs
        const linkUrl = new URL(href, pageUrl)
        
        // Check if link points to same domain
        if (linkUrl.hostname === pageDomain) {
          contextualLinkCount++
        }
      } catch {
        // Invalid URL, skip
        continue
      }
    }
    
    return contextualLinkCount
  } catch {
    return 0
  }
}

/**
 * Counts internal links in HTML (legacy function for backward compatibility)
 */
export function countInternalLinks(html: string, pageUrl: string): number {
  return countContextualInternalLinks(html, pageUrl)
}

