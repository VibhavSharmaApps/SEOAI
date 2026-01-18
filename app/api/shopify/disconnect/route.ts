import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSiteFromSession, ShopifySessionTokenError } from '@/lib/get-site-from-session'

/**
 * POST /api/shopify/disconnect
 * Disconnects the Shopify store by removing the access token
 */
export async function POST(request: Request) {
  try {
    // Verify Shopify session token and get site
    let siteData
    try {
      siteData = await getSiteFromSession(request)
    } catch (error) {
      if (error instanceof ShopifySessionTokenError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.statusCode }
        )
      }
      throw error
    }

    // Remove the access token (disconnect)
    const updatedSite = await prisma.site.update({
      where: { id: siteData.site.id },
      data: {
        shopifyAccessToken: null,
        isActive: false,
      },
    })

    console.log('[Disconnect] Store disconnected:', {
      siteId: updatedSite.id,
      domain: updatedSite.domain,
      hasToken: !!updatedSite.shopifyAccessToken,
    })

    return NextResponse.json({
      success: true,
      message: 'Shopify store disconnected successfully',
    })
  } catch (error) {
    console.error('[Disconnect] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to disconnect Shopify store',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
