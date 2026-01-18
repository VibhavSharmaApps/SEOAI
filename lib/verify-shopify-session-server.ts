/**
 * Server-side Shopify session token verification for Next.js App Router server components
 * Uses headers() from next/headers to access request headers
 */

import { headers } from 'next/headers'
import { verifyShopifySessionToken, ShopifySessionTokenError } from './shopify-session-verification'

/**
 * Verifies Shopify session token from request headers in server components
 * Throws ShopifySessionTokenError if token is invalid or missing
 * 
 * @returns Shopify session information with shop and user data
 * @throws ShopifySessionTokenError if verification fails
 */
export async function verifyShopifySessionServer(): Promise<{ shop: string; userId?: string }> {
  const headersList = await headers()
  const authHeader = headersList.get('authorization')

  try {
    const sessionInfo = await verifyShopifySessionToken(authHeader)
    return {
      shop: sessionInfo.shop,
      userId: sessionInfo.userId,
    }
  } catch (error) {
    if (error instanceof ShopifySessionTokenError) {
      throw error
    }
    throw new ShopifySessionTokenError(
      'Unable to verify Shopify session token',
      401
    )
  }
}

