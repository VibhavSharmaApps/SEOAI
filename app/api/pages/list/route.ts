import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Force dynamic rendering (required for auth and database queries)
export const dynamic = 'force-dynamic'

/**
 * GET /api/pages/list
 * Returns all pages for the authenticated user's site
 * Useful for getting page IDs for testing content generation
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
    const pageType = searchParams.get('type') // Optional filter by type (PRODUCT, COLLECTION, ARTICLE)

    // Build where clause
    const where: any = { siteId: site.id }
    if (pageType && ['PRODUCT', 'COLLECTION', 'ARTICLE'].includes(pageType)) {
      where.type = pageType
    }

    // Fetch pages with content version counts and keyword counts
    const pages = await prisma.page.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        title: true,
        url: true,
        shopifyId: true,
        contentVersions: {
          select: {
            version: true,
          },
          orderBy: {
            version: 'desc',
          },
          take: 1,
        },
      },
    })

    // Get keyword counts per page
    const keywordCounts = await prisma.keyword.groupBy({
      by: ['source'],
      where: { siteId: site.id },
      _count: true,
    })

    // Create a map of source -> count
    const sourceCountMap = new Map<string, number>()
    keywordCounts.forEach((item) => {
      if (item.source) {
        sourceCountMap.set(item.source, item._count)
      }
    })

    // Add version count and keyword count to each page
    const pagesWithCounts = pages.map((page) => {
      const source = `${page.type.toLowerCase()}:${page.shopifyId}`
      const keywordCount = sourceCountMap.get(source) || 0
      return {
        id: page.id,
        type: page.type,
        title: page.title,
        url: page.url,
        shopifyId: page.shopifyId,
        contentVersionsCount: page.contentVersions.length,
        latestVersion: page.contentVersions[0]?.version || 0,
        keywordCount,
      }
    })

    // Group by type for summary
    const byType = await prisma.page.groupBy({
      by: ['type'],
      where: { siteId: site.id },
      _count: true,
    })

    return NextResponse.json({
      success: true,
      pages: pagesWithCounts,
      summary: {
        total: pages.length,
        byType: byType.map((item) => ({
          type: item.type,
          count: item._count,
        })),
      },
    })
  } catch (error) {
    console.error('[Pages List] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch pages',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

