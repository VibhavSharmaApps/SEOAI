import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchGSCQueryPageData } from '@/lib/google-search-console'
import { getGSCClient, GSCAuthRequiredError, GSCApiError } from '@/lib/gscClient'

// Force dynamic rendering (required for auth and database queries)
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
      return NextResponse.json({ error: 'No site connected' }, { status: 400 })
    }

    // Parse optional body parameters
    const body = await request.json().catch(() => ({}))
    const days = body.days || 7
    const siteUrl = body.site_url || site.shopifyStoreUrl

    // Calculate date range (last N days)
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    console.log(`[Performance Snapshot] Fetching GSC data for ${siteUrl} from ${startDate.toISOString()} to ${endDate.toISOString()}`)

    // Get authenticated GSC client
    let gscClient
    try {
      gscClient = await getGSCClient()
    } catch (authError) {
      if (authError instanceof GSCAuthRequiredError) {
        return NextResponse.json(
          {
            error: 'Google Search Console authentication required',
            message: authError.message,
            code: 'GSC_AUTH_REQUIRED',
          },
          { status: 401 }
        )
      }
      throw authError
    }

    // Fetch query + page data from Google Search Console
    let queryPageData
    try {
      queryPageData = await fetchGSCQueryPageData(
        siteUrl,
        gscClient.accessToken,
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
      where: { siteId: site.id },
      select: {
        id: true,
        url: true,
        type: true,
      },
    })

    console.log(`[Performance Snapshot] Found ${pages.length} pages in database`)

    // Create a map of URL -> page ID for quick lookup
    // Normalize URLs for matching (remove trailing slashes, handle http/https)
    const urlToPageMap = new Map<string, string>()
    pages.forEach((page) => {
      const normalizedUrl = normalizeUrl(page.url)
      urlToPageMap.set(normalizedUrl, page.id)
    })

    // Process and store performance data
    let storedCount = 0
    let skippedCount = 0
    const errors: string[] = []

    // Group by date (GSC data is aggregated, but we'll store daily snapshots)
    // For simplicity, we'll store one snapshot per query-page combination
    // You may want to aggregate by day if GSC returns daily data
    for (const data of queryPageData) {
      try {
        // Normalize the page URL from GSC
        const normalizedGscUrl = normalizeUrl(data.page)
        
        // Find matching page in our database
        const pageId = urlToPageMap.get(normalizedGscUrl)

        if (!pageId) {
          skippedCount++
          console.log(`[Performance Snapshot] No matching page found for URL: ${data.page}`)
          continue
        }

        // Store performance snapshot
        // Using upsert to handle duplicates (same page, keyword, date)
        await prisma.performanceSnapshot.upsert({
          where: {
            pageId_keyword_date: {
              pageId,
              keyword: data.query,
              date: endDate, // Use end date as snapshot date (or you could use startDate)
            },
          },
          update: {
            impressions: data.impressions,
            clicks: data.clicks,
            position: data.position,
          },
          create: {
            pageId,
            keyword: data.query,
            impressions: data.impressions,
            clicks: data.clicks,
            position: data.position,
            date: endDate,
          },
        })

        storedCount++
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        errors.push(`Failed to store ${data.query} -> ${data.page}: ${errorMsg}`)
        console.error(`[Performance Snapshot] Error storing data:`, error)
      }
    }

    console.log(`[Performance Snapshot] Complete. Stored: ${storedCount}, Skipped: ${skippedCount}`)

    return NextResponse.json({
      success: true,
      message: 'Performance snapshot created successfully',
      summary: {
        totalGSCRecords: queryPageData.length,
        stored: storedCount,
        skipped: skippedCount,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
      },
      errors: errors.length > 0 ? errors : undefined,
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

/**
 * Normalizes URLs for matching
 * - Removes trailing slashes
 * - Normalizes http/https
 * - Removes www (optional)
 */
function normalizeUrl(url: string): string {
  try {
    // Parse URL to handle different formats
    let normalized = url.trim()
    
    // Remove trailing slash
    normalized = normalized.replace(/\/$/, '')
    
    // Normalize protocol (convert http to https for matching)
    normalized = normalized.replace(/^http:\/\//, 'https://')
    
    // Remove www (optional - you may want to keep this)
    // normalized = normalized.replace(/^https?:\/\/www\./, 'https://')
    
    return normalized.toLowerCase()
  } catch {
    // If URL parsing fails, return as-is
    return url.toLowerCase()
  }
}

