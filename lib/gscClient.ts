/**
 * @deprecated This file uses Clerk authentication and is no longer used.
 * 
 * All GSC routes now use `getSiteFromSessionWithGSC()` from `lib/get-site-from-session-gsc.ts`
 * which uses Shopify session tokens instead of Clerk.
 * 
 * This file is kept for reference but should not be used in new code.
 * Functions here can be refactored to accept a site parameter instead of using Clerk.
 */

import { auth } from '@clerk/nextjs/server'
import { prisma } from './prisma'
import { decryptToken } from './shopify-oauth'
import { GSCAuthRequiredError, GSCApiError } from './gsc-errors'

// Re-export errors for convenience
export { GSCAuthRequiredError, GSCApiError } from './gsc-errors'

const GSC_API_BASE = 'https://www.googleapis.com/webmasters/v3'

export interface GSCProperty {
  siteUrl: string
  permissionLevel: string
}

/**
 * @deprecated Use getSiteFromSessionWithGSC() instead
 * Gets the authenticated Google OAuth token for the current user's site
 * Throws GSCAuthRequiredError if token is missing or expired
 */
async function getGoogleOAuthToken(): Promise<string> {
  const { userId } = await auth()

  if (!userId) {
    throw new GSCAuthRequiredError('User not authenticated')
  }

  // Get user and their site
  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: { sites: true },
  })

  if (!user) {
    throw new GSCAuthRequiredError('User not found')
  }

  const site = user.sites[0]

  if (!site) {
    throw new GSCAuthRequiredError('No site connected')
  }

  if (!site.googleOAuthToken) {
    throw new GSCAuthRequiredError('Google OAuth token not found. Please authenticate with Google Search Console.')
  }

  try {
    // Decrypt the token (using same encryption as Shopify tokens)
    const accessToken = decryptToken(site.googleOAuthToken)

    // Verify token is still valid by making a test request
    // If token is expired, we could try refreshing it here
    // For now, we'll let the API call fail and handle it there
    return accessToken
  } catch (error) {
    if (error instanceof Error && error.message.includes('Invalid key length')) {
      throw new GSCAuthRequiredError('Google OAuth token encryption key is invalid')
    }
    throw new GSCAuthRequiredError(`Failed to decrypt Google OAuth token: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * @deprecated Use getSiteFromSessionWithGSC() instead
 * Makes an authenticated request to Google Search Console API
 */
async function gscRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const accessToken = await getGoogleOAuthToken()

  const url = `${GSC_API_BASE}${endpoint}`

  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  // Handle 401 Unauthorized (expired/revoked token)
  if (response.status === 401) {
    throw new GSCApiError(
      'Google OAuth token has expired or been revoked. Please re-authenticate.',
      response.status,
      await response.text().catch(() => '')
    )
  }

  // Handle 403 Forbidden (access revoked)
  if (response.status === 403) {
    throw new GSCApiError(
      'Google Search Console access has been revoked. Please re-authenticate.',
      response.status,
      await response.text().catch(() => '')
    )
  }

  // Handle other API errors
  if (!response.ok) {
    const errorText = await response.text()
    throw new GSCApiError(
      `Google Search Console API error: ${response.status} - ${errorText}`,
      response.status,
      errorText
    )
  }

  return response
}

/**
 * @deprecated Refactor to accept site parameter instead of using Clerk
 * Lists all verified Google Search Console properties for the authenticated user
 * Returns array of site URLs that the user has access to
 */
export async function listGSCProperties(): Promise<GSCProperty[]> {
  try {
    const response = await gscRequest('/sites')
    const data = await response.json()

    const sites = data.siteEntry || []

    return sites.map((site: any) => ({
      siteUrl: site.siteUrl,
      permissionLevel: site.permissionLevel || 'unknown',
    }))
  } catch (error) {
    // Re-throw GSC-specific errors as-is
    if (error instanceof GSCAuthRequiredError || error instanceof GSCApiError) {
      throw error
    }

    // Wrap unexpected errors
    throw new GSCApiError(
      `Failed to list GSC properties: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * @deprecated Refactor to accept site parameter instead of using Clerk
 * Verifies if a site URL is accessible in Google Search Console
 */
export async function verifyGSCProperty(siteUrl: string): Promise<boolean> {
  try {
    const properties = await listGSCProperties()
    return properties.some((prop) => prop.siteUrl === siteUrl)
  } catch (error) {
    if (error instanceof GSCAuthRequiredError) {
      throw error
    }
    return false
  }
}

/**
 * @deprecated Use getSiteFromSessionWithGSC() instead
 * Gets the authenticated GSC client instance
 * This is a convenience function that returns the access token
 */
export async function getGSCClient(): Promise<{ accessToken: string }> {
  const accessToken = await getGoogleOAuthToken()
  return { accessToken }
}
