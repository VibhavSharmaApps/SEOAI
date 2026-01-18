/**
 * Helper to get site from Shopify session token
 * Stateless authentication using Shopify session tokens (no user lookup required)
 */

import { prisma } from './prisma'
import { verifyShopifyRequest, ShopifySessionInfo, ShopifySessionTokenError } from './shopify-session-verification'

// Re-export ShopifySessionTokenError for convenience (used by API routes)
export { ShopifySessionTokenError } from './shopify-session-verification'

export interface SiteWithToken {
  site: {
    id: string
    domain: string
    shopifyStoreUrl: string
    shopifyAccessToken: string
    isActive: boolean
  }
  sessionInfo: ShopifySessionInfo
}

/**
 * Gets site from Shopify session token
 * Stateless - no user lookup needed, just shop domain from token
 * 
 * @param request - Next.js Request object
 * @returns Site with decrypted access token and session info
 * @throws ShopifySessionTokenError if token is invalid
 */
export async function getSiteFromSession(
  request: Request
): Promise<SiteWithToken> {
  const timestamp = new Date().toISOString()
  console.log(`[Site Lookup ${timestamp}] Looking up site from session token...`)
  
  // Verify Shopify session token
  const sessionInfo = await verifyShopifyRequest(request)

  console.log(`[Site Lookup ${timestamp}] Token verified, looking up site for shop: ${sessionInfo.shop}`)

  // Get site by shop domain from session token
  const site = await prisma.site.findFirst({
    where: {
      domain: sessionInfo.shop,
    },
  })

  if (!site) {
    console.warn(`[Site Lookup ${timestamp}] ❌ Site not found for shop: ${sessionInfo.shop}`)
    throw new ShopifySessionTokenError(
      'Shop not found. Please connect your Shopify store first.',
      404
    )
  }

  if (!site.shopifyAccessToken) {
    console.warn(`[Site Lookup ${timestamp}] ❌ No access token found for site: ${site.id} (${sessionInfo.shop})`)
    throw new ShopifySessionTokenError(
      'Shopify access token not found for this shop',
      400
    )
  }

  console.log(`[Site Lookup ${timestamp}] ✅ Site found: ${site.id} (${sessionInfo.shop})`)

  return {
    site: {
      id: site.id,
      domain: site.domain,
      shopifyStoreUrl: site.shopifyStoreUrl,
      shopifyAccessToken: site.shopifyAccessToken,
      isActive: site.isActive,
    },
    sessionInfo,
  }
}

