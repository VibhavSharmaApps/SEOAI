'use client'

import { useMemo } from 'react'
import { Provider } from '@shopify/app-bridge-react'

// App Bridge configuration type
type AppBridgeConfig = {
  apiKey: string
  host: string
  forceRedirect?: boolean
}

/**
 * Shopify App Bridge Provider
 * Initializes App Bridge with shop origin and API key
 * Singleton pattern - created once and reused across the app
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

  // App Bridge configuration
  const config: AppBridgeConfig = useMemo(() => {
    if (!apiKey) {
      console.warn('[App Bridge] NEXT_PUBLIC_SHOPIFY_API_KEY is not set')
    }

    return {
      apiKey,
      host,
      forceRedirect: false, // Let Shopify handle redirects
    }
  }, [apiKey, host])

  // Only render App Bridge provider if we have API key AND host parameter
  // App Bridge requires host parameter to initialize (embedded context)
  // If not embedded (no host), render children without Provider to avoid errors
  if (!apiKey) {
    console.warn('[App Bridge] API key not configured. App Bridge features will not work.')
    return <>{children}</>
  }

  // If no host parameter, we're not in embedded context - don't initialize App Bridge
  // This prevents "shopify global is not defined" errors
  if (!host) {
    // Not embedded - render children without Provider
    // Components using App Bridge hooks should check for embedded context first
    return <>{children}</>
  }

  // Wrap children with App Bridge Provider (only when embedded with host parameter)
  return (
    <Provider config={config}>
      {children}
    </Provider>
  )
}

