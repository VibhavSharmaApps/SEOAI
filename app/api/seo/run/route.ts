import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/shopify-oauth'
import { getSiteFromSession, ShopifySessionTokenError } from '@/lib/get-site-from-session'
import { generateMetaChangeIntent } from '@/lib/generate-meta-change-intent'
import { generateInternalLinkChangeIntents } from '@/lib/generate-internal-link-change-intents'
import { generateSchemaChangeIntent } from '@/lib/generate-schema-change-intent'
import { applyIntent as applyShopifyIntent, ShopifyAdapterContext } from '@/lib/adapters/shopifyAdapter'
import { applyIntent as applyWordPressIntent, WordPressAdapterContext } from '@/lib/adapters/wordpressAdapter'
import { IntentType, IntentStatus } from '@/lib/enums'
import type { AdapterContext } from '@/lib/adapters/adapter-interface'

// Force dynamic rendering (required for database queries)
export const dynamic = 'force-dynamic'

/**
 * POST /api/seo/run
 * Runs SEO change intent generation and application for all pages
 * 
 * This endpoint:
 * 1. Determines site by CMS type:
 *    - WORDPRESS: Queries database directly (no auth required)
 *    - SHOPIFY: Verifies Shopify session token (auth required)
 * 2. Loads all Pages for the Site
 * 3. Runs meta, internal link, and schema rule functions
 * 4. Stores generated ChangeIntents in the database
 * 5. Routes ChangeIntents to the correct adapter based on cmsType
 * 6. Applies each intent using the appropriate adapter
 * 7. Updates intent status and appliedAt
 * 8. Returns counts per intent type
 * 
 * Note: All CMS-specific logic is contained within adapters.
 * The orchestrator only routes to the correct adapter based on cmsType.
 */
export async function POST(request: Request) {
  try {
    // 1. Determine site by CMS type
    // First, check if there's an active WordPress site (no auth required)
    let site: {
      id: string
      domain: string
      shopifyStoreUrl: string
      shopifyAccessToken: string | null
      cmsType: 'SHOPIFY' | 'WORDPRESS'
      isActive: boolean
      name: string | null
    } | null = null

    const wordPressSite = await prisma.site.findFirst({
      where: {
        cmsType: 'WORDPRESS',
        isActive: true,
      },
      select: {
        id: true,
        domain: true,
        shopifyStoreUrl: true, // Stores WordPress site URL
        shopifyAccessToken: true, // Stores encrypted WordPress application password
        cmsType: true,
        isActive: true,
        name: true, // Stores WordPress username
      },
    })

    if (wordPressSite) {
      // WordPress site found - use it without Shopify auth
      site = {
        id: wordPressSite.id,
        domain: wordPressSite.domain,
        shopifyStoreUrl: wordPressSite.shopifyStoreUrl,
        shopifyAccessToken: wordPressSite.shopifyAccessToken,
        cmsType: wordPressSite.cmsType,
        isActive: wordPressSite.isActive,
        name: wordPressSite.name,
      }
      console.log(`[SEO Run] WordPress site found: ${site.id}, skipping Shopify auth`)
    } else {
      // No WordPress site found - use Shopify auth (existing logic)
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
      site = {
        id: siteData.site.id,
        domain: siteData.site.domain,
        shopifyStoreUrl: siteData.site.shopifyStoreUrl,
        shopifyAccessToken: siteData.site.shopifyAccessToken,
        cmsType: siteData.site.cmsType,
        isActive: siteData.site.isActive,
        name: null,
      }
      console.log(`[SEO Run] Shopify site found: ${site.id}, using Shopify auth`)
    }

    if (!site) {
      return NextResponse.json(
        { error: 'No active site found' },
        { status: 404 }
      )
    }

    // 2. Load all Pages for the Site with changeIntents relation
    const pages = await prisma.page.findMany({
      where: { siteId: site.id },
      include: {
        changeIntents: {
          select: {
            intentType: true,
            status: true,
          },
        },
      },
    })

    if (pages.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pages found for this site',
        counts: {
          UPDATE_META: 0,
          ADD_INTERNAL_LINK: 0,
          INJECT_SCHEMA: 0,
        },
        applied: {
          UPDATE_META: 0,
          ADD_INTERNAL_LINK: 0,
          INJECT_SCHEMA: 0,
        },
        failed: {
          UPDATE_META: 0,
          ADD_INTERNAL_LINK: 0,
          INJECT_SCHEMA: 0,
        },
      })
    }

    console.log(`[SEO Run] Processing ${pages.length} pages for site ${site.id}`)

    // 3. Run meta, internal link, and schema rule functions

    // Generate meta change intents (one per page)
    const metaIntents: Array<{ page: typeof pages[0]; intent: NonNullable<ReturnType<typeof generateMetaChangeIntent>> }> = []
    for (const page of pages) {
      const intent = generateMetaChangeIntent(page)
      if (intent) {
        metaIntents.push({ page, intent })
      }
    }

    // Build map of existing internal link intents for generateInternalLinkChangeIntents
    const existingIntentsMap = new Map<string, number>()
    for (const page of pages) {
      const internalLinkCount = page.changeIntents.filter(
        (ci) => ci.intentType === 'ADD_INTERNAL_LINK'
      ).length
      existingIntentsMap.set(page.id, internalLinkCount)
    }

    // Generate internal link change intents (for ARTICLE pages only)
    const internalLinkIntents = generateInternalLinkChangeIntents(pages, existingIntentsMap)

    // Generate schema change intents (one per page)
    const schemaIntents: Array<{ page: typeof pages[0]; intent: NonNullable<ReturnType<typeof generateSchemaChangeIntent>> }> = []
    for (const page of pages) {
      const intent = generateSchemaChangeIntent(page)
      if (intent) {
        schemaIntents.push({ page, intent })
      }
    }

    console.log(`[SEO Run] Generated intents: ${metaIntents.length} meta, ${internalLinkIntents.length} internal links, ${schemaIntents.length} schema`)

    // 4. Store generated ChangeIntents in the database
    const createdIntents: Array<{ id: string; intentType: string; pageId: string }> = []

    // Store meta intents
    for (const { page, intent } of metaIntents) {
      const created = await prisma.changeIntent.create({
        data: {
          siteId: site.id,
          pageId: page.id,
          intentType: IntentType.UPDATE_META,
          payload: intent.payload,
          status: IntentStatus.PENDING,
        },
      })
      createdIntents.push({
        id: created.id,
        intentType: IntentType.UPDATE_META,
        pageId: page.id,
      })
    }

    // Store internal link intents
    for (const intent of internalLinkIntents) {
      const created = await prisma.changeIntent.create({
        data: {
          siteId: site.id,
          pageId: intent.payload.pageId,
          intentType: IntentType.ADD_INTERNAL_LINK,
          payload: intent.payload,
          status: IntentStatus.PENDING,
        },
      })
      createdIntents.push({
        id: created.id,
        intentType: IntentType.ADD_INTERNAL_LINK,
        pageId: intent.payload.pageId,
      })
    }

    // Store schema intents
    for (const { page, intent } of schemaIntents) {
      const created = await prisma.changeIntent.create({
        data: {
          siteId: site.id,
          pageId: page.id,
          intentType: IntentType.INJECT_SCHEMA,
          payload: intent.payload,
          status: IntentStatus.PENDING,
        },
      })
      createdIntents.push({
        id: created.id,
        intentType: IntentType.INJECT_SCHEMA,
        pageId: page.id,
      })
    }

    console.log(`[SEO Run] Stored ${createdIntents.length} change intents in database`)

    // 5. Apply each intent using the correct adapter based on CMS type
    const cmsType = site.cmsType

    // Create adapter context and function based on CMS type
    let applyIntentFunction: (intent: any) => Promise<Record<string, any>>

    if (cmsType === 'SHOPIFY') {
      // Shopify mode: Use Shopify auth and credentials
      if (!site.shopifyAccessToken) {
        return NextResponse.json(
          { error: 'Shopify access token not found for this shop' },
          { status: 400 }
        )
      }
      const decryptedToken = decryptToken(site.shopifyAccessToken)
      const adapterContext: ShopifyAdapterContext = {
        shop: site.domain,
        accessToken: decryptedToken,
      }
      applyIntentFunction = (intent) => applyShopifyIntent(intent, adapterContext)
      console.log(`[SEO Run] Using Shopify adapter for site ${site.id}`)
    } else if (cmsType === 'WORDPRESS') {
      // WordPress mode: Use stored WordPress credentials (no Shopify auth)
      if (!site.shopifyAccessToken || !site.shopifyStoreUrl || !site.name) {
        return NextResponse.json(
          { error: 'WordPress credentials not found. Please connect your WordPress site first.' },
          { status: 400 }
        )
      }
      // Decrypt WordPress application password (stored in shopifyAccessToken field)
      const decryptedPassword = decryptToken(site.shopifyAccessToken)
      // WordPress site URL is stored in shopifyStoreUrl field
      // WordPress username is stored in name field
      const adapterContext: WordPressAdapterContext = {
        siteUrl: site.shopifyStoreUrl,
        username: site.name,
        applicationPassword: decryptedPassword,
      }
      applyIntentFunction = (intent) => applyWordPressIntent(intent, adapterContext)
      console.log(`[SEO Run] Using WordPress adapter for site ${site.id}`)
    } else {
      return NextResponse.json(
        { error: `Unsupported CMS type: ${cmsType}` },
        { status: 400 }
      )
    }

    const appliedCounts = {
      UPDATE_META: 0,
      ADD_INTERNAL_LINK: 0,
      INJECT_SCHEMA: 0,
    }

    const failedCounts = {
      UPDATE_META: 0,
      ADD_INTERNAL_LINK: 0,
      INJECT_SCHEMA: 0,
    }

    // Apply each intent
    for (const createdIntent of createdIntents) {
      try {
        // Fetch the full intent from database
        const intent = await prisma.changeIntent.findUnique({
          where: { id: createdIntent.id },
        })

        if (!intent) {
          console.error(`[SEO Run] Intent ${createdIntent.id} not found after creation`)
          failedCounts[createdIntent.intentType as keyof typeof failedCounts]++
          continue
        }

        // Apply the intent using the correct adapter (this captures previous values and applies changes)
        const updatedPayload = await applyIntentFunction(intent)

        // Update intent with new payload (includes previousValues) and mark as applied
        await prisma.changeIntent.update({
          where: { id: intent.id },
          data: {
            payload: updatedPayload,
            status: IntentStatus.APPLIED,
            appliedAt: new Date(),
          },
        })

        appliedCounts[createdIntent.intentType as keyof typeof appliedCounts]++
        console.log(`[SEO Run] Applied intent ${intent.id} (${intent.intentType})`)
      } catch (error) {
        console.error(`[SEO Run] Failed to apply intent ${createdIntent.id}:`, error)
        
        // Mark intent as failed
        await prisma.changeIntent.update({
          where: { id: createdIntent.id },
          data: {
            status: IntentStatus.FAILED,
          },
        })

        failedCounts[createdIntent.intentType as keyof typeof failedCounts]++
      }
    }

    // 7. Return counts per intent type
    const counts = {
      UPDATE_META: metaIntents.length,
      ADD_INTERNAL_LINK: internalLinkIntents.length,
      INJECT_SCHEMA: schemaIntents.length,
    }

    console.log(`[SEO Run] Completed. Generated: ${JSON.stringify(counts)}, Applied: ${JSON.stringify(appliedCounts)}, Failed: ${JSON.stringify(failedCounts)}`)

    return NextResponse.json({
      success: true,
      message: 'SEO run completed',
      counts,
      applied: appliedCounts,
      failed: failedCounts,
      totalPages: pages.length,
    })
  } catch (error) {
    console.error('[SEO Run] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to run SEO changes',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

