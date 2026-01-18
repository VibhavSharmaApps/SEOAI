import { NextResponse } from 'next/server'
import { getSiteFromSession, ShopifySessionTokenError } from '@/lib/get-site-from-session'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

/**
 * GET /api/test-auth
 * Test endpoint to verify Shopify session token verification
 * 
 * This endpoint helps verify:
 * - Token verification is working
 * - Requests without Authorization header fail
 * - Expired tokens are rejected
 * - Valid tokens work correctly
 * 
 * Usage:
 * - With valid token: Should return 200 with shop info
 * - Without token: Should return 401
 * - With expired token: Should return 401
 */
export async function GET(request: Request) {
  const timestamp = new Date().toISOString()
  console.log(`[Test Auth ${timestamp}] Test endpoint called`)

  try {
    // Verify Shopify session token
    let siteData
    try {
      siteData = await getSiteFromSession(request)
    } catch (error) {
      if (error instanceof ShopifySessionTokenError) {
        console.log(`[Test Auth ${timestamp}] ❌ Token verification failed: ${error.message}`)
        return NextResponse.json(
          {
            success: false,
            error: error.message,
            statusCode: error.statusCode,
            message: 'Token verification failed - this is expected for testing',
          },
          { status: error.statusCode }
        )
      }
      throw error
    }

    // If we get here, token is valid
    console.log(`[Test Auth ${timestamp}] ✅ Token verification successful`)

    return NextResponse.json({
      success: true,
      message: 'Token verification successful',
      shop: siteData.site.domain,
      siteId: siteData.site.id,
      sessionInfo: {
        shop: siteData.sessionInfo.shop,
        userId: siteData.sessionInfo.userId || null,
        expiresAt: siteData.sessionInfo.exp ? new Date(siteData.sessionInfo.exp * 1000).toISOString() : null,
      },
      timestamp,
    })
  } catch (error) {
    console.error(`[Test Auth ${timestamp}] ❌ Unexpected error:`, error)
    return NextResponse.json(
      {
        success: false,
        error: 'Unexpected error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp,
      },
      { status: 500 }
    )
  }
}

