import { NextResponse } from 'next/server'
import { getShopifyAuthUrl, validateShopDomain } from '@/lib/shopify-oauth'

/**
 * GET /api/shopify/auth
 * Initiates Shopify OAuth flow
 * 
 * IMPORTANT: This route should ONLY be accessed via Shopify-owned surfaces:
 * - Shopify App Store install links
 * - Shopify Partners dashboard install links
 * - Shopify admin app installation flow
 * 
 * This route is public (no auth required) as it's used during initial app installation
 * before Shopify session tokens are available.
 * 
 * Query parameters:
 * - shop: The Shopify shop domain (MUST come from Shopify, not user input)
 *   Format: "mystore" or "mystore.myshopify.com"
 * 
 * Security:
 * - No manual shop entry allowed
 * - Shop parameter should originate from Shopify redirects only
 * - Domain validation ensures proper .myshopify.com format
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const shop = searchParams.get('shop')
  
  if (!shop) {
    console.warn('[Shopify OAuth] Missing shop parameter - installation should come from Shopify')
    return new Response('Missing shop parameter. This endpoint should only be accessed via Shopify installation flow.', { status: 400 })
  }

  // Log the referer to help identify installation sources (for debugging)
  const referer = request.headers.get('referer')
  console.log(`[Shopify OAuth] Installation attempt - shop: ${shop}, referer: ${referer || 'none'}`)
  
  // IMPORTANT: OAuth authentication ALWAYS runs on every install/reinstall
  // We do NOT check for existing sites or tokens here - OAuth must always complete
  // This ensures fresh tokens and proper authentication state on every installation
  try {
    console.log(`[Shopify OAuth Initiation] Starting OAuth flow`)
    console.log(`[Shopify OAuth Initiation] Input shop parameter: ${shop}`)
    
    // Validate and normalize shop domain
    const shopDomain = validateShopDomain(shop)
    console.log(`[Shopify OAuth Initiation] Normalized shop domain: ${shopDomain}`)
    
    // Generate OAuth URL (redirect_uri is derived internally from NEXT_PUBLIC_APP_URL)
    // This will redirect to Shopify's OAuth authorization page
    const authUrl = getShopifyAuthUrl(shopDomain)
    
    // Store shop domain in state parameter (no user ID needed - stateless)
    const state = Buffer.from(JSON.stringify({ shop: shopDomain })).toString('base64')
    const finalAuthUrl = `${authUrl}&state=${encodeURIComponent(state)}`
    
    console.log(`[Shopify OAuth Initiation] Final OAuth URL (with state): ${finalAuthUrl}`)
    console.log(`[Shopify OAuth Initiation] Redirecting to Shopify...`)
    
    // Use NextResponse.redirect() instead of redirect() to avoid catching NEXT_REDIRECT error
    return NextResponse.redirect(finalAuthUrl)
  } catch (error) {
    // Handle actual errors (validation, URL generation, etc.)
    console.error('Shopify OAuth initiation error:', error)
    return new Response(
      `Error initiating OAuth: ${error instanceof Error ? error.message : 'Unknown error'}`,
      { status: 500 }
    )
  }
}
