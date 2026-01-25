'use client'

import { useCallback } from 'react'

/**
 * WordPress-specific fetch function
 * Does not use Shopify App Bridge - makes direct API calls
 * 
 * Note: This is a temporary solution for WordPress testing.
 * The backend still uses Shopify session tokens for authentication,
 * but this allows WordPress UI to work without App Bridge initialization.
 * 
 * For WordPress, we try to get session token if App Bridge is available,
 * but we don't wait for App Bridge initialization.
 */
export function useWordPressFetch() {
  const fetchWithAuth = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      // Guard: Only run on client
      if (typeof window === 'undefined') {
        throw new Error('useWordPressFetch can only be called on the client')
      }

      // For WordPress, we still need to get a session token if available
      // But we don't require App Bridge to be initialized
      // If App Bridge is available, use it; otherwise, make request without token
      // (Backend will handle authentication)
      let sessionToken: string | null = null

      // Try to get session token from App Bridge if available (but don't wait for it)
      try {
        if ((window as any).shopify?.app) {
          const { getSessionToken } = await import('@shopify/app-bridge/utilities')
          sessionToken = await getSessionToken((window as any).shopify.app)
        }
      } catch (error) {
        // App Bridge not available or not initialized - continue without token
        // Backend will handle authentication
        console.log('[WordPress Fetch] App Bridge not available, making request without session token')
      }

      // Merge headers with Authorization token if available
      const headers = new Headers(init?.headers)
      
      if (sessionToken) {
        headers.set('Authorization', `Bearer ${sessionToken}`)
      }

      // Make fetch request
      return fetch(input, {
        ...init,
        headers,
      })
    },
    []
  )

  return fetchWithAuth
}

