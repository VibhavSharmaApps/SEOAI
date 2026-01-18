import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSiteFromSessionWithGSC, ShopifySessionTokenError } from '@/lib/get-site-from-session-gsc'
import { fetchGSCQueryData } from '@/lib/google-search-console'
import { GSCAuthRequiredError, GSCApiError } from '@/lib/gsc-errors'

// Force dynamic rendering (required for database queries)
export const dynamic = 'force-dynamic'

/**
 * POST /api/gsc/pull-keywords
 * Fetches Google Search Console keyword data and stores it
 * 
 * Body (optional):
 * - site_url: GSC property URL (defaults to site's shopifyStoreUrl)
 * - days: Number of days to fetch (default: 28)
 * - min_impressions: Minimum impressions threshold (default: 10)
 * - limit: Maximum number of keywords to process (default: 100)
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
    const days = body.days || 28
    const minImpressions = body.min_impressions || 10
    const limit = body.limit || 100
    const siteUrl = body.site_url || siteData.site.shopifyStoreUrl

    // Calculate date range (last N days)
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    console.log(`[GSC Pull Keywords] Fetching data for ${siteUrl} from ${startDate.toISOString()} to ${endDate.toISOString()}`)

    // Ensure GSC property exists in database
    await prisma.gSCProperty.upsert({
      where: {
        siteId_siteUrl: {
          siteId: siteData.site.id,
          siteUrl: siteUrl,
        },
      },
      update: {},
      create: {
        siteId: siteData.site.id,
        siteUrl: siteUrl,
        isActive: true,
      },
    })

    // Fetch query-level data from Google Search Console
    let queryData
    try {
      if (!siteData.googleAccessToken) {
        throw new GSCAuthRequiredError('Google OAuth token not available')
      }

      queryData = await fetchGSCQueryData(
        siteUrl,
        siteData.googleAccessToken,
        startDate,
        endDate
      )
      console.log(`[GSC Pull Keywords] Fetched ${queryData.length} queries from GSC`)
      
      // Mark property as active if fetch succeeded
      await prisma.gSCProperty.update({
        where: {
          siteId_siteUrl: {
            siteId: siteData.site.id,
            siteUrl: siteUrl,
          },
        },
        data: {
          isActive: true,
        },
      })
    } catch (gscError) {
      console.error('[GSC Pull Keywords] GSC API error:', gscError)
      
      // Check if it's a 401 or 403 error (access revoked)
      const isAccessRevoked = 
        (gscError instanceof GSCApiError && (gscError.statusCode === 401 || gscError.statusCode === 403))
      
      if (isAccessRevoked) {
        // Mark property as inactive
        await prisma.gSCProperty.update({
          where: {
            siteId_siteUrl: {
              siteId: siteData.site.id,
              siteUrl: siteUrl,
            },
          },
          data: {
            isActive: false,
          },
        })

        return NextResponse.json(
          {
            error: 'GSC access revoked',
            message: 'Google Search Console access has been revoked. Please re-authenticate.',
            code: 'GSC_ACCESS_REVOKED',
            siteUrl: siteUrl,
          },
          { status: 409 }
        )
      }

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

      throw gscError
    }

    // Filter queries by minimum impressions
    const filteredQueries = queryData.filter((q) => q.impressions >= minImpressions)

    // Sort by impressions descending and limit
    const topQueries = filteredQueries
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, limit)

    console.log(`[GSC Pull Keywords] Processing ${topQueries.length} queries (filtered from ${queryData.length} total)`)

    // Upsert keywords (idempotent - won't create duplicates)
    let keywordsCreated = 0
    let keywordsSkipped = 0

    for (const query of topQueries) {
      try {
        await prisma.keyword.upsert({
          where: {
            siteId_keyword: {
              siteId: siteData.site.id,
              keyword: query.query,
            },
          },
          update: {
            // Update source if it's from GSC
            source: query.source || 'gsc',
          },
          create: {
            siteId: siteData.site.id,
            keyword: query.query,
            source: 'gsc',
          },
        })
        keywordsCreated++
      } catch (error: any) {
        if (error.code === 'P2002') {
          // Unique constraint violation - keyword already exists
          keywordsSkipped++
          continue
        }
        console.error(`[GSC Pull Keywords] Error upserting keyword "${query.query}":`, error)
        // Continue with next keyword
      }
    }

    // Insert daily aggregates into gsc_keyword_daily (idempotent per day)
    let dailyRecordsCreated = 0
    for (const query of topQueries) {
      try {
        await prisma.gSCKeywordDaily.upsert({
          where: {
            siteId_keyword_date: {
              siteId: siteData.site.id,
              keyword: query.query,
              date: query.date,
            },
          },
          update: {
            impressions: query.impressions,
            clicks: query.clicks,
            position: query.position,
          },
          create: {
            siteId: siteData.site.id,
            keyword: query.query,
            date: query.date,
            impressions: query.impressions,
            clicks: query.clicks,
            position: query.position,
          },
        })
        dailyRecordsCreated++
      } catch (error) {
        console.error(`[GSC Pull Keywords] Error upserting daily record for "${query.query}":`, error)
        // Continue with next query
      }
    }

    console.log(`[GSC Pull Keywords] Complete. Keywords: ${keywordsCreated} created, ${keywordsSkipped} skipped. Daily records: ${dailyRecordsCreated} created/updated.`)

    return NextResponse.json({
      success: true,
      message: 'GSC keywords pulled successfully',
      summary: {
        queriesFetched: queryData.length,
        queriesFiltered: filteredQueries.length,
        queriesProcessed: topQueries.length,
        keywordsCreated,
        keywordsSkipped,
        dailyRecordsCreated,
      },
    })
  } catch (error) {
    console.error('[GSC Pull Keywords] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to pull GSC keywords',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
