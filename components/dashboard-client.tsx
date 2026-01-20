'use client'

import { useEffect } from 'react'
import { useAppBridge } from '@shopify/app-bridge-react'
import { getSessionToken } from '@shopify/app-bridge/utilities'
import { SyncBaselineButton } from '@/components/sync-baseline-button'
import { DisconnectShopifyButton } from '@/components/disconnect-shopify-button'
import { ContentGeneration } from '@/components/content-generation'

/**
 * Dashboard Client Component
 * Renders UI immediately, then makes authenticated fetch in background
 * Minimal implementation for Shopify session token verification
 */
export function DashboardClient() {
  const app = useAppBridge()

  useEffect(() => {
    // Silent background fetch after initial render
    // Uses Shopify App Bridge to get session token
    async function checkStatus() {
      try {
        if (!app) return

        // Get session token from App Bridge
        const sessionToken = await getSessionToken(app as any)
        
        if (!sessionToken) return

        // Make authenticated request to status endpoint
        await fetch('/api/dashboard/status', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
          },
        })
      } catch (error) {
        // Silently fail - no error handling needed
      }
    }

    // Run after initial render
    checkStatus()
  }, [app])

  // Render dashboard UI immediately (no loading states)
  return (
    <>
      <div className="bg-card p-8 rounded-lg border mb-6">
        <h2 className="text-xl font-semibold mb-4">Console</h2>
        <div className="space-y-4">
          <div className="pt-4 border-t">
            <SyncBaselineButton />
          </div>
        </div>
      </div>

      <div className="bg-card p-8 rounded-lg border mb-6">
        <h2 className="text-xl font-semibold mb-4">Content Generation</h2>
        <ContentGeneration />
      </div>

      <div className="bg-card p-8 rounded-lg border">
        <h2 className="text-xl font-semibold mb-4">Settings</h2>
        <DisconnectShopifyButton />
      </div>
    </>
  )
}

