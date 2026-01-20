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
        console.log('[App Bridge] Starting initialization...', { apiKey: apiKey ? apiKey.substring(0, 8) + '...' : 'missing', host: host ? host.substring(0, 20) + '...' : 'missing' })
        
        const appBridge = await import('@shopify/app-bridge')
        console.log('[App Bridge] Module imported, available methods:', Object.keys(appBridge))
        
        // Check if createApp exists
        if (!appBridge.createApp) {
          console.error('[App Bridge] createApp method not found in @shopify/app-bridge')
          // Try alternative initialization methods
          if ((appBridge as any).default?.createApp) {
            console.log('[App Bridge] Using default.createApp')
            const app = (appBridge as any).default.createApp({ apiKey, host, forceRedirect: false })
            if (!(window as any).shopify) {
              (window as any).shopify = {}
            }
            (window as any).shopify.app = app
            console.log('[App Bridge] Initialized using default.createApp')
            return
          }
          throw new Error('createApp method not found')
        }
        
        // Initialize App Bridge using createApp
        const config = {
          apiKey,
          host,
          forceRedirect: false,
        }

        console.log('[App Bridge] Calling createApp with config...')
        const app = appBridge.createApp(config)
        console.log('[App Bridge] createApp returned:', app ? 'app instance' : 'null')
        
        // Store app instance on window for useAuthenticatedFetch to access
        if (!(window as any).shopify) {
          (window as any).shopify = {}
        }
        (window as any).shopify.app = app
        
        console.log('[App Bridge] Initialized successfully, stored on window.shopify.app')
        console.log('[App Bridge] window.shopify:', Object.keys((window as any).shopify))
      } catch (error) {
        console.error('[App Bridge] Failed to initialize:', error)
        if (error instanceof Error) {
          console.error('[App Bridge] Error details:', error.message, error.stack)
        }
      }
    }

    initializeAppBridge()
  }, [apiKey, host])

  // Render children immediately (App Bridge initialization happens in background)
  return <>{children}</>
}

