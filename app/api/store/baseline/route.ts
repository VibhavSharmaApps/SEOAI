import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/shopify-oauth'
import { getSiteFromSession, ShopifySessionTokenError } from '@/lib/get-site-from-session'
import {
  fetchShopifyProducts,
  fetchShopifyCollections,
  fetchShopifyArticles,
} from '@/lib/shopify-api'

// Force dynamic rendering (required for database queries)
export const dynamic = 'force-dynamic'

/**
 * POST /api/store/baseline
 * Fetches baseline data from Shopify and stores it in the database
 * Idempotent: Safe to re-run multiple times
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

    // Site already verified and retrieved in getSiteFromSession()

    // Decrypt access token (site is already validated in getSiteFromSession)
    const accessToken = decryptToken(siteData.site.shopifyAccessToken)
    const shop = siteData.site.domain

    console.log(`[Baseline] Starting baseline sync for shop: ${shop}`)

    // Fetch all data from Shopify
    let products, collections, articles
    try {
      [products, collections, articles] =
        await Promise.all([
          fetchShopifyProducts(shop, accessToken),
          fetchShopifyCollections(shop, accessToken),
          fetchShopifyArticles(shop, accessToken),
        ])
    } catch (shopifyError) {
      console.error('[Baseline] Shopify API error:', shopifyError)
      return NextResponse.json(
        {
          error: 'Failed to fetch data from Shopify',
          message: shopifyError instanceof Error ? shopifyError.message : 'Unknown error',
        },
        { status: 500 }
      )
    }

    console.log(
      `[Baseline] Fetched: ${products.length} products, ${collections.length} collections, ${articles.length} articles`
    )

    let productCount = 0
    let collectionCount = 0
    let articleCount = 0

    // Store products (idempotent upsert)
    try {
      for (const product of products) {
        const url = `https://${shop}/products/${product.handle}`
        const updatedAt = product.updated_at ? new Date(product.updated_at) : new Date()

        await prisma.page.upsert({
          where: {
            siteId_shopifyId_type: {
              siteId: siteData.site.id,
              shopifyId: product.id.toString(),
              type: 'PRODUCT',
            },
          },
          update: {
            title: product.title,
            url,
            lastUpdated: updatedAt,
          },
          create: {
            siteId: siteData.site.id,
            shopifyId: product.id.toString(),
            type: 'PRODUCT',
            title: product.title,
            url,
            lastUpdated: updatedAt,
          },
        })
        productCount++
      }
    } catch (dbError) {
      console.error('[Baseline] Error storing products:', dbError)
      throw new Error(`Failed to store products in database: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`)
    }

    // Store collections (idempotent upsert)
    try {
      for (const collection of collections) {
        const url = `https://${shop}/collections/${collection.handle}`
        // Collections don't have updated_at in the API response, use current date
        const updatedAt = new Date()

        await prisma.page.upsert({
          where: {
            siteId_shopifyId_type: {
              siteId: siteData.site.id,
              shopifyId: collection.id.toString(),
              type: 'COLLECTION',
            },
          },
          update: {
            title: collection.title,
            url,
            lastUpdated: updatedAt,
          },
          create: {
            siteId: siteData.site.id,
            shopifyId: collection.id.toString(),
            type: 'COLLECTION',
            title: collection.title,
            url,
            lastUpdated: updatedAt,
          },
        })
        collectionCount++
      }
    } catch (dbError) {
      console.error('[Baseline] Error storing collections:', dbError)
      throw new Error(`Failed to store collections in database: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`)
    }

    // Store articles (idempotent upsert)
    try {
      for (const article of articles) {
        // Construct URL using blog handle and article handle
        const url = `https://${shop}/blogs/${article.blog_handle}/${article.handle}`
        const publishedAt = article.published_at ? new Date(article.published_at) : new Date()

        await prisma.page.upsert({
          where: {
            siteId_shopifyId_type: {
              siteId: siteData.site.id,
              shopifyId: article.id.toString(),
              type: 'ARTICLE',
            },
          },
          update: {
            title: article.title,
            url,
            lastUpdated: publishedAt,
          },
          create: {
            siteId: siteData.site.id,
            shopifyId: article.id.toString(),
            type: 'ARTICLE',
            title: article.title,
            url,
            lastUpdated: publishedAt,
          },
        })
        articleCount++
      }
    } catch (dbError) {
      console.error('[Baseline] Error storing articles:', dbError)
      throw new Error(`Failed to store articles in database: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`)
    }

    // Get counts from database
    const counts = {
      PRODUCT: await prisma.page.count({
        where: { siteId: siteData.site.id, type: 'PRODUCT' },
      }),
      COLLECTION: await prisma.page.count({
        where: { siteId: siteData.site.id, type: 'COLLECTION' },
      }),
      ARTICLE: await prisma.page.count({
        where: { siteId: siteData.site.id, type: 'ARTICLE' },
      }),
    }

    console.log(`[Baseline] Sync complete. Counts:`, counts)

    return NextResponse.json({
      success: true,
      message: 'Baseline data synced successfully',
      synced: {
        products: productCount,
        collections: collectionCount,
        articles: articleCount,
      },
      stored: counts,
      total: counts.PRODUCT + counts.COLLECTION + counts.ARTICLE,
    })
  } catch (error) {
    console.error('[Baseline] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to sync baseline data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
