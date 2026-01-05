import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getShopifyAuthUrl, validateShopDomain } from '@/lib/shopify-oauth'

/**
 * GET /api/shopify/auth
 * Initiates Shopify OAuth flow
 * 
 * Query parameters:
 * - shop: The Shopify shop domain (e.g., "mystore" or "mystore.myshopify.com")
 */
export async function GET(request: Request) {
  const { userId } = await auth()
  
  if (!userId) {
    return new Response('Unauthorized', { status: 401 })
  }
  
  const { searchParams } = new URL(request.url)
  const shop = searchParams.get('shop')
  
  if (!shop) {
    return new Response('Missing shop parameter', { status: 400 })
  }
  
  try {
    console.log(`[Shopify OAuth Initiation] Starting OAuth flow for user: ${userId}`)
    console.log(`[Shopify OAuth Initiation] Input shop parameter: ${shop}`)
    
    // Validate and normalize shop domain
    const shopDomain = validateShopDomain(shop)
    console.log(`[Shopify OAuth Initiation] Normalized shop domain: ${shopDomain}`)
    
    // Generate OAuth URL (redirect_uri is derived internally from NEXT_PUBLIC_APP_URL)
    const authUrl = getShopifyAuthUrl(shopDomain)
    
    // Store shop domain in session/cookie for callback
    // For MVP, we'll pass it as state parameter
    const state = Buffer.from(JSON.stringify({ userId, shop: shopDomain })).toString('base64')
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

