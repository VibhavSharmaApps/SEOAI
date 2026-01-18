/**
 * Server-side helper to get site from Shopify session token
 * For use in Next.js App Router server components
 * Uses headers() from next/headers instead of Request object
 */

import { headers } from 'next/headers'
import { prisma } from './prisma'
import { verifyShopifySessionToken, ShopifySessionTokenError } from './shopify-session-verification'

export interface SiteFromSession {
  id: string
  domain: string
  shopifyStoreUrl: string
  shopifyAccessToken: string
  isActive: boolean
}

/**
 * Gets site from Shopify session token in server components
 * Verifies token and looks up site by shop domain (stateless)
 * 
 * @returns Site information with access token
 * @throws ShopifySessionTokenError if token is invalid or site not found
 */
export async function getSiteFromSessionServer(): Promise<SiteFromSession> {
  const headersList = await headers()
  const authHeader = headersList.get('authorization')

  // Verify Shopify session token
  const sessionInfo = await verifyShopifySessionToken(authHeader)

  // Get site by shop domain from session token
  const site = await prisma.site.findFirst({
    where: {
      domain: sessionInfo.shop,
    },
  })

  if (!site) {
    throw new ShopifySessionTokenError(
      'Shop not found. Please connect your Shopify store first.',
      404
    )
  }

  if (!site.shopifyAccessToken) {
    throw new ShopifySessionTokenError(
      'Shopify access token not found for this shop',
      400
    )
  }

  return {
    id: site.id,
    domain: site.domain,
    shopifyStoreUrl: site.shopifyStoreUrl,
    shopifyAccessToken: site.shopifyAccessToken,
    isActive: site.isActive,
  }
}

