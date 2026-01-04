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
    // Decode state to get userId and shop
    const state = JSON.parse(Buffer.from(stateParam, 'base64').toString('utf-8'))
    
    // Verify userId matches (security check)
    if (state.userId !== userId) {
      return new Response('Invalid state parameter', { status: 400 })
    }
    
    // Exchange authorization code for access token
    const tokenData = await exchangeCodeForToken(shop, code)
    
    // Encrypt the access token for secure storage
    const encryptedToken = encryptToken(tokenData.access_token)
    
    // Get or create user in database
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    })
    
    if (!user) {
      return new Response('User not found in database', { status: 404 })
    }
    
    // Check if site already exists for this user (MVP: one store per user)
    const existingSite = await prisma.site.findFirst({
      where: { userId: user.id },
    })
    
    if (existingSite) {
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
    } else {
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
    }
    
    // Redirect to dashboard on success
    const baseUrl = new URL(request.url).origin
    return NextResponse.redirect(`${baseUrl}/dashboard?shopify=connected`)
  } catch (error) {
    console.error('Shopify OAuth callback error:', error)
    const baseUrl = new URL(request.url).origin
    return NextResponse.redirect(`${baseUrl}/dashboard?shopify=error`)
  }
}

