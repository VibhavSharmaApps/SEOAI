/**
 * WordPress Adapter
 * Handles applying, verifying, and rolling back ChangeIntents for WordPress
 * 
 * This adapter will implement WordPress-specific logic for SEO change intents.
 * Currently contains stubbed methods with clear TODOs.
 */

import type { ChangeIntent } from '@prisma/client'
import { IntentType } from '../enums'
import { WordPressApiClient } from '../wordpress-api'

/**
 * Interface for WordPress adapter context
 * Contains site URL, username, and application password
 */
export interface WordPressAdapterContext {
  siteUrl: string
  username: string
  applicationPassword: string
}

/**
 * Applies a ChangeIntent to WordPress
 * 
 * Before applying changes, captures previous values in intent.payload.previousValues
 * 
 * @param intent - ChangeIntent record from database
 * @param context - WordPress adapter context (siteUrl, username, applicationPassword)
 * @returns Updated intent payload with previousValues captured
 * 
 * TODO: Implement WordPress-specific logic:
 * - For UPDATE_META: Update post/page meta tags (title, description) via WordPress REST API
 * - For ADD_INTERNAL_LINK: Add internal links to post/page content via WordPress REST API
 * - For INJECT_SCHEMA: Inject JSON-LD schema markup into post/page content via WordPress REST API
 * - Capture previous values before applying changes (store in payload.previousValues)
 * - Handle WordPress API errors appropriately
 * - Support both posts and pages
 */
export async function applyIntent(
  intent: ChangeIntent,
  context: WordPressAdapterContext
): Promise<Record<string, any>> {
  const payload = intent.payload as Record<string, any>
  const intentType = intent.intentType

  console.log(`[WordPress Adapter] Applying intent ${intent.id} (${intentType})`)

  // Initialize WordPress API client
  const client = new WordPressApiClient({
    siteUrl: context.siteUrl,
    username: context.username,
    applicationPassword: context.applicationPassword,
  })

  // Capture previous values before applying changes
  let previousValues: Record<string, any> = {}

  // Apply changes based on intent type
  switch (intentType) {
    case IntentType.UPDATE_META:
      // Extract WordPress post/page ID from payload
      // The payload should contain wordpressId or postId
      const wordpressId = payload.wordpressId || payload.postId || payload.pageId
      if (!wordpressId) {
        throw new Error('WordPress post/page ID not found in payload')
      }

      const postId = parseInt(String(wordpressId), 10)
      if (isNaN(postId)) {
        throw new Error(`Invalid WordPress post/page ID: ${wordpressId}`)
      }

      // Determine if this is a post or page
      const isPage = payload.pageType === 'PAGE' || payload.isPage === true
      const endpoint = isPage ? 'page' : 'post'

      console.log(`[WordPress Adapter] Fetching current ${endpoint} ${postId} to capture previous values`)

      // Fetch current post/page to capture previous values
      let currentPost
      if (isPage) {
        currentPost = await client.getPage(postId)
      } else {
        currentPost = await client.getPost(postId)
      }

      // Extract current title and meta description
      previousValues.title = currentPost.title?.rendered || ''
      
      // Meta description is typically stored in meta fields
      // Common meta keys: _yoast_wpseo_metadesc, rank_math_description, _wp_meta_description
      // We'll check the meta object if available
      const metaDescription = currentPost.meta?._yoast_wpseo_metadesc || 
                             currentPost.meta?.rank_math_description ||
                             currentPost.meta?._wp_meta_description ||
                             ''
      previousValues.meta_description = metaDescription
      previousValues.meta = currentPost.meta || {}

      console.log(`[WordPress Adapter] Captured previous values: title="${previousValues.title}", meta_description="${previousValues.meta_description}"`)

      // Extract new values from payload
      // The payload should contain newTitle and newMetaDescription from the generateMetaChangeIntent
      const newTitle = payload.newTitle || payload.recommendedTitle
      const newMetaDescription = payload.newMetaDescription || payload.recommendedMetaDescription

      if (!newTitle && !newMetaDescription) {
        throw new Error('No new title or meta description provided in payload')
      }

      // Prepare update data
      const updateData: Record<string, any> = {}
      
      if (newTitle) {
        updateData.title = newTitle
      }

      // Update meta description in meta fields
      // We'll update the most common meta keys
      if (newMetaDescription) {
        updateData.meta = {
          ...previousValues.meta,
          _yoast_wpseo_metadesc: newMetaDescription,
          rank_math_description: newMetaDescription,
          _wp_meta_description: newMetaDescription,
        }
      }

      console.log(`[WordPress Adapter] Updating ${endpoint} ${postId} with new meta values`)

      // Update post/page via WordPress REST API
      let updatedPost
      if (isPage) {
        updatedPost = await client.updatePage(postId, updateData)
      } else {
        updatedPost = await client.updatePost(postId, updateData)
      }

      console.log(`[WordPress Adapter] Successfully updated ${endpoint} ${postId}`)

      // Return updated payload with previous values
      return {
        ...payload,
        previousValues,
        updatedTitle: updatedPost.title?.rendered,
        updatedMetaDescription: newMetaDescription || previousValues.meta_description,
      }

    case IntentType.ADD_INTERNAL_LINK:
      // TODO: Add internal links to post/page content
      // - Fetch current post/page content via WordPress REST API
      // - Parse HTML content
      // - Add internal links at appropriate locations
      // - Update post/page content via WordPress REST API
      // - Store previous content in payload.previousValues
      throw new Error('ADD_INTERNAL_LINK not yet implemented for WordPress')

    case IntentType.INJECT_SCHEMA:
      // TODO: Inject JSON-LD schema markup
      // - Fetch current post/page content via WordPress REST API
      // - Parse HTML content
      // - Inject JSON-LD schema script tag into content
      // - Update post/page content via WordPress REST API
      // - Store previous content in payload.previousValues
      throw new Error('INJECT_SCHEMA not yet implemented for WordPress')

    default:
      throw new Error(`Unsupported intent type: ${intentType}`)
  }
}

/**
 * Verifies that a ChangeIntent was successfully applied to WordPress
 * 
 * @param intent - ChangeIntent record from database
 * @param context - WordPress adapter context (siteUrl, username, applicationPassword)
 * @returns true if verified, false otherwise
 * 
 * TODO: Implement WordPress-specific verification:
 * - For UPDATE_META: Fetch post/page and verify meta tags match expected values
 * - For ADD_INTERNAL_LINK: Fetch post/page content and verify internal links exist
 * - For INJECT_SCHEMA: Fetch post/page content and verify schema markup exists
 * - Handle WordPress API errors appropriately
 * - Return false on verification failure
 */
export async function verifyIntent(
  intent: ChangeIntent,
  context: WordPressAdapterContext
): Promise<boolean> {
  const payload = intent.payload as Record<string, any>
  const intentType = intent.intentType

  console.log(`[WordPress Adapter] Verifying intent ${intent.id} (${intentType})`)

  // Initialize WordPress API client
  const client = new WordPressApiClient({
    siteUrl: context.siteUrl,
    username: context.username,
    applicationPassword: context.applicationPassword,
  })

  // Verify changes based on intent type
  switch (intentType) {
    case IntentType.UPDATE_META:
      // Extract WordPress post/page ID from payload
      const wordpressId = payload.wordpressId || payload.postId || payload.pageId
      if (!wordpressId) {
        console.error('[WordPress Adapter] WordPress post/page ID not found in payload')
        return false
      }

      const postId = parseInt(String(wordpressId), 10)
      if (isNaN(postId)) {
        console.error(`[WordPress Adapter] Invalid WordPress post/page ID: ${wordpressId}`)
        return false
      }

      // Determine if this is a post or page
      const isPage = payload.pageType === 'PAGE' || payload.isPage === true

      try {
        // Fetch current post/page to verify changes
        let currentPost
        if (isPage) {
          currentPost = await client.getPage(postId)
        } else {
          currentPost = await client.getPost(postId)
        }

        // Get expected values from payload
        const expectedTitle = payload.newTitle || payload.recommendedTitle || payload.updatedTitle
        const expectedMetaDescription = payload.newMetaDescription || payload.recommendedMetaDescription || payload.updatedMetaDescription

        // Verify title if it was updated
        if (expectedTitle) {
          const currentTitle = currentPost.title?.rendered || ''
          if (currentTitle !== expectedTitle) {
            console.warn(`[WordPress Adapter] Title mismatch. Expected: "${expectedTitle}", Got: "${currentTitle}"`)
            return false
          }
        }

        // Verify meta description if it was updated
        if (expectedMetaDescription) {
          const currentMetaDescription = currentPost.meta?._yoast_wpseo_metadesc || 
                                        currentPost.meta?.rank_math_description ||
                                        currentPost.meta?._wp_meta_description ||
                                        ''
          
          if (currentMetaDescription !== expectedMetaDescription) {
            console.warn(`[WordPress Adapter] Meta description mismatch. Expected: "${expectedMetaDescription}", Got: "${currentMetaDescription}"`)
            return false
          }
        }

        console.log(`[WordPress Adapter] Verification successful for ${isPage ? 'page' : 'post'} ${postId}`)
        return true
      } catch (error) {
        console.error(`[WordPress Adapter] Error verifying intent:`, error)
        return false
      }

    case IntentType.ADD_INTERNAL_LINK:
      // TODO: Verify internal links were added
      // - Fetch post/page content via WordPress REST API
      // - Parse HTML content
      // - Check if expected internal links exist in content
      // - Return true if links found, false otherwise
      console.warn('[WordPress Adapter] ADD_INTERNAL_LINK verification not yet implemented')
      return false

    case IntentType.INJECT_SCHEMA:
      // TODO: Verify schema markup was injected
      // - Fetch post/page content via WordPress REST API
      // - Parse HTML content
      // - Check if JSON-LD schema script tag exists in content
      // - Return true if schema found, false otherwise
      console.warn('[WordPress Adapter] INJECT_SCHEMA verification not yet implemented')
      return false

    default:
      console.error(`[WordPress Adapter] Unsupported intent type: ${intentType}`)
      return false
  }
}

/**
 * Rolls back a ChangeIntent by restoring previous values
 * 
 * @param intent - ChangeIntent record from database (must have previousValues in payload)
 * @param context - WordPress adapter context (siteUrl, username, applicationPassword)
 * 
 * TODO: Implement WordPress-specific rollback:
 * - Extract previousValues from intent.payload
 * - For UPDATE_META: Restore previous meta tags via WordPress REST API
 * - For ADD_INTERNAL_LINK: Remove added internal links from content via WordPress REST API
 * - For INJECT_SCHEMA: Remove injected schema markup from content via WordPress REST API
 * - Handle WordPress API errors appropriately
 * - Throw error if previousValues not found
 */
export async function rollbackIntent(
  intent: ChangeIntent,
  context: WordPressAdapterContext
): Promise<void> {
  const payload = intent.payload as Record<string, any>
  const previousValues = payload.previousValues as Record<string, any> | undefined
  const intentType = intent.intentType

  if (!previousValues) {
    throw new Error('Cannot rollback: previousValues not found in payload')
  }

  console.log(`[WordPress Adapter] Rolling back intent ${intent.id} (${intentType})`)

  // TODO: Implement WordPress API client initialization
  // const client = new WordPressApiClient(context)

  // Initialize WordPress API client
  const client = new WordPressApiClient({
    siteUrl: context.siteUrl,
    username: context.username,
    applicationPassword: context.applicationPassword,
  })

  // Rollback changes based on intent type
  switch (intentType) {
    case IntentType.UPDATE_META:
      // Extract WordPress post/page ID from payload
      const wordpressId = payload.wordpressId || payload.postId || payload.pageId
      if (!wordpressId) {
        throw new Error('WordPress post/page ID not found in payload')
      }

      const postId = parseInt(String(wordpressId), 10)
      if (isNaN(postId)) {
        throw new Error(`Invalid WordPress post/page ID: ${wordpressId}`)
      }

      // Determine if this is a post or page
      const isPage = payload.pageType === 'PAGE' || payload.isPage === true

      // Extract previous values
      const previousTitle = previousValues.title
      const previousMetaDescription = previousValues.meta_description
      const previousMeta = previousValues.meta

      if (previousTitle === undefined && previousMetaDescription === undefined) {
        throw new Error('Previous title and meta description not found in previousValues')
      }

      console.log(`[WordPress Adapter] Rolling back ${isPage ? 'page' : 'post'} ${postId} to previous values`)

      // Prepare rollback data
      const rollbackData: Record<string, any> = {}

      if (previousTitle !== undefined) {
        rollbackData.title = previousTitle
      }

      // Restore previous meta description
      if (previousMetaDescription !== undefined && previousMeta) {
        rollbackData.meta = {
          ...previousMeta,
          _yoast_wpseo_metadesc: previousMetaDescription,
          rank_math_description: previousMetaDescription,
          _wp_meta_description: previousMetaDescription,
        }
      } else if (previousMeta) {
        // If we have previous meta but no description, restore the entire meta object
        rollbackData.meta = previousMeta
      }

      // Update post/page via WordPress REST API with previous values
      if (isPage) {
        await client.updatePage(postId, rollbackData)
      } else {
        await client.updatePost(postId, rollbackData)
      }

      console.log(`[WordPress Adapter] Successfully rolled back ${isPage ? 'page' : 'post'} ${postId}`)
      break

    case IntentType.ADD_INTERNAL_LINK:
      // TODO: Remove added internal links
      // - Extract previous content from previousValues
      // - Update post/page content via WordPress REST API with previous content
      throw new Error('ADD_INTERNAL_LINK rollback not yet implemented for WordPress')

    case IntentType.INJECT_SCHEMA:
      // TODO: Remove injected schema markup
      // - Extract previous content from previousValues
      // - Remove JSON-LD schema script tag from content
      // - Update post/page content via WordPress REST API with cleaned content
      throw new Error('INJECT_SCHEMA rollback not yet implemented for WordPress')

    default:
      throw new Error(`Unsupported intent type: ${intentType}`)
  }
}

