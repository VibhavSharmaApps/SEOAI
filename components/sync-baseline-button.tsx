"use client"

import { useState } from "react"
import { useAuthenticatedFetch } from "@/lib/use-authenticated-fetch"
import { useDashboardInitialized } from "@/components/dashboard-status-check"
import { DISABLE_CONTENT_GENERATION_UI } from "@/lib/feature-flags"

export function SyncBaselineButton() {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const fetchWithAuth = useAuthenticatedFetch()
  const isInitialized = useDashboardInitialized()

  const handleSync = async () => {
    // Guard: Only run on client
    if (typeof window === 'undefined') {
      return
    }

    // Guard: Wait for initial authenticated request to complete
    if (!isInitialized) {
      setError('Dashboard is still initializing. Please wait a moment and try again.')
      return
    }

    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      // When feature flag is enabled, trigger SEO run instead of baseline sync
      const endpoint = DISABLE_CONTENT_GENERATION_UI ? '/api/seo/run' : '/api/store/baseline'
      const response = await fetchWithAuth(endpoint, {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        const errorMsg = data.message || data.error || 'Failed to run operation'
        setError(`${errorMsg}${data.message && data.message !== data.error ? ` (${data.error})` : ''}`)
        return
      }

      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  // Determine button text based on feature flag
  const getButtonText = () => {
    if (!isInitialized) return 'Initializing...'
    if (isLoading) return DISABLE_CONTENT_GENERATION_UI ? 'Running SEO...' : 'Syncing...'
    return DISABLE_CONTENT_GENERATION_UI ? 'Run SEO Changes' : 'Sync Store Content'
  }

  return (
    <div className="space-y-4">
      <button
        onClick={handleSync}
        disabled={isLoading || !isInitialized}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {getButtonText()}
      </button>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-red-800 dark:text-red-200 text-sm">
            ❌ Error: {error}
          </p>
        </div>
      )}

      {result && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
          <p className="text-green-800 dark:text-green-200 font-semibold mb-2">
            ✅ {DISABLE_CONTENT_GENERATION_UI ? 'SEO Run Complete!' : 'Sync Complete!'}
          </p>
          {DISABLE_CONTENT_GENERATION_UI ? (
            <div className="text-sm text-green-700 dark:text-green-300 space-y-1">
              <p><strong>Generated:</strong> {result.counts?.UPDATE_META || 0} meta, {result.counts?.ADD_INTERNAL_LINK || 0} internal links, {result.counts?.INJECT_SCHEMA || 0} schema</p>
              <p><strong>Applied:</strong> {result.applied?.UPDATE_META || 0} meta, {result.applied?.ADD_INTERNAL_LINK || 0} internal links, {result.applied?.INJECT_SCHEMA || 0} schema</p>
              <p><strong>Failed:</strong> {result.failed?.UPDATE_META || 0} meta, {result.failed?.ADD_INTERNAL_LINK || 0} internal links, {result.failed?.INJECT_SCHEMA || 0} schema</p>
              <p><strong>Total Pages:</strong> {result.totalPages || 0}</p>
            </div>
          ) : (
            <div className="text-sm text-green-700 dark:text-green-300 space-y-1">
              <p><strong>Synced:</strong> {result.synced?.products || 0} products, {result.synced?.collections || 0} collections, {result.synced?.articles || 0} articles</p>
              <p><strong>Stored in DB:</strong> {result.stored?.PRODUCT || 0} products, {result.stored?.COLLECTION || 0} collections, {result.stored?.ARTICLE || 0} articles</p>
              <p><strong>Total:</strong> {result.total || 0} pages</p>
            </div>
          )}
          <details className="mt-2">
            <summary className="text-xs cursor-pointer text-green-600 dark:text-green-400">
              View full response
            </summary>
            <pre className="mt-2 text-xs bg-white dark:bg-gray-900 p-2 rounded overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  )
}

