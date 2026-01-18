'use client'

import { useMemo } from 'react'
import type { AppBridgeConfig } from '@shopify/app-bridge'

// Try importing Provider - if it doesn't exist, we'll handle it gracefully
// In App Bridge React v4, Provider may be available differently
let AppBridgeProvider: any = null

// Use dynamic import to handle potential export differences
if (typeof window !== 'undefined') {
  // Client-side: try to import Provider
  try {
    // Attempt named import (should work if available)
    const appBridgeReactModule = require('@shopify/app-bridge-react')
    // Try multiple possible export patterns
    AppBridgeProvider = appBridgeReactModule.Provider || 
                       appBridgeReactModule.default?.Provider ||
                       (appBridgeReactModule.default && typeof appBridgeReactModule.default === 'function' ? appBridgeReactModule.default : null)
  } catch (error) {
    // Provider not available - will handle in component
  }
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

  // Only render App Bridge provider if we have required config
  // If not embedded (no host), app will work without App Bridge (standalone mode)
  if (!apiKey) {
    console.warn('[App Bridge] API key not configured. App Bridge features will not work.')
    return <>{children}</>
  }

  // If Provider is not available, render children directly (standalone mode)
  if (!AppBridgeProvider) {
    console.warn('[App Bridge] Provider component not available - running in standalone mode')
    return <>{children}</>
  }

  // If no host parameter, app is not embedded - still wrap but App Bridge will handle it
  return (
    <AppBridgeProvider config={config}>
      {children}
    </AppBridgeProvider>
  )
}

