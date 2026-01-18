/**
 * Shopify App Bridge Configuration Utilities
 * Provides helper functions for working with App Bridge in the app
 */

/**
 * Gets the shop origin from the current URL
 * Used when the app is embedded in Shopify Admin
 * @returns Shop origin (base64 encoded host parameter) or empty string
 */
export function getShopOriginFromURL(): string {
  if (typeof window === 'undefined') return ''
  
  const urlParams = new URLSearchParams(window.location.search)
  return urlParams.get('host') || ''
}

/**
 * Extracts shop domain from App Bridge host parameter
 * @param host - Base64 encoded host parameter from Shopify
 * @returns Shop domain (e.g., "mystore.myshopify.com") or null
 */
export function extractShopDomainFromHost(host: string): string | null {
  if (!host) return null
  
  try {
    // Host is base64 encoded, decode it
    const decoded = Buffer.from(host, 'base64').toString('utf-8')
    // Format: "mystore.myshopify.com/admin"
    const match = decoded.match(/^https:\/\/([^/]+)/)
    return match ? match[1] : null
  } catch (error) {
    console.error('[App Bridge] Failed to extract shop domain from host:', error)
    return null
  }
}

