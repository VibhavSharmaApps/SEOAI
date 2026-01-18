/**
 * Helper to get site from Shopify session token for GSC routes
 * GSC routes need both Shopify session token (for shop identification) 
 * and Google OAuth token (for GSC API access)
 */

import { prisma } from './prisma'
import { verifyShopifyRequest, ShopifySessionInfo, ShopifySessionTokenError } from './shopify-session-verification'
import { decryptToken } from './shopify-oauth'
import { GSCAuthRequiredError } from './gsc-errors'

export interface SiteWithGSC {
  site: {
    id: string
    domain: string
    shopifyStoreUrl: string
    googleOAuthToken: string | null
  }
  sessionInfo: ShopifySessionInfo
  googleAccessToken?: string
}

/**
 * Gets site from Shopify session token and Google OAuth token
 * Stateless - no user lookup needed
 * 
 * @param request - Next.js Request object
 * @param requireGoogleToken - Whether Google OAuth token is required (default: true)
 * @returns Site with Google OAuth token if available
 * @throws ShopifySessionTokenError if Shopify token is invalid
 * @throws GSCAuthRequiredError if Google token is missing (when required)
 */
export async function getSiteFromSessionWithGSC(
  request: Request,
  requireGoogleToken: boolean = true
): Promise<SiteWithGSC> {
  // Verify Shopify session token
  const sessionInfo = await verifyShopifyRequest(request)

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

  // Get Google OAuth token if required
  let googleAccessToken: string | undefined
  if (requireGoogleToken) {
    if (!site.googleOAuthToken) {
      throw new GSCAuthRequiredError(
        'Google OAuth token not found. Please authenticate with Google Search Console.'
      )
    }

    try {
      googleAccessToken = decryptToken(site.googleOAuthToken)
    } catch (error) {
      if (error instanceof Error && error.message.includes('Invalid key length')) {
        throw new GSCAuthRequiredError('Google OAuth token encryption key is invalid')
      }
      throw new GSCAuthRequiredError(
        `Failed to decrypt Google OAuth token: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  return {
    site: {
      id: site.id,
      domain: site.domain,
      shopifyStoreUrl: site.shopifyStoreUrl,
      googleOAuthToken: site.googleOAuthToken,
    },
    sessionInfo,
    googleAccessToken,
  }
}

