import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateContent } from '@/lib/openai'
import { decryptToken } from '@/lib/shopify-oauth'
import { fetchProductDescription } from '@/lib/shopify-product-details'
import { getSiteFromSession, ShopifySessionTokenError } from '@/lib/get-site-from-session'

// Force dynamic rendering (required for database queries)
export const dynamic = 'force-dynamic'

/**
 * POST /api/content/generate
 * Generates SEO-optimized content for a page
 * 
 * Body:
 * - page_id: ID of the page to generate content for
 * - primary_keyword: The primary keyword to optimize for
 * - page_type: Type of page (PRODUCT, COLLECTION, ARTICLE)
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

    // Parse request body
    const body = await request.json()
    const { page_id, primary_keyword, page_type } = body

    // Validate required fields
    if (!page_id || !primary_keyword || !page_type) {
      return NextResponse.json(
        { error: 'Missing required fields: page_id, primary_keyword, page_type' },
        { status: 400 }
      )
    }

    // Validate page_type
    if (!['PRODUCT', 'COLLECTION', 'ARTICLE'].includes(page_type)) {
      return NextResponse.json(
        { error: 'Invalid page_type. Must be PRODUCT, COLLECTION, or ARTICLE' },
        { status: 400 }
      )
    }

    // Find the page and verify it belongs to the site from session token
    const page = await prisma.page.findUnique({
      where: { id: page_id },
      include: { site: true },
    })

    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 })
    }

    // Verify the page belongs to the site from session token
    if (page.siteId !== siteData.site.id) {
      return NextResponse.json(
        { error: 'Unauthorized: Page does not belong to your shop' },
        { status: 403 }
      )
    }

    // Verify page type matches
    if (page.type !== page_type) {
      return NextResponse.json(
        { error: `Page type mismatch. Expected ${page.type}, got ${page_type}` },
        { status: 400 }
      )
    }

    console.log(`[Content Generate] Generating content for ${page_type} page: "${page.title}" with keyword: "${primary_keyword}"`)

    // Get product description if it's a product (for better context)
    let description: string | undefined
    if (page.type === 'PRODUCT') {
      try {
        const accessToken = decryptToken(siteData.site.shopifyAccessToken)
        description = (await fetchProductDescription(siteData.site.domain, accessToken, page.shopifyId)) || undefined
      } catch (error) {
        console.warn(`[Content Generate] Could not fetch product description:`, error)
        // Continue without description
      }
    }

    // Generate content using OpenAI
    const generatedContent = await generateContent(
      page.type,
      page.title,
      primary_keyword,
      description
    )

    // Check how many versions already exist for this page
    const existingVersionsCount = await prisma.contentVersion.count({
      where: { pageId: page_id },
    })

    const maxVersionsPerPage = 2
    if (existingVersionsCount >= maxVersionsPerPage) {
      // Get the oldest version to replace
      const oldestVersion = await prisma.contentVersion.findFirst({
        where: { pageId: page_id },
        orderBy: { version: 'asc' },
      })

      if (!oldestVersion) {
        return NextResponse.json(
          { error: 'Unexpected error: No versions found but count indicates versions exist' },
          { status: 500 }
        )
      }

      // Update the oldest version instead of creating a new one
      const updatedVersion = await prisma.contentVersion.update({
        where: { id: oldestVersion.id },
        data: {
          content: generatedContent,
          reason: 'initial_creation',
          publishedAt: null, // Reset publish status when updating
        },
      })

      console.log(`[Content Generate] Updated version ${updatedVersion.version} for page "${page.title}" (max ${maxVersionsPerPage} versions per page)`)

      return NextResponse.json({
        success: true,
        content: generatedContent,
        version: updatedVersion.version,
        pageId: page_id,
        pageTitle: page.title,
        message: `Updated existing version (max ${maxVersionsPerPage} versions per page)`,
      })
    }

    // Get the next version number for this page
    const latestVersion = await prisma.contentVersion.findFirst({
      where: { pageId: page_id },
      orderBy: { version: 'desc' },
      select: { version: true },
    })

    const nextVersion = (latestVersion?.version || 0) + 1

    // Store the content version
    const contentVersion = await prisma.contentVersion.create({
      data: {
        pageId: page_id,
        version: nextVersion,
        content: generatedContent,
        reason: 'initial_creation',
      },
    })

    console.log(`[Content Generate] Created content version ${nextVersion} for page "${page.title}"`)

    return NextResponse.json({
      success: true,
      content: generatedContent,
      version: nextVersion,
      pageId: page_id,
      pageTitle: page.title,
    })
  } catch (error) {
    console.error('[Content Generate] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate content',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
