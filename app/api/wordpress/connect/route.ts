import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { encryptToken } from '@/lib/shopify-oauth'
import { testWordPressConnection } from '@/lib/wordpress-api'

export const dynamic = 'force-dynamic'

/**
 * POST /api/wordpress/connect
 * Public endpoint to connect a WordPress site
 * Does NOT require Shopify session token authentication
 * 
 * Body:
 * - siteUrl: WordPress site URL
 * - username: WordPress username
 * - applicationPassword: WordPress application password
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { siteUrl, username, applicationPassword } = body

    // Basic required field validation
    if (!siteUrl || !username || !applicationPassword) {
      return NextResponse.json(
        { error: 'Missing required fields: siteUrl, username, and applicationPassword are required' },
        { status: 400 }
      )
    }

    // Normalize site URL
    const normalizedSiteUrl = siteUrl.replace(/\/$/, '') // Remove trailing slash
    let siteDomain: string
    try {
      siteDomain = new URL(normalizedSiteUrl).hostname
    } catch (urlError) {
      return NextResponse.json(
        { error: 'Invalid site URL format' },
        { status: 400 }
      )
    }

    // Test WordPress connection by making an authenticated request to /wp-json/wp/v2/posts
    try {
      const testResult = await testWordPressConnection({
        siteUrl: normalizedSiteUrl,
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

    // Create or update Site record with WordPress credentials
    // Use upsert to handle both new connections and updates
    const site = await prisma.site.upsert({
      where: { domain: siteDomain },
      update: {
        cmsType: 'WORDPRESS',
        shopifyStoreUrl: normalizedSiteUrl, // Reuse this field for WordPress site URL
        shopifyAccessToken: encryptedPassword, // Reuse this field for encrypted application password
        name: username, // Store username in name field
        isActive: true,
      },
      create: {
        cmsType: 'WORDPRESS',
        domain: siteDomain,
        shopifyStoreUrl: normalizedSiteUrl, // Reuse this field for WordPress site URL
        shopifyAccessToken: encryptedPassword, // Reuse this field for encrypted application password
        name: username, // Store username in name field
        isActive: true,
        type: 'SHOPIFY', // Required field, but not used for WordPress
      },
    })

    return NextResponse.json({
      success: true,
      message: 'WordPress site connected successfully',
      siteId: site.id,
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

