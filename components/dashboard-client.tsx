'use client'

import { SyncBaselineButton } from '@/components/sync-baseline-button'
import { DisconnectShopifyButton } from '@/components/disconnect-shopify-button'
import { ContentGeneration } from '@/components/content-generation'
import { DashboardStatusCheck } from '@/components/dashboard-status-check'

/**
 * Dashboard Client Component
 * Renders UI immediately
 * Status check component handles authenticated fetch in background
 */
export function DashboardClient() {
  return (
    <>
      {/* Status check - makes authenticated fetch in background */}
      <DashboardStatusCheck />

      {/* Dashboard UI - renders immediately */}
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

