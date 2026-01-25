import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSiteFromSession, ShopifySessionTokenError } from '@/lib/get-site-from-session'

export const dynamic = 'force-dynamic'

/**
 * GET /api/wordpress/status
 * Returns WordPress site connection status
 */
export async function GET(request: Request) {
  try {
    // Verify session token and get site
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

    // Check if WordPress site is connected
    const isConnected = siteData.site.cmsType === 'WORDPRESS' && 
                       siteData.site.shopifyStoreUrl && 
                       siteData.site.shopifyAccessToken

    return NextResponse.json({
      connected: isConnected,
      cmsType: siteData.site.cmsType,
      siteUrl: siteData.site.shopifyStoreUrl || null,
      domain: siteData.site.domain || null,
    })
  } catch (error) {
    console.error('[WordPress Status] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to get WordPress status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

