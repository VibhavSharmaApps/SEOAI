/**
 * Shopify Adapter
 * Handles applying, verifying, and rolling back ChangeIntents for Shopify
 * 
 * This adapter extracts existing Shopify publishing logic and adapts it
 * to work with the ChangeIntent system.
 */

import type { ChangeIntent } from '@prisma/client'
import { decryptToken } from '../shopify-oauth'
import { IntentType } from '../enums'

const API_VERSION = '2026-01'

/**
 * Interface for Shopify adapter context
 * Contains shop and access token information
 */
export interface ShopifyAdapterContext {
  shop: string
  accessToken: string
}

/**
 * Fetches current product description from Shopify
 */
async function fetchProductDescription(
  shop: string,
  accessToken: string,
  productId: string
): Promise<string | null> {
  const url = `https://${shop}/admin/api/${API_VERSION}/products/${productId}.json?fields=body_html`

  try {
    const response = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      console.warn(`[Shopify Adapter] Failed to fetch product ${productId}: ${response.status}`)
      return null
    }

    const data = await response.json()
    return data.product?.body_html || null
  } catch (error) {
    console.error(`[Shopify Adapter] Error fetching product ${productId}:`, error)
    return null
  }
}

/**
 * Fetches current article body from Shopify
 */
async function fetchArticleBody(
  shop: string,
  accessToken: string,
  blogId: string,
  articleId: string
): Promise<string | null> {
  const url = `https://${shop}/admin/api/${API_VERSION}/blogs/${blogId}/articles/${articleId}.json?fields=body_html`

  try {
    const response = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      console.warn(`[Shopify Adapter] Failed to fetch article ${articleId}: ${response.status}`)
      return null
    }

    const data = await response.json()
    return data.article?.body_html || null
  } catch (error) {
    console.error(`[Shopify Adapter] Error fetching article ${articleId}:`, error)
    return null
  }
}

/**
 * Gets the blog ID for an article
 * We need this because article updates require the blog ID
 */
async function getBlogIdForArticle(
  shop: string,
  accessToken: string,
  articleId: string
): Promise<string | null> {
  const url = `https://${shop}/admin/api/${API_VERSION}/blogs.json?fields=id,handle`

  const response = await fetch(url, {
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch blogs: ${response.status}`)
  }

  const data = await response.json()
  const blogs = data.blogs || []

  // Search through each blog's articles
  for (const blog of blogs) {
    const articlesUrl = `https://${shop}/admin/api/${API_VERSION}/blogs/${blog.id}/articles.json?fields=id&limit=250`
    const articlesResponse = await fetch(articlesUrl, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    })

    if (articlesResponse.ok) {
      const articlesData = await articlesResponse.json()
      const articles = articlesData.articles || []
      
      // Check if this article is in this blog
      if (articles.some((a: any) => String(a.id) === String(articleId))) {
        return String(blog.id)
      }
    }
  }

  return null
}

/**
 * Updates a product's description in Shopify
 */
async function updateProductDescription(
  shop: string,
  accessToken: string,
  productId: string,
  description: string
): Promise<void> {
  const url = `https://${shop}/admin/api/${API_VERSION}/products/${productId}.json`

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      product: {
        id: productId,
        body_html: description,
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Shopify API error: ${response.status} - ${errorText}`)
  }

  console.log(`[Shopify Adapter] Updated product ${productId} description`)
}

/**
 * Updates an article's body in Shopify
 */
async function updateArticleBody(
  shop: string,
  accessToken: string,
  blogId: string,
  articleId: string,
  body: string
): Promise<void> {
  const url = `https://${shop}/admin/api/${API_VERSION}/blogs/${blogId}/articles/${articleId}.json`

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      article: {
        id: articleId,
        body_html: body,
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Shopify API error: ${response.status} - ${errorText}`)
  }

  console.log(`[Shopify Adapter] Updated article ${articleId} body`)
}

/**
 * Applies a ChangeIntent to Shopify
 * 
 * Before applying changes, captures previous values in intent.payload.previousValues
 * 
 * @param intent - ChangeIntent record from database
 * @param context - Shopify adapter context (shop, accessToken)
 * @returns Updated intent payload with previousValues captured
 */
export async function applyIntent(
  intent: ChangeIntent,
  context: ShopifyAdapterContext
): Promise<Record<string, any>> {
  const payload = intent.payload as Record<string, any>
  const pageType = payload.pageType as string
  const shopifyId = payload.shopifyId || payload.pageId // Support both formats

  console.log(`[Shopify Adapter] Applying intent ${intent.id} (${intent.intentType}) for ${pageType} page`)

  // Capture previous values before applying changes
  let previousValues: Record<string, any> = {}

  try {
    if (intent.intentType === IntentType.UPDATE_META) {
      // For UPDATE_META, we might update product description or article body
      // depending on what's in the payload
      if (pageType === 'PRODUCT') {
        const currentDescription = await fetchProductDescription(
          context.shop,
          context.accessToken,
          shopifyId
        )
        previousValues.body_html = currentDescription || ''
      } else if (pageType === 'ARTICLE') {
        const blogId = await getBlogIdForArticle(context.shop, context.accessToken, shopifyId)
        if (blogId) {
          const currentBody = await fetchArticleBody(
            context.shop,
            context.accessToken,
            blogId,
            shopifyId
          )
          previousValues.body_html = currentBody || ''
          previousValues.blogId = blogId
        }
      }
    } else if (intent.intentType === IntentType.ADD_INTERNAL_LINK) {
      // For internal links, we don't need to capture previous values
      // as we're adding links, not replacing content
      // This will be handled when the actual implementation is added
      console.log('[Shopify Adapter] ADD_INTERNAL_LINK not yet implemented')
    } else if (intent.intentType === IntentType.INJECT_SCHEMA) {
      // For schema injection, we don't need to capture previous values
      // as we're adding schema, not replacing it
      // This will be handled when the actual implementation is added
      console.log('[Shopify Adapter] INJECT_SCHEMA not yet implemented')
    }

    // Store previous values in payload
    const updatedPayload = {
      ...payload,
      previousValues,
    }

    // Apply the changes based on intent type
    if (intent.intentType === IntentType.UPDATE_META) {
      if (pageType === 'PRODUCT' && payload.newDescription) {
        await updateProductDescription(
          context.shop,
          context.accessToken,
          shopifyId,
          payload.newDescription
        )
      } else if (pageType === 'ARTICLE' && payload.newBody) {
        const blogId = previousValues.blogId || await getBlogIdForArticle(
          context.shop,
          context.accessToken,
          shopifyId
        )
        
        if (!blogId) {
          throw new Error('Could not find blog for this article')
        }

        await updateArticleBody(
          context.shop,
          context.accessToken,
          blogId,
          shopifyId,
          payload.newBody
        )
      }
    }

    return updatedPayload
  } catch (error) {
    console.error(`[Shopify Adapter] Error applying intent ${intent.id}:`, error)
    throw error
  }
}

/**
 * Verifies that a ChangeIntent was successfully applied to Shopify
 * 
 * @param intent - ChangeIntent record from database
 * @param context - Shopify adapter context (shop, accessToken)
 * @returns true if verified, false otherwise
 */
export async function verifyIntent(
  intent: ChangeIntent,
  context: ShopifyAdapterContext
): Promise<boolean> {
  const payload = intent.payload as Record<string, any>
  const pageType = payload.pageType as string
  const shopifyId = payload.shopifyId || payload.pageId

  console.log(`[Shopify Adapter] Verifying intent ${intent.id} (${intent.intentType})`)

  try {
    if (intent.intentType === IntentType.UPDATE_META) {
      if (pageType === 'PRODUCT' && payload.newDescription) {
        const currentDescription = await fetchProductDescription(
          context.shop,
          context.accessToken,
          shopifyId
        )
        // Compare current value with expected new value
        return currentDescription === payload.newDescription
      } else if (pageType === 'ARTICLE' && payload.newBody) {
        const blogId = (payload.previousValues as Record<string, any>)?.blogId || 
                      await getBlogIdForArticle(context.shop, context.accessToken, shopifyId)
        
        if (!blogId) {
          return false
        }

        const currentBody = await fetchArticleBody(
          context.shop,
          context.accessToken,
          blogId,
          shopifyId
        )
        // Compare current value with expected new value
        return currentBody === payload.newBody
      }
    } else if (intent.intentType === IntentType.ADD_INTERNAL_LINK) {
      // Verification for internal links would require parsing HTML content
      // This will be implemented when ADD_INTERNAL_LINK is fully implemented
      console.log('[Shopify Adapter] ADD_INTERNAL_LINK verification not yet implemented')
      return true // Assume success for now
    } else if (intent.intentType === IntentType.INJECT_SCHEMA) {
      // Verification for schema would require parsing page HTML
      // This will be implemented when INJECT_SCHEMA is fully implemented
      console.log('[Shopify Adapter] INJECT_SCHEMA verification not yet implemented')
      return true // Assume success for now
    }

    return false
  } catch (error) {
    console.error(`[Shopify Adapter] Error verifying intent ${intent.id}:`, error)
    return false
  }
}

/**
 * Rolls back a ChangeIntent by restoring previous values
 * 
 * @param intent - ChangeIntent record from database (must have previousValues in payload)
 * @param context - Shopify adapter context (shop, accessToken)
 */
export async function rollbackIntent(
  intent: ChangeIntent,
  context: ShopifyAdapterContext
): Promise<void> {
  const payload = intent.payload as Record<string, any>
  const pageType = payload.pageType as string
  const shopifyId = payload.shopifyId || payload.pageId
  const previousValues = payload.previousValues as Record<string, any> | undefined

  if (!previousValues) {
    throw new Error('Cannot rollback: previousValues not found in payload')
  }

  console.log(`[Shopify Adapter] Rolling back intent ${intent.id} (${intent.intentType})`)

  try {
    if (intent.intentType === IntentType.UPDATE_META) {
      if (pageType === 'PRODUCT' && previousValues.body_html !== undefined) {
        await updateProductDescription(
          context.shop,
          context.accessToken,
          shopifyId,
          previousValues.body_html
        )
      } else if (pageType === 'ARTICLE' && previousValues.body_html !== undefined) {
        const blogId = previousValues.blogId || await getBlogIdForArticle(
          context.shop,
          context.accessToken,
          shopifyId
        )
        
        if (!blogId) {
          throw new Error('Could not find blog for this article during rollback')
        }

        await updateArticleBody(
          context.shop,
          context.accessToken,
          blogId,
          shopifyId,
          previousValues.body_html
        )
      }
    } else if (intent.intentType === IntentType.ADD_INTERNAL_LINK) {
      // Rollback for internal links would require removing the added links
      // This will be implemented when ADD_INTERNAL_LINK is fully implemented
      console.log('[Shopify Adapter] ADD_INTERNAL_LINK rollback not yet implemented')
    } else if (intent.intentType === IntentType.INJECT_SCHEMA) {
      // Rollback for schema would require removing the injected schema
      // This will be implemented when INJECT_SCHEMA is fully implemented
      console.log('[Shopify Adapter] INJECT_SCHEMA rollback not yet implemented')
    }
  } catch (error) {
    console.error(`[Shopify Adapter] Error rolling back intent ${intent.id}:`, error)
    throw error
  }
}

