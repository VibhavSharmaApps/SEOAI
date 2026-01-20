'use client'

import { useCallback } from 'react'
import { getSessionToken } from '@shopify/app-bridge/utilities'
import { waitForAppBridge } from './use-app-bridge-ready'

/**
 * Hook that returns an authenticated fetch function
 * Automatically retrieves fresh Shopify session token before each request
 * and attaches it as Bearer token in Authorization header
 * 
 * Requirements:
 * - Client-side only (never during SSR)
 * - Waits for App Bridge to be initialized before making requests
 * 
 * Usage:
 * ```tsx
 * const fetchWithAuth = useAuthenticatedFetch()
 * const response = await fetchWithAuth('/api/my-endpoint', { method: 'POST' })
 * ```
 */
export function useAuthenticatedFetch() {
  // Get App Bridge instance from window (set by Provider when initialized)
  // Client-side only - returns null during SSR
  const getAppBridgeInstance = useCallback(() => {
    if (typeof window === 'undefined') return null
    return (window as any).shopify?.app || null
  }, [])

  const fetchWithAuth = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      // Guard: Only run on client
      if (typeof window === 'undefined') {
        throw new Error('useAuthenticatedFetch can only be called on the client')
      }

      // Wait for App Bridge to be initialized before proceeding
      // This ensures App Bridge is ready before we try to get session token
      await waitForAppBridge()

      // Get App Bridge instance (should be available after waitForAppBridge)
      const app = getAppBridgeInstance()
      if (!app) {
        throw new Error('App Bridge instance not found after initialization')
      }

      // Get fresh session token for each request
      let sessionToken: string | null = null
      
      try {
        // Use App Bridge utility to get session token
        sessionToken = await getSessionToken(app)
        
        if (!sessionToken) {
          throw new Error('Failed to retrieve session token from App Bridge')
        }
      } catch (error) {
        console.error('[Authenticated Fetch] Error getting session token:', error)
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

