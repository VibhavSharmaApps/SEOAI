'use client'

import { useMemo, useEffect } from 'react'

/**
 * Shopify App Bridge Provider
 * Initializes App Bridge with shop origin and API key
 * Uses direct App Bridge initialization (no React Provider needed)
 */
export function ShopifyAppBridgeProvider({ children }: { children: React.ReactNode }) {
  // Get shop origin from URL parameters (when embedded in Shopify)
  // Format: ?host=base64EncodedShopDomain
  const host = useMemo(() => {
    if (typeof window === 'undefined') return ''
    
    const urlParams = new URLSearchParams(window.location.search)
    return urlParams.get('host') || ''
  }, [])

  // Get API key from environment variable
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY || ''

  // Initialize App Bridge directly (not using React Provider)
  useEffect(() => {
    // Only initialize if we have both API key and host parameter
    if (!apiKey || !host) {
      return
    }

    // Check if App Bridge is already initialized
    if ((window as any).shopify?.app) {
      return
    }

    // Dynamically import and initialize App Bridge
    async function initializeAppBridge() {
      try {
        const appBridge = await import('@shopify/app-bridge')
        
        // Initialize App Bridge using createApp
        const config = {
          apiKey,
          host,
          forceRedirect: false,
        }

        const app = appBridge.createApp(config)
        
        // Store app instance on window for useAuthenticatedFetch to access
        if (!(window as any).shopify) {
          (window as any).shopify = {}
        }
        (window as any).shopify.app = app
      } catch (error) {
        console.warn('[App Bridge] Failed to initialize:', error)
      }
    }

    initializeAppBridge()
  }, [apiKey, host])

  // Render children immediately (App Bridge initialization happens in background)
  return <>{children}</>
}

