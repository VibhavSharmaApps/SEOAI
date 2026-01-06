import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { exchangeCodeForToken, encryptToken } from '@/lib/shopify-oauth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/shopify/callback
 * Handles Shopify OAuth callback
 * 
 * Query parameters:
 * - code: Authorization code from Shopify
 * - shop: The Shopify shop domain
 * - state: Base64 encoded state containing userId and shop
 */
export async function GET(request: Request) {
  const { userId } = await auth()
  
  if (!userId) {
    return new Response('Unauthorized', { status: 401 })
  }
  
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const shop = searchParams.get('shop')
  const stateParam = searchParams.get('state')
  
  if (!code || !shop || !stateParam) {
    return new Response('Missing required parameters', { status: 400 })
  }
  
  try {
    console.log('[Shopify Callback] Starting callback processing')
    console.log('[Shopify Callback] Parameters:', { code: code ? 'present' : 'missing', shop, state: stateParam ? 'present' : 'missing' })
    
    // Decode state to get userId and shop
    let state
    try {
      state = JSON.parse(Buffer.from(stateParam, 'base64').toString('utf-8'))
      console.log('[Shopify Callback] Decoded state:', { userId: state.userId, shop: state.shop })
    } catch (e) {
      console.error('[Shopify Callback] Failed to decode state:', e)
      throw new Error('Invalid state parameter format')
    }
    
    // Verify userId matches (security check)
    if (state.userId !== userId) {
      console.error('[Shopify Callback] User ID mismatch:', { stateUserId: state.userId, currentUserId: userId })
      return new Response('Invalid state parameter', { status: 400 })
    }
    
    console.log('[Shopify Callback] Exchanging code for token...')
    // Exchange authorization code for access token
    const tokenData = await exchangeCodeForToken(shop, code)
    console.log('[Shopify Callback] Token exchange successful')
    
    console.log('[Shopify Callback] Encrypting token...')
    // Encrypt the access token for secure storage
    const encryptedToken = encryptToken(tokenData.access_token)
    console.log('[Shopify Callback] Token encrypted successfully')
    
    console.log('[Shopify Callback] Looking up user in database...')
    // Get or create user in database
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    })
    
    if (!user) {
      console.error('[Shopify Callback] User not found in database:', userId)
      return new Response('User not found in database', { status: 404 })
    }
    console.log('[Shopify Callback] User found:', user.id)
    
    console.log('[Shopify Callback] Checking for existing site...')
    // Check if site already exists for this user (MVP: one store per user)
    const existingSite = await prisma.site.findFirst({
      where: { userId: user.id },
    })
    
    if (existingSite) {
      console.log('[Shopify Callback] Updating existing site:', existingSite.id)
      // Update existing site
      await prisma.site.update({
        where: { id: existingSite.id },
        data: {
          domain: shop,
          shopifyStoreUrl: `https://${shop}`,
          shopifyAccessToken: encryptedToken,
          isActive: true,
        },
      })
      console.log('[Shopify Callback] Site updated successfully')
    } else {
      console.log('[Shopify Callback] Creating new site...')
      // Create new site
      await prisma.site.create({
        data: {
          userId: user.id,
          domain: shop,
          shopifyStoreUrl: `https://${shop}`,
          shopifyAccessToken: encryptedToken,
          name: shop.replace('.myshopify.com', ''),
        },
      })
      console.log('[Shopify Callback] Site created successfully')
    }
    
    console.log('[Shopify Callback] Redirecting to dashboard with success...')
    // Redirect to dashboard on success
    const baseUrl = new URL(request.url).origin
    return NextResponse.redirect(`${baseUrl}/dashboard?shopify=connected`)
  } catch (error) {
    console.error('[Shopify Callback] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    })
    const baseUrl = new URL(request.url).origin
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    // Include error message in URL for debugging (will be visible in browser)
    return NextResponse.redirect(`${baseUrl}/dashboard?shopify=error&msg=${encodeURIComponent(errorMessage)}`)
  }
}

