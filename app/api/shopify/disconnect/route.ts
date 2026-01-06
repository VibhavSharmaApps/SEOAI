import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/shopify/disconnect
 * Disconnects the Shopify store by removing the access token
 */
export async function POST() {
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

    // Remove the access token (disconnect)
    await prisma.site.update({
      where: { id: site.id },
      data: {
        shopifyAccessToken: null,
        isActive: false,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Shopify store disconnected successfully',
    })
  } catch (error) {
    console.error('[Disconnect] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to disconnect Shopify store',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

