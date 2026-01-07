import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Force dynamic rendering (required for auth and database queries)
export const dynamic = 'force-dynamic'

/**
 * GET /api/keywords/list
 * Returns all keywords for the authenticated user's site
 */
export async function GET(request: Request) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user and their site
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: { sites: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const site = user.sites[0]

    if (!site) {
      return NextResponse.json({ error: 'No Shopify store connected' }, { status: 400 })
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const source = searchParams.get('source') // Optional filter by source
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build where clause
    const where: any = { siteId: site.id }
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
      where: { siteId: site.id },
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

