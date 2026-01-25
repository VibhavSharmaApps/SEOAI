import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { encryptToken } from '@/lib/shopify-oauth'
import { getSiteFromSession, ShopifySessionTokenError } from '@/lib/get-site-from-session'
import { testWordPressConnection } from '@/lib/wordpress-api'

export const dynamic = 'force-dynamic'

/**
 * POST /api/wordpress/connect
 * Connects a WordPress site by storing credentials
 * 
 * Body:
 * - siteUrl: WordPress site URL
 * - username: WordPress username
 * - applicationPassword: WordPress application password
 */
export async function POST(request: Request) {
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

    const body = await request.json()
    const { siteUrl, username, applicationPassword } = body

    // Basic required field validation
    if (!siteUrl || !username || !applicationPassword) {
      return NextResponse.json(
        { error: 'Missing required fields: siteUrl, username, and applicationPassword are required' },
        { status: 400 }
      )
    }

    // Test WordPress connection
    try {
      const testResult = await testWordPressConnection({
        siteUrl,
        username,
        applicationPassword,
      })

      if (!testResult.success) {
        return NextResponse.json(
          { error: `WordPress connection failed: ${testResult.error || testResult.message}` },
          { status: 400 }
        )
      }
    } catch (testError) {
      return NextResponse.json(
        { error: `WordPress connection test failed: ${testError instanceof Error ? testError.message : 'Unknown error'}` },
        { status: 400 }
      )
    }

    // Encrypt application password (reuse Shopify encryption for consistency)
    const encryptedPassword = encryptToken(applicationPassword)

    // Update site with WordPress credentials
    // For now, we'll store WordPress site URL in domain and shopifyStoreUrl fields
    // and use shopifyAccessToken to store encrypted application password
    // This is a temporary solution until dedicated WordPress fields are added
    const normalizedSiteUrl = siteUrl.replace(/\/$/, '') // Remove trailing slash
    const siteDomain = new URL(normalizedSiteUrl).hostname // Extract domain from URL

    const updatedSite = await prisma.site.update({
      where: { id: siteData.site.id },
      data: {
        cmsType: 'WORDPRESS',
        domain: siteDomain,
        shopifyStoreUrl: normalizedSiteUrl, // Reuse this field for WordPress site URL
        shopifyAccessToken: encryptedPassword, // Reuse this field for encrypted application password
        // Store username in name field temporarily (or we can add a dedicated field later)
        name: username,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'WordPress site connected successfully',
      siteId: updatedSite.id,
    })
  } catch (error) {
    console.error('[WordPress Connect] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to connect WordPress site',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

