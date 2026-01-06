import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/shopify-oauth'
import {
  fetchShopifyProducts,
  fetchShopifyCollections,
  fetchShopifyArticles,
} from '@/lib/shopify-api'

/**
 * POST /api/store/baseline
 * Fetches baseline data from Shopify and stores it in the database
 * Idempotent: Safe to re-run multiple times
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

    console.log(`[Baseline] Starting baseline sync for shop: ${shop}`)

    // Fetch all data from Shopify
    let products, collections, articles
    try {
      [products, collections, articles] = await Promise.all([
        fetchShopifyProducts(shop, accessToken),
        fetchShopifyCollections(shop, accessToken),
        fetchShopifyArticles(shop, accessToken),
      ])
      console.log(`[Baseline] Fetched: ${products.length} products, ${collections.length} collections, ${articles.length} articles`)
    } catch (fetchError) {
      console.error('[Baseline] Error fetching from Shopify:', fetchError)
      throw new Error(`Failed to fetch data from Shopify: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`)
    }

    // Store products (idempotent upsert)
    let productCount = 0
    try {
      for (const product of products) {
        const url = `https://${shop}/products/${product.handle}`
        await prisma.page.upsert({
        where: {
          siteId_shopifyId_type: {
            siteId: site.id,
            shopifyId: product.id,
            type: 'PRODUCT',
          },
        },
        update: {
          title: product.title,
          url,
          lastUpdated: new Date(product.updated_at),
        },
        create: {
          siteId: site.id,
          shopifyId: product.id,
          type: 'PRODUCT',
          title: product.title,
          url,
          lastUpdated: new Date(product.updated_at),
        },
        })
        productCount++
      }
    } catch (dbError) {
      console.error('[Baseline] Error storing products:', dbError)
      throw new Error(`Failed to store products in database: ${dbError instanceof Error ? dbError.message : 'Unknown error'}. Make sure you've run: npm run db:migrate`)
    }

    // Store collections (idempotent upsert)
    let collectionCount = 0
    try {
      for (const collection of collections) {
      const url = `https://${shop}/collections/${collection.handle}`
      await prisma.page.upsert({
        where: {
          siteId_shopifyId_type: {
            siteId: site.id,
            shopifyId: collection.id,
            type: 'COLLECTION',
          },
        },
        update: {
          title: collection.title,
          url,
          lastUpdated: new Date(), // Collections don't have updated_at in basic API
        },
        create: {
          siteId: site.id,
          shopifyId: collection.id,
          type: 'COLLECTION',
          title: collection.title,
          url,
          lastUpdated: new Date(),
        },
        })
        collectionCount++
      }
    } catch (dbError) {
      console.error('[Baseline] Error storing collections:', dbError)
      throw new Error(`Failed to store collections in database: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`)
    }

    // Store articles (idempotent upsert)
    let articleCount = 0
    try {
      for (const article of articles) {
      // Construct URL using blog handle and article handle
      const url = `https://${shop}/blogs/${article.blog_handle}/${article.handle}`
      const publishedAt = article.published_at ? new Date(article.published_at) : new Date()

      await prisma.page.upsert({
        where: {
          siteId_shopifyId_type: {
            siteId: site.id,
            shopifyId: article.id,
            type: 'ARTICLE',
          },
        },
        update: {
          title: article.title,
          url,
          lastUpdated: publishedAt,
        },
        create: {
          siteId: site.id,
          shopifyId: article.id,
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
        where: { siteId: site.id, type: 'PRODUCT' },
      }),
      COLLECTION: await prisma.page.count({
        where: { siteId: site.id, type: 'COLLECTION' },
      }),
      ARTICLE: await prisma.page.count({
        where: { siteId: site.id, type: 'ARTICLE' },
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

