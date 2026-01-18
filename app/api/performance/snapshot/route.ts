import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchGSCQueryPageData } from '@/lib/google-search-console'
import { getSiteFromSessionWithGSC, ShopifySessionTokenError } from '@/lib/get-site-from-session-gsc'
import { GSCAuthRequiredError, GSCApiError } from '@/lib/gsc-errors'

// Force dynamic rendering (required for database queries)
export const dynamic = 'force-dynamic'

/**
 * POST /api/performance/snapshot
 * Fetches Google Search Console data for the last 7 days and stores it
 * 
 * This endpoint:
 * 1. Fetches query + page data from GSC for last 7 days
 * 2. Maps queries to pages in our database
 * 3. Stores performance metrics (impressions, clicks, position)
 * 
 * Body (optional):
 * - site_url: Google Search Console site URL (defaults to site's shopifyStoreUrl)
 * - days: Number of days to fetch (default: 7)
 */
export async function POST(request: Request) {
  try {
    // Verify Shopify session token and get site with Google OAuth token
    let siteData
    try {
      siteData = await getSiteFromSessionWithGSC(request, true)
    } catch (error) {
      if (error instanceof ShopifySessionTokenError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.statusCode }
        )
      }
      if (error instanceof GSCAuthRequiredError) {
        return NextResponse.json(
          {
            error: 'Google Search Console authentication required',
            message: error.message,
            code: 'GSC_AUTH_REQUIRED',
          },
          { status: 401 }
        )
      }
      throw error
    }

    // Parse optional body parameters
    const body = await request.json().catch(() => ({}))
    const days = body.days || 7
    const siteUrl = body.site_url || siteData.site.shopifyStoreUrl

    // Calculate date range (last N days)
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    console.log(`[Performance Snapshot] Fetching GSC data for ${siteUrl} from ${startDate.toISOString()} to ${endDate.toISOString()}`)

    // Fetch query + page data from Google Search Console
    let queryPageData
    try {
      if (!siteData.googleAccessToken) {
        throw new GSCAuthRequiredError('Google OAuth token not available')
      }

      queryPageData = await fetchGSCQueryPageData(
        siteUrl,
        siteData.googleAccessToken,
        startDate,
        endDate
      )
      console.log(`[Performance Snapshot] Fetched ${queryPageData.length} query-page combinations from GSC`)
    } catch (gscError) {
      console.error('[Performance Snapshot] GSC API error:', gscError)
      
      if (gscError instanceof GSCAuthRequiredError) {
        return NextResponse.json(
          {
            error: 'Google Search Console authentication required',
            message: gscError.message,
            code: 'GSC_AUTH_REQUIRED',
          },
          { status: 401 }
        )
      }
      
      if (gscError instanceof GSCApiError) {
        return NextResponse.json(
          {
            error: 'Google Search Console API error',
            message: gscError.message,
            statusCode: gscError.statusCode,
          },
          { status: gscError.statusCode || 500 }
        )
      }
      
      return NextResponse.json(
        {
          error: 'Failed to fetch data from Google Search Console',
          message: gscError instanceof Error ? gscError.message : 'Unknown error',
        },
        { status: 500 }
      )
    }

    // Get all pages for this site to map URLs
    const pages = await prisma.page.findMany({
      where: { siteId: siteData.site.id },
      select: {
        id: true,
        url: true,
        shopifyId: true,
        type: true,
      },
    })

    // Create a map of URL -> Page for quick lookup
    const urlToPageMap = new Map<string, typeof pages[0]>()
    pages.forEach((page) => {
      // Normalize URLs for matching (remove trailing slashes, protocols)
      const normalizedUrl = page.url.replace(/^https?:\/\//, '').replace(/\/$/, '')
      urlToPageMap.set(normalizedUrl, page)
    })

    console.log(`[Performance Snapshot] Mapping ${queryPageData.length} query-page combinations to ${pages.length} pages`)

    // Process and store performance data
    let recordsCreated = 0
    let recordsSkipped = 0
    const unmatchedUrls = new Set<string>()

    for (const item of queryPageData) {
      // Normalize page URL for matching
      const normalizedPageUrl = item.page.replace(/^https?:\/\//, '').replace(/\/$/, '')
      const page = urlToPageMap.get(normalizedPageUrl)

      if (!page) {
        unmatchedUrls.add(item.page)
        recordsSkipped++
        continue
      }

      try {
        // Upsert performance snapshot (idempotent per day)
        await prisma.performanceSnapshot.upsert({
          where: {
            pageId_keyword_date: {
              pageId: page.id,
              keyword: item.query,
              date: item.date,
            },
          },
          update: {
            impressions: item.impressions,
            clicks: item.clicks,
            position: item.position,
          },
          create: {
            pageId: page.id,
            keyword: item.query,
            impressions: item.impressions,
            clicks: item.clicks,
            position: item.position,
            date: item.date,
          },
        })
        recordsCreated++
      } catch (error) {
        console.error(`[Performance Snapshot] Error storing snapshot for page ${page.id}, keyword "${item.query}":`, error)
        recordsSkipped++
        // Continue with next record
      }
    }

    console.log(`[Performance Snapshot] Complete. Created ${recordsCreated} records, skipped ${recordsSkipped} (${unmatchedUrls.size} unique unmatched URLs)`)

    return NextResponse.json({
      success: true,
      message: 'Performance snapshot created successfully',
      summary: {
        queriesFetched: queryPageData.length,
        pagesMatched: recordsCreated,
        recordsSkipped,
        unmatchedUrlsCount: unmatchedUrls.size,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
      },
      unmatchedUrls: Array.from(unmatchedUrls).slice(0, 10), // Return first 10 for debugging
    })
  } catch (error) {
    console.error('[Performance Snapshot] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to create performance snapshot',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
