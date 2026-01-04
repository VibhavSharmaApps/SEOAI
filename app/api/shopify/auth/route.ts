import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { NextResponse } from 'next/server'
import { getShopifyAuthUrl, validateShopDomain } from '@/lib/shopify-oauth'
import { getAppUrl } from '@/lib/app-url'

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
    // Validate and normalize shop domain
    const shopDomain = validateShopDomain(shop)
    
    // Generate redirect URI (callback URL)
    // Automatically detects Vercel URL or uses NEXT_PUBLIC_APP_URL
    const baseUrl = getAppUrl()
    // Ensure no trailing slashes and proper formatting
    const redirectUri = `${baseUrl.replace(/\/$/, '')}/api/shopify/callback`
    
    // Log the redirect URI for debugging (remove in production if needed)
    console.log('Shopify OAuth Redirect URI:', redirectUri)
    
    // Generate OAuth URL
    const authUrl = getShopifyAuthUrl(shopDomain, redirectUri)
    
    // Store shop domain in session/cookie for callback
    // For MVP, we'll pass it as state parameter
    const state = Buffer.from(JSON.stringify({ userId, shop: shopDomain })).toString('base64')
    const finalAuthUrl = `${authUrl}&state=${encodeURIComponent(state)}`
    
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

