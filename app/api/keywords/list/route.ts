import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSiteFromSession, ShopifySessionTokenError } from '@/lib/get-site-from-session'

// Force dynamic rendering (required for database queries)
export const dynamic = 'force-dynamic'

/**
 * GET /api/keywords/list
 * Returns all keywords for the authenticated shop's site
 */
export async function GET(request: Request) {
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

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const source = searchParams.get('source') // Optional filter by source
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build where clause
    const where: any = { siteId: siteData.site.id }
    if (source) {
      where.source = source
    }

    // Fetch keywords
    const [keywords, total] = await Promise.all([
      prisma.keyword.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.keyword.count({ where }),
    ])

    // Group by source for summary
    const bySource = await prisma.keyword.groupBy({
      by: ['source'],
      where: { siteId: siteData.site.id },
      _count: true,
    })

    return NextResponse.json({
      success: true,
      keywords,
      total,
      limit,
      offset,
      summary: {
        total: total,
        bySource: bySource.map((item) => ({
          source: item.source || 'unknown',
          count: item._count,
        })),
      },
    })
  } catch (error) {
    console.error('[Keywords List] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch keywords',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
