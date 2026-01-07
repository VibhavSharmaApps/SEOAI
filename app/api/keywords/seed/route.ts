import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/shopify-oauth'
import { fetchProductDescription } from '@/lib/shopify-product-details'
import { generateKeywords } from '@/lib/openai'

/**
 * POST /api/keywords/seed
 * Generates and seeds keywords for all product and collection pages
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

    if (!site.shopifyAccessToken) {
      return NextResponse.json(
        { error: 'Shopify access token not found' },
        { status: 400 }
      )
    }

    // Decrypt access token
    const accessToken = decryptToken(site.shopifyAccessToken)
    const shop = site.domain

    console.log(`[Keywords Seed] Starting keyword generation for shop: ${shop}`)

    // Fetch all product and collection pages
    const pages = await prisma.page.findMany({
      where: {
        siteId: site.id,
        type: {
          in: ['PRODUCT', 'COLLECTION'],
        },
      },
    })

    console.log(`[Keywords Seed] Found ${pages.length} pages to process`)

    let totalKeywordsCreated = 0

    // Process pages in batches to avoid rate limits
    for (const page of pages) {
      try {
        // Get product description if it's a product
        let description: string | undefined
        if (page.type === 'PRODUCT') {
          description = (await fetchProductDescription(shop, accessToken, page.shopifyId)) || undefined
        }

        // Generate keywords using LLM
        const keywordPhrases = await generateKeywords(page.title, description)

        console.log(`[Keywords Seed] Generated ${keywordPhrases.length} keywords for ${page.type}: ${page.title}`)

        // Store keywords (idempotent - skip if already exists)
        for (const keywordPhrase of keywordPhrases) {
          if (!keywordPhrase.trim()) continue

          const source = `${page.type.toLowerCase()}:${page.shopifyId}`

          try {
            await prisma.keyword.create({
              data: {
                siteId: site.id,
                keyword: keywordPhrase.trim(),
                source,
              },
            })
            totalKeywordsCreated++
          } catch (error: any) {
            // Skip if keyword already exists (unique constraint)
            if (error.code === 'P2002') {
              console.log(`[Keywords Seed] Keyword already exists: ${keywordPhrase}`)
              continue
            }
            throw error
          }
        }

        // Small delay to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 100))
      } catch (error) {
        console.error(`[Keywords Seed] Error processing page ${page.id}:`, error)
        // Continue with next page
        continue
      }
    }

    console.log(`[Keywords Seed] Complete. Created ${totalKeywordsCreated} keywords`)

    return NextResponse.json({
      success: true,
      message: 'Keywords seeded successfully',
      pagesProcessed: pages.length,
      keywordsCreated: totalKeywordsCreated,
    })
  } catch (error) {
    console.error('[Keywords Seed] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to seed keywords',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

