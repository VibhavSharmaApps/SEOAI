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
 */
export function hasSchemaMarkup(html: string): boolean {
  // Look for JSON-LD schema
  const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i)
  if (jsonLdMatch) {
    try {
      const schema = JSON.parse(jsonLdMatch[1])
      // Check if it's a valid schema.org object
      if (schema['@context'] && schema['@type']) {
        return true
      }
    } catch {
      // Invalid JSON, ignore
    }
  }
  return false
}

/**
 * Counts internal links in HTML (links pointing to same domain)
 */
export function countInternalLinks(html: string, pageUrl: string): number {
  try {
    const pageDomain = new URL(pageUrl).hostname
    const linkMatches = html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi)
    
    let internalLinkCount = 0
    
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
          internalLinkCount++
        }
      } catch {
        // Invalid URL, skip
        continue
      }
    }
    
    return internalLinkCount
  } catch {
    return 0
  }
}

