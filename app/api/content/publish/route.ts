import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/shopify-oauth'
import { updateProductDescription, updateArticleBody, getBlogIdForArticle } from '@/lib/shopify-publish'

// Force dynamic rendering (required for auth and database queries)
export const dynamic = 'force-dynamic'

/**
 * POST /api/content/publish
 * Publishes the latest content version to Shopify
 * 
 * Body:
 * - page_id: ID of the page to publish
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { page_id } = body

    // Validate required fields
    if (!page_id) {
      return NextResponse.json(
        { error: 'Missing required field: page_id' },
        { status: 400 }
      )
    }

    // Get user and verify ownership
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: { sites: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Find the page and verify it belongs to the user's site
    const page = await prisma.page.findUnique({
      where: { id: page_id },
      include: { 
        site: true,
        contentVersions: {
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    })

    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 })
    }

    // Verify the page belongs to one of the user's sites
    const userSiteIds = user.sites.map((s) => s.id)
    if (!userSiteIds.includes(page.siteId)) {
      return NextResponse.json(
        { error: 'Unauthorized: Page does not belong to your site' },
        { status: 403 }
      )
    }

    // Check if there's a content version to publish
    if (page.contentVersions.length === 0) {
      return NextResponse.json(
        { error: 'No content versions found for this page. Generate content first.' },
        { status: 400 }
      )
    }

    const latestVersion = page.contentVersions[0]

    // Check if already published
    if (latestVersion.publishedAt) {
      return NextResponse.json(
        { 
          error: 'This version is already published',
          publishedAt: latestVersion.publishedAt,
        },
        { status: 400 }
      )
    }

    // Verify Shopify access token exists
    if (!page.site.shopifyAccessToken) {
      return NextResponse.json(
        { error: 'Shopify access token not found' },
        { status: 400 }
      )
    }

    // Decrypt access token
    const accessToken = decryptToken(page.site.shopifyAccessToken)
    const shop = page.site.domain

    console.log(`[Content Publish] Publishing version ${latestVersion.version} for ${page.type} page: "${page.title}"`)

    // Publish to Shopify based on page type
    try {
      if (page.type === 'PRODUCT') {
        // Update product description
        await updateProductDescription(
          shop,
          accessToken,
          page.shopifyId,
          latestVersion.content
        )
      } else if (page.type === 'ARTICLE') {
        // Update article body (need to find blog ID first)
        const blogId = await getBlogIdForArticle(shop, accessToken, page.shopifyId)
        
        if (!blogId) {
          return NextResponse.json(
            { error: 'Could not find blog for this article' },
            { status: 404 }
          )
        }

        await updateArticleBody(
          shop,
          accessToken,
          blogId,
          page.shopifyId,
          latestVersion.content
        )
      } else if (page.type === 'COLLECTION') {
        // Collections don't have editable descriptions in Shopify Admin API
        // They're managed through the theme or metafields
        return NextResponse.json(
          { error: 'Collection pages cannot be published directly. Use metafields or theme customization.' },
          { status: 400 }
        )
      } else {
        return NextResponse.json(
          { error: `Unsupported page type: ${page.type}` },
          { status: 400 }
        )
      }
    } catch (shopifyError) {
      console.error('[Content Publish] Shopify API error:', shopifyError)
      const errorMessage = shopifyError instanceof Error ? shopifyError.message : 'Unknown error'
      
      // Check for common errors and provide helpful messages
      let userFriendlyMessage = errorMessage
      if (errorMessage.includes('403') || errorMessage.includes('Unauthorized')) {
        userFriendlyMessage = 'Missing required Shopify permissions. Please ensure your app has write_products and write_content scopes. Re-authenticate your store after adding these scopes.'
      } else if (errorMessage.includes('404')) {
        userFriendlyMessage = 'Product or article not found in Shopify. The item may have been deleted.'
      } else if (errorMessage.includes('429')) {
        userFriendlyMessage = 'Rate limit exceeded. Please wait a moment and try again.'
      }
      
      return NextResponse.json(
        {
          error: 'Failed to publish to Shopify',
          message: userFriendlyMessage,
          details: errorMessage,
        },
        { status: 500 }
      )
    }

    // Update content version with publish timestamp
    const publishedVersion = await prisma.contentVersion.update({
      where: { id: latestVersion.id },
      data: {
        publishedAt: new Date(),
      },
    })

    // Mark page as tracking enabled
    await prisma.page.update({
      where: { id: page_id },
      data: {
        trackingEnabled: true,
      },
    })

    console.log(`[Content Publish] Successfully published version ${latestVersion.version} for page "${page.title}"`)

    return NextResponse.json({
      success: true,
      message: 'Content published successfully',
      pageId: page_id,
      pageTitle: page.title,
      pageType: page.type,
      version: latestVersion.version,
      publishedAt: publishedVersion.publishedAt,
      trackingEnabled: true,
    })
  } catch (error) {
    console.error('[Content Publish] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to publish content',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

