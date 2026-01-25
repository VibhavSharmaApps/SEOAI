import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/wordpress/status
 * Public endpoint that returns WordPress site connection status
 * Does NOT require Shopify session token authentication
 * 
 * Returns:
 * - { connected: true, siteUrl: string } if an active WordPress site exists
 * - { connected: false } if no active WordPress site exists
 */
export async function GET(request: Request) {
  try {
    // Query database for an active WordPress site
    const wordPressSite = await prisma.site.findFirst({
      where: {
        cmsType: 'WORDPRESS',
        isActive: true,
      },
      select: {
        shopifyStoreUrl: true, // Reused field that stores WordPress site URL
      },
    })

    // If an active WordPress site exists, return connected status
    if (wordPressSite && wordPressSite.shopifyStoreUrl) {
      return NextResponse.json({
        connected: true,
        siteUrl: wordPressSite.shopifyStoreUrl,
      }, { status: 200 })
    }

    // No active WordPress site found
    return NextResponse.json({
      connected: false,
    }, { status: 200 })
  } catch (error) {
    console.error('[WordPress Status] Error:', error)
    // Return 200 even on error, with connected: false
    return NextResponse.json(
      {
        connected: false,
      },
      { status: 200 }
    )
  }
}

