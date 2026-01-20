import { NextResponse } from 'next/server'
import { getSiteFromSession, ShopifySessionTokenError } from '@/lib/get-site-from-session'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

/**
 * GET /api/dashboard/status
 * Minimal endpoint to verify Shopify session token usage
 * Returns static JSON indicating connection status
 */
export async function GET(request: Request) {
  try {
    // Verify Shopify session token
    await getSiteFromSession(request)
    
    // Return static response
    return NextResponse.json({ connected: true })
  } catch (error) {
    if (error instanceof ShopifySessionTokenError) {
      return NextResponse.json(
        { connected: false },
        { status: error.statusCode }
      )
    }
    throw error
  }
}

