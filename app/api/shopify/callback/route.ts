import { NextResponse } from 'next/server'
import { exchangeCodeForToken, encryptToken } from '@/lib/shopify-oauth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/shopify/callback
 * Handles Shopify OAuth callback
 * 
 * This route is public (no auth required) as it's used during initial app installation
 * before Shopify session tokens are available.
 * 
 * Query parameters:
 * - code: Authorization code from Shopify
 * - shop: The Shopify shop domain
 * - state: Base64 encoded state containing shop
 * - host: Base64 encoded host parameter (used for embedded app redirect)
 * - embedded: Optional flag indicating if app should be embedded
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const shop = searchParams.get('shop')
  const stateParam = searchParams.get('state')
  const host = searchParams.get('host') // Base64 encoded host from Shopify
  const embedded = searchParams.get('embedded') // Optional embedded flag
  
  if (!code || !shop || !stateParam) {
    return new Response('Missing required parameters', { status: 400 })
  }
  
  try {
    console.log('[Shopify Callback] Starting callback processing')
    console.log('[Shopify Callback] Parameters:', { code: code ? 'present' : 'missing', shop, state: stateParam ? 'present' : 'missing' })
    
    // Decode state to get shop
    let state
    try {
      state = JSON.parse(Buffer.from(stateParam, 'base64').toString('utf-8'))
      console.log('[Shopify Callback] Decoded state:', { shop: state.shop })
    } catch (e) {
      console.error('[Shopify Callback] Failed to decode state:', e)
      throw new Error('Invalid state parameter format')
    }
    
    // Verify shop matches (security check)
    const normalizedShop = shop.replace(/\.myshopify\.com$/, '') + '.myshopify.com'
    const normalizedStateShop = state.shop.replace(/\.myshopify\.com$/, '') + '.myshopify.com'
    if (normalizedShop !== normalizedStateShop) {
      console.error('[Shopify Callback] Shop mismatch:', { stateShop: normalizedStateShop, callbackShop: normalizedShop })
      return new Response('Invalid state parameter', { status: 400 })
    }
    
    // IMPORTANT: OAuth token exchange ALWAYS happens - this cannot be skipped
    // Even if a site exists from a previous install, we must exchange the new
    // authorization code for a fresh access token from Shopify
    console.log('[Shopify Callback] Exchanging code for token...')
    // Exchange authorization code for access token (ALWAYS runs, never skipped)
    const tokenData = await exchangeCodeForToken(shop, code)
    console.log('[Shopify Callback] Token exchange successful')
    
    console.log('[Shopify Callback] Encrypting token...')
    // Encrypt the access token for secure storage
    const encryptedToken = encryptToken(tokenData.access_token)
    console.log('[Shopify Callback] Token encrypted successfully')
    
    // After token exchange, update or create site record
    // This handles both new installations and reinstalls correctly
    console.log('[Shopify Callback] Checking for existing site...')
    // Check if site already exists for this shop (stateless - no user lookup)
    // NOTE: This check happens AFTER token exchange - OAuth always completes first
    const existingSite = await prisma.site.findFirst({
      where: { domain: normalizedShop },
    })
    
    if (existingSite) {
      console.log('[Shopify Callback] Updating existing site:', existingSite.id)
      // Update existing site
      await prisma.site.update({
        where: { id: existingSite.id },
        data: {
          domain: normalizedShop,
          shopifyStoreUrl: `https://${normalizedShop}`,
          shopifyAccessToken: encryptedToken,
          isActive: true,
        },
      })
      console.log('[Shopify Callback] Site updated successfully')
    } else {
      console.log('[Shopify Callback] Creating new site...')
      // Create new site (stateless - no userId required)
      // Sites are identified by domain, not by user
      await prisma.site.create({
        data: {
          domain: normalizedShop,
          shopifyStoreUrl: `https://${normalizedShop}`,
          shopifyAccessToken: encryptedToken,
          name: normalizedShop.replace('.myshopify.com', ''),
          isActive: true,
          // userId is optional - can be null for stateless operation
        },
      })
      console.log('[Shopify Callback] Site created successfully')
    }
    
    console.log('[Shopify Callback] Preparing redirect to embedded app...')
    
    // Get API key for constructing Shopify Admin embedded URL
    const apiKey = process.env.SHOPIFY_API_KEY
    if (!apiKey) {
      throw new Error('SHOPIFY_API_KEY is not set - cannot construct embedded app URL')
    }
    
    // Normalize shop domain (ensure .myshopify.com suffix)
    const shopDomain = normalizedShop
    
    // Construct Shopify Admin embedded app URL
    // Format: https://{shop}.myshopify.com/admin/apps/{api_key}
    // This ensures the app loads in Shopify Admin's embedded context
    const embeddedAppUrl = `https://${shopDomain}/admin/apps/${apiKey}`
    
    console.log('[Shopify Callback] Redirecting to Shopify Admin embedded app:', embeddedAppUrl)
    
    // Redirect to Shopify Admin embedded app URL
    // This will load our app's root URL within the embedded iframe context
    // App Bridge will initialize automatically from the host parameter when present
    return NextResponse.redirect(embeddedAppUrl)
  } catch (error) {
    console.error('[Shopify Callback] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    })
    
    // On error, still try to redirect to Shopify Admin embedded app
    // The app can handle error states in the UI
    const apiKey = process.env.SHOPIFY_API_KEY
    const shopDomain = shop ? shop.replace(/\.myshopify\.com$/, '') + '.myshopify.com' : 'unknown.myshopify.com'
    
    if (apiKey && shopDomain !== 'unknown.myshopify.com') {
      const embeddedAppUrl = `https://${shopDomain}/admin/apps/${apiKey}`
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('[Shopify Callback] Redirecting to embedded app with error state:', embeddedAppUrl)
      // Redirect to embedded app - error can be handled in app UI
      return NextResponse.redirect(`${embeddedAppUrl}?error=${encodeURIComponent(errorMessage)}`)
    }
    
    // Fallback: return error response if we can't construct embedded URL
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(`OAuth callback error: ${errorMessage}`, { status: 500 })
  }
}
