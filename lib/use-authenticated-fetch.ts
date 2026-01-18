'use client'

import { useCallback } from 'react'
import { useAppBridge } from '@shopify/app-bridge-react'
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
  const app = useAppBridge()

  const fetchWithAuth = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      // Get fresh session token for each request
      let sessionToken: string | null = null
      
      try {
        if (app) {
          // Use App Bridge utility to get session token
          // Type cast needed because useAppBridge() returns ShopifyGlobal but getSessionToken expects ClientApplication
          // This is a known type mismatch in @shopify/app-bridge-react v4.x
          sessionToken = await getSessionToken(app as any)
        }
      } catch (error) {
        console.warn('[Authenticated Fetch] Failed to get session token:', error)
        // Continue without token if App Bridge is not available (standalone mode)
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
    [app]
  )

  return fetchWithAuth
}

