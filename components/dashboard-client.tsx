'use client'

import { useState } from 'react'
import { SyncBaselineButton } from '@/components/sync-baseline-button'
import { DisconnectShopifyButton } from '@/components/disconnect-shopify-button'
import { ContentGeneration } from '@/components/content-generation'
import { DashboardStatusCheck } from '@/components/dashboard-status-check'
import { WordPressConnectionForm } from '@/components/wordpress-connection-form'
import { DISABLE_CONTENT_GENERATION_UI, ENABLE_WORDPRESS_TESTING } from '@/lib/feature-flags'

/**
 * Dashboard Client Component
 * Renders UI immediately
 * Status check component handles authenticated fetch in background
 */
export function DashboardClient() {
  // Temporary CMS selection for internal testing
  // Only allow WordPress selection if testing flag is enabled
  // When flag is disabled, force CMS to SHOPIFY
  const [selectedCms, setSelectedCms] = useState<'SHOPIFY' | 'WORDPRESS'>('SHOPIFY')
  
  // Ensure WordPress cannot be selected when flag is disabled
  const effectiveCms: 'SHOPIFY' | 'WORDPRESS' = ENABLE_WORDPRESS_TESTING ? selectedCms : 'SHOPIFY'

  return (
    <>
      {/* Status check - makes authenticated fetch in background */}
      {/* Only run Shopify App Bridge initialization when CMS is Shopify */}
      {effectiveCms === 'SHOPIFY' && <DashboardStatusCheck />}

      {/* Temporary CMS Selection - Internal Testing Only */}
      {ENABLE_WORDPRESS_TESTING && (
        <div className="bg-card p-4 rounded-lg border mb-6">
          <label className="text-sm font-medium mb-2 block">CMS Type (Testing):</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="cms-type"
                value="SHOPIFY"
                checked={effectiveCms === 'SHOPIFY'}
                onChange={(e) => {
                  if (ENABLE_WORDPRESS_TESTING) {
                    setSelectedCms(e.target.value as 'SHOPIFY' | 'WORDPRESS')
                  }
                }}
                className="cursor-pointer"
              />
              <span className="text-sm">Shopify</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="cms-type"
                value="WORDPRESS"
                checked={effectiveCms === 'WORDPRESS'}
                onChange={(e) => {
                  if (ENABLE_WORDPRESS_TESTING) {
                    setSelectedCms(e.target.value as 'SHOPIFY' | 'WORDPRESS')
                  }
                }}
                disabled={!ENABLE_WORDPRESS_TESTING}
                className="cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <span className="text-sm">WordPress (Testing)</span>
            </label>
          </div>
        </div>
      )}

      {/* WordPress Connection Form - Only shown when WordPress is selected and testing is enabled */}
      {ENABLE_WORDPRESS_TESTING && effectiveCms === 'WORDPRESS' && (
        <WordPressConnectionForm />
      )}

      {/* Dashboard UI - renders immediately */}
      <div className="bg-card p-8 rounded-lg border mb-6">
        <h2 className="text-xl font-semibold mb-4">Console</h2>
        <div className="space-y-4">
          <div className="pt-4 border-t">
            <SyncBaselineButton cmsType={effectiveCms} />
          </div>
        </div>
      </div>

      {/* Content Generation UI - hidden when feature flag is enabled or CMS is WordPress */}
      {/* ContentGeneration uses shopifyId, so only show for Shopify */}
      {!DISABLE_CONTENT_GENERATION_UI && effectiveCms === 'SHOPIFY' && (
        <div className="bg-card p-8 rounded-lg border mb-6">
          <h2 className="text-xl font-semibold mb-4">Content Generation</h2>
          <ContentGeneration />
        </div>
      )}

      {/* Settings - Disconnect button only for Shopify */}
      {effectiveCms === 'SHOPIFY' && (
        <div className="bg-card p-8 rounded-lg border">
          <h2 className="text-xl font-semibold mb-4">Settings</h2>
          <DisconnectShopifyButton />
        </div>
      )}
    </>
  )
}

