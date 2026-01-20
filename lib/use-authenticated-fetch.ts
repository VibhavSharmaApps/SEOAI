'use client'

import { useCallback } from 'react'
import { getSessionToken } from '@shopify/app-bridge/utilities'

/**
 * Hook that returns an authenticated fetch function
 * Automatically retrieves fresh Shopify session token before each request
 * and attaches it as Bearer token in Authorization header
 * 
 * Usage:
 * ```tsx
 * const fetchWithAuth = useAuthenticatedFetch()
 * const response = await fetchWithAuth('/api/my-endpoint', { method: 'POST' })
 * ```
 */
export function useAuthenticatedFetch() {
  // Get App Bridge instance from window (set by Provider when initialized)
  // This avoids calling useAppBridge() hook which requires Provider to be rendered
  const getAppBridgeInstance = useCallback(() => {
    if (typeof window === 'undefined') return null
    // App Bridge instance stored on window by ShopifyAppBridgeProvider
    const app = (window as any).shopify?.app
    if (!app) {
      console.warn('[Authenticated Fetch] App Bridge instance not found on window.shopify.app')
      console.warn('[Authenticated Fetch] Available on window:', Object.keys(window).filter(k => k.includes('shopify')))
    }
    return app || null
  }, [])

  const fetchWithAuth = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      // Get fresh session token for each request
      let sessionToken: string | null = null
      
      try {
        const app = getAppBridgeInstance()
        if (!app) {
          const errorMsg = 'App Bridge not initialized. Please ensure you are accessing the app from Shopify Admin with the host parameter.'
          console.error('[Authenticated Fetch]', errorMsg)
          throw new Error(errorMsg)
        }

        console.log('[Authenticated Fetch] Getting session token from App Bridge instance...')
        // Use App Bridge utility to get session token
        sessionToken = await getSessionToken(app)
        
        if (!sessionToken) {
          const errorMsg = 'Failed to retrieve session token. Please refresh the page.'
          console.error('[Authenticated Fetch]', errorMsg)
          throw new Error(errorMsg)
        }
        
        console.log('[Authenticated Fetch] Session token retrieved successfully (length:', sessionToken.length, ')')
      } catch (error) {
        console.error('[Authenticated Fetch] Error getting session token:', error)
        // Re-throw to prevent making unauthenticated requests
        throw error
      }

      // Merge headers with Authorization token
      const headers = new Headers(init?.headers)
      
      // Add Authorization header with session token if available
      if (sessionToken) {
        headers.set('Authorization', `Bearer ${sessionToken}`)
      }

      // Merge any existing Authorization header (session token takes precedence)
      if (init?.headers && !headers.has('Authorization')) {
        if (init.headers instanceof Headers) {
          const existingAuth = init.headers.get('Authorization')
          if (existingAuth) {
            headers.set('Authorization', existingAuth)
          }
        } else if (Array.isArray(init.headers)) {
          const existingAuth = init.headers.find(([key]) => key.toLowerCase() === 'authorization')
          if (existingAuth) {
            headers.set('Authorization', existingAuth[1])
          }
        } else {
          const existingAuth = (init.headers as Record<string, string>)['Authorization'] || 
                              (init.headers as Record<string, string>)['authorization']
          if (existingAuth) {
            headers.set('Authorization', existingAuth)
          }
        }
      }

      // Make fetch request with authenticated headers
      return fetch(input, {
        ...init,
        headers,
        // No credentials needed - stateless backend uses Shopify session tokens only
      })
    },
    [getAppBridgeInstance]
  )

  return fetchWithAuth
}

