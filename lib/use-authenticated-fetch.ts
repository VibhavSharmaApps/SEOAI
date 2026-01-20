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
    // App Bridge sets window.shopify when initialized
    return (window as any).shopify?.app || null
  }, [])

  const fetchWithAuth = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      // Get fresh session token for each request
      let sessionToken: string | null = null
      
      try {
        const app = getAppBridgeInstance()
        if (app) {
          // Use App Bridge utility to get session token
          sessionToken = await getSessionToken(app)
        }
      } catch (error) {
        // Silently fail - App Bridge not available (not embedded or Provider not rendered)
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

