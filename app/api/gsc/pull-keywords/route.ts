import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getGSCClient, GSCAuthRequiredError, GSCApiError } from '@/lib/gscClient'
import { fetchGSCQueryData } from '@/lib/google-search-console'

// Force dynamic rendering (required for auth and database queries)
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
    const days = body.days || 28
    const minImpressions = body.min_impressions || 10
    const limit = body.limit || 100
    const siteUrl = body.site_url || site.shopifyStoreUrl

    // Calculate date range (last N days)
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    console.log(`[GSC Pull Keywords] Fetching data for ${siteUrl} from ${startDate.toISOString()} to ${endDate.toISOString()}`)

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

    // Ensure GSC property exists in database
    await prisma.gSCProperty.upsert({
      where: {
        siteId_siteUrl: {
          siteId: site.id,
          siteUrl: siteUrl,
        },
      },
      update: {},
      create: {
        siteId: site.id,
        siteUrl: siteUrl,
        isActive: true,
      },
    })

    // Fetch query-level data from Google Search Console
    let queryData
    try {
      queryData = await fetchGSCQueryData(
        siteUrl,
        gscClient.accessToken,
        startDate,
        endDate
      )
      console.log(`[GSC Pull Keywords] Fetched ${queryData.length} queries from GSC`)
      
      // Mark property as active if fetch succeeded
      await prisma.gSCProperty.update({
        where: {
          siteId_siteUrl: {
            siteId: site.id,
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
        (gscError instanceof GSCApiError && (gscError.statusCode === 401 || gscError.statusCode === 403)) ||
        (gscError instanceof Error && (gscError.message.includes('401') || gscError.message.includes('403')))
      
      if (isAccessRevoked) {
        // Mark property as inactive
        await prisma.gSCProperty.update({
          where: {
            siteId_siteUrl: {
              siteId: site.id,
              siteUrl: siteUrl,
            },
          },
          data: {
            isActive: false,
          },
        })
        
        console.log(`[GSC Pull Keywords] Marked property ${siteUrl} as inactive due to access revocation`)
        
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
      
      return NextResponse.json(
        {
          error: 'Failed to fetch data from Google Search Console',
          message: gscError instanceof Error ? gscError.message : 'Unknown error',
        },
        { status: 500 }
      )
    }

    // Filter and sort queries
    const filteredQueries = queryData
      .filter((q) => q.impressions >= minImpressions) // Filter by minimum impressions
      .sort((a, b) => b.impressions - a.impressions) // Sort by impressions desc
      .slice(0, limit) // Limit to top N

    console.log(`[GSC Pull Keywords] Processing ${filteredQueries.length} keywords (filtered from ${queryData.length})`)

    // Process each query
    let keywordsUpserted = 0
    let dailyRecordsCreated = 0
    const errors: string[] = []

    // Get today's date (for idempotency - same day = same data)
    const today = new Date()
    today.setHours(0, 0, 0, 0) // Set to start of day

    for (const query of filteredQueries) {
      try {
        // Upsert keyword into keywords table
        await prisma.keyword.upsert({
          where: {
            siteId_keyword: {
              siteId: site.id,
              keyword: query.query,
            },
          },
          update: {
            // Update if exists (but keep other fields)
            updatedAt: new Date(),
          },
          create: {
            siteId: site.id,
            keyword: query.query,
            source: 'gsc',
          },
        })
        keywordsUpserted++

        // Insert daily aggregate (idempotent per day)
        // Using upsert to ensure idempotency - same keyword + date = update, not duplicate
        await prisma.gSCKeywordDaily.upsert({
          where: {
            siteId_keyword_date: {
              siteId: site.id,
              keyword: query.query,
              date: today, // Use today's date for the snapshot
            },
          },
          update: {
            // Update if already exists for today
            impressions: query.impressions,
            clicks: query.clicks,
            position: query.position,
          },
          create: {
            siteId: site.id,
            keyword: query.query,
            date: today,
            impressions: query.impressions,
            clicks: query.clicks,
            position: query.position,
          },
        })
        dailyRecordsCreated++
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        errors.push(`Failed to process "${query.query}": ${errorMsg}`)
        console.error(`[GSC Pull Keywords] Error processing keyword "${query.query}":`, error)
      }
    }

    console.log(`[GSC Pull Keywords] Complete. Keywords upserted: ${keywordsUpserted}, Daily records: ${dailyRecordsCreated}`)

    return NextResponse.json({
      success: true,
      message: 'Keywords pulled successfully',
      summary: {
        totalQueriesFetched: queryData.length,
        queriesFiltered: filteredQueries.length,
        keywordsUpserted,
        dailyRecordsCreated,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
        snapshotDate: today.toISOString(),
        filters: {
          minImpressions,
          limit,
        },
      },
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('[GSC Pull Keywords] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to pull keywords',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

