import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Force dynamic rendering (required for auth and database queries)
export const dynamic = 'force-dynamic'

/**
 * POST /api/keywords/cleanup-duplicates
 * Identifies and optionally removes duplicate keywords per page
 * 
 * This endpoint helps clean up keywords that were created before the 2-per-page limit was enforced.
 * 
 * Query params:
 * - dry_run=true: Only report duplicates, don't delete (default: true)
 * - source=product:123: Only check specific source (optional)
 */
export async function POST(request: Request) {
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
    const dryRun = searchParams.get('dry_run') !== 'false' // Default to true
    const sourceFilter = searchParams.get('source') // Optional source filter

    // Get all keywords for this site
    const where: any = { siteId: site.id }
    if (sourceFilter) {
      where.source = sourceFilter
    }

    const allKeywords = await prisma.keyword.findMany({
      where,
      orderBy: [{ source: 'asc' }, { createdAt: 'asc' }],
    })

    // Group keywords by source
    const keywordsBySource = new Map<string, typeof allKeywords>()
    allKeywords.forEach((kw) => {
      const source = kw.source || 'unknown'
      if (!keywordsBySource.has(source)) {
        keywordsBySource.set(source, [])
      }
      keywordsBySource.get(source)!.push(kw)
    })

    // Find sources with more than 2 keywords
    const duplicates: Array<{
      source: string
      count: number
      keywords: Array<{ id: string; keyword: string; createdAt: Date }>
      toDelete: Array<{ id: string; keyword: string }>
    }> = []

    keywordsBySource.forEach((keywords, source) => {
      if (keywords.length > 2) {
        // Keep the 2 oldest keywords, delete the rest
        const sorted = [...keywords].sort(
          (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
        )
        const toKeep = sorted.slice(0, 2)
        const toDelete = sorted.slice(2)

        duplicates.push({
          source,
          count: keywords.length,
          keywords: keywords.map((k) => ({
            id: k.id,
            keyword: k.keyword,
            createdAt: k.createdAt,
          })),
          toDelete: toDelete.map((k) => ({
            id: k.id,
            keyword: k.keyword,
          })),
        })
      }
    })

    let deletedCount = 0
    const deletedKeywords: Array<{ id: string; keyword: string; source: string }> = []

    if (!dryRun && duplicates.length > 0) {
      // Delete duplicate keywords
      for (const dup of duplicates) {
        for (const kw of dup.toDelete) {
          try {
            await prisma.keyword.delete({
              where: { id: kw.id },
            })
            deletedCount++
            deletedKeywords.push({
              id: kw.id,
              keyword: kw.keyword,
              source: dup.source,
            })
          } catch (error) {
            console.error(`Failed to delete keyword ${kw.id}:`, error)
          }
        }
      }
    }

    // Get summary stats
    const totalKeywords = await prisma.keyword.count({ where: { siteId: site.id } })
    const sourcesWithMoreThan2 = duplicates.length
    const totalDuplicates = duplicates.reduce((sum, d) => sum + d.toDelete.length, 0)

    return NextResponse.json({
      success: true,
      dryRun,
      summary: {
        totalKeywords,
        sourcesWithMoreThan2,
        totalDuplicates,
        deletedCount: dryRun ? 0 : deletedCount,
      },
      duplicates: duplicates.map((d) => ({
        source: d.source,
        count: d.count,
        excess: d.toDelete.length,
        keywords: d.keywords,
        toDelete: d.toDelete,
      })),
      deleted: deletedKeywords,
    })
  } catch (error) {
    console.error('[Keywords Cleanup] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to cleanup duplicates',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

