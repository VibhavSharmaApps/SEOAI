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
 * 1. Verifies Shopify session token
 * 2. Loads all Pages for the authenticated Site
 * 3. Detects site.cmsType (SHOPIFY or WORDPRESS)
 * 4. Runs meta, internal link, and schema rule functions
 * 5. Stores generated ChangeIntents in the database
 * 6. Routes ChangeIntents to the correct adapter based on cmsType
 * 7. Applies each intent using the appropriate adapter
 * 8. Updates intent status and appliedAt
 * 9. Returns counts per intent type
 * 
 * Note: All CMS-specific logic is contained within adapters.
 * The orchestrator only routes to the correct adapter based on cmsType.
 */
export async function POST(request: Request) {
  try {
    // 1. Verify Shopify session token and get site
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

    // 2. Load all Pages for the authenticated Site with changeIntents relation
    const pages = await prisma.page.findMany({
      where: { siteId: siteData.site.id },
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

    console.log(`[SEO Run] Processing ${pages.length} pages for site ${siteData.site.id}`)

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
          siteId: siteData.site.id,
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
          siteId: siteData.site.id,
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
          siteId: siteData.site.id,
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
    // Load full site to get cmsType
    const fullSite = await prisma.site.findUnique({
      where: { id: siteData.site.id },
      select: { cmsType: true },
    })

    if (!fullSite) {
      return NextResponse.json(
        { error: 'Site not found' },
        { status: 404 }
      )
    }

    const cmsType = fullSite.cmsType

    // Create adapter context and function based on CMS type
    // Use a wrapper function to handle type differences
    let applyIntentFunction: (intent: any) => Promise<Record<string, any>>

    if (cmsType === 'SHOPIFY') {
      const decryptedToken = decryptToken(siteData.site.shopifyAccessToken)
      const adapterContext: ShopifyAdapterContext = {
        shop: siteData.site.domain,
        accessToken: decryptedToken,
      }
      applyIntentFunction = (intent) => applyShopifyIntent(intent, adapterContext)
      console.log(`[SEO Run] Using Shopify adapter for site ${siteData.site.id}`)
    } else if (cmsType === 'WORDPRESS') {
      // TODO: Get WordPress credentials from site or environment
      // For now, this will need to be configured per site
      // WordPress sites need: siteUrl, username, applicationPassword
      return NextResponse.json(
        { error: 'WordPress adapter context not yet configured. WordPress credentials must be stored in Site model.' },
        { status: 400 }
      )
      
      // Example (commented out until WordPress credentials are stored):
      // const adapterContext: WordPressAdapterContext = {
      //   siteUrl: site.wordpressSiteUrl || '',
      //   username: site.wordpressUsername || '',
      //   applicationPassword: decryptToken(site.wordpressApplicationPassword || ''),
      // }
      // applyIntentFunction = (intent) => applyWordPressIntent(intent, adapterContext)
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

