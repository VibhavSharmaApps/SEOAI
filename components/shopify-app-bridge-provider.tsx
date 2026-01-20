'use client'

import { useMemo, useEffect, useState } from 'react'

/**
 * Shopify App Bridge Provider
 * Initializes App Bridge ONLY on client, after mount, in embedded context
 * 
 * Requirements:
 * - Client-side only (never during SSR)
 * - Embedded app route (host parameter required)
 * - After component mount (useEffect)
 */
export function ShopifyAppBridgeProvider({ children }: { children: React.ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false)

  // Get shop origin from URL parameters (when embedded in Shopify)
  // Format: ?host=base64EncodedShopDomain
  // Client-side only - useMemo ensures this only runs on client
  const host = useMemo(() => {
    if (typeof window === 'undefined') return ''
    
    const urlParams = new URLSearchParams(window.location.search)
    return urlParams.get('host') || ''
  }, [])

  // Get API key from environment variable
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY || ''

  // Initialize App Bridge ONLY after component mount (useEffect)
  // Client-side only - never runs during SSR
  useEffect(() => {
    // Guard: Only run on client
    if (typeof window === 'undefined') {
      return
    }

    // Guard: Only initialize in embedded context (host parameter required)
    if (!host) {
      return
    }

    // Guard: Only initialize if API key is present
    if (!apiKey) {
      return
    }

    // Guard: Skip if already initialized
    if ((window as any).shopify?.app) {
      setIsInitialized(true)
      return
    }

    // Initialize App Bridge asynchronously
    async function initializeAppBridge() {
      try {
        // Dynamically import App Bridge (client-side only)
        const appBridge = await import('@shopify/app-bridge')
        
        // Check if createApp exists
        if (!appBridge.createApp) {
          // Try alternative export pattern
          if ((appBridge as any).default?.createApp) {
            const app = (appBridge as any).default.createApp({ 
              apiKey, 
              host, 
              forceRedirect: false 
            })
            if (!(window as any).shopify) {
              (window as any).shopify = {}
            }
            (window as any).shopify.app = app
            setIsInitialized(true)
            return
          }
          throw new Error('createApp method not found in @shopify/app-bridge')
        }
        
        // Initialize App Bridge using createApp
        const app = appBridge.createApp({
          apiKey,
          host,
          forceRedirect: false,
        })
        
        // Store app instance on window for useAuthenticatedFetch to access
        if (!(window as any).shopify) {
          (window as any).shopify = {}
        }
        (window as any).shopify.app = app
        
        setIsInitialized(true)
      } catch (error) {
        console.error('[App Bridge] Failed to initialize:', error)
      }
    }

    // Initialize after mount
    initializeAppBridge()
  }, [apiKey, host]) // Only re-run if apiKey or host changes

  // Render children immediately (App Bridge initialization happens in background)
  return <>{children}</>
}

