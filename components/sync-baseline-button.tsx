"use client"

import { useState } from "react"
import { useAuthenticatedFetch } from "@/lib/use-authenticated-fetch"
import { useWordPressFetch } from "@/lib/use-wordpress-fetch"
import { useDashboardInitialized } from "@/components/dashboard-status-check"

export function SyncBaselineButton({ cmsType = 'SHOPIFY' }: { cmsType?: 'SHOPIFY' | 'WORDPRESS' }) {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  
  // Conditionally use fetch functions based on CMS type
  // WordPress doesn't require App Bridge initialization
  // Note: Hooks must be called unconditionally, but we only use the appropriate one
  const shopifyFetch = useAuthenticatedFetch() // Only used when cmsType === 'SHOPIFY'
  const wordpressFetch = useWordPressFetch() // Only used when cmsType === 'WORDPRESS'
  const fetchWithAuth = cmsType === 'WORDPRESS' ? wordpressFetch : shopifyFetch
  
  // Only check initialization for Shopify (requires App Bridge)
  // For WordPress, this hook is called but result is ignored
  const isInitialized = useDashboardInitialized()
  
  // For WordPress, we don't need to wait for App Bridge initialization
  // For Shopify, we need App Bridge to be initialized
  const canProceed = cmsType === 'WORDPRESS' ? true : isInitialized

  const handleSync = async () => {
    // Guard: Only run on client
    if (typeof window === 'undefined') {
      return
    }

    // Guard: Wait for initial authenticated request to complete (Shopify only)
    // WordPress doesn't require App Bridge initialization
    if (!canProceed) {
      setError('Dashboard is still initializing. Please wait a moment and try again.')
      return
    }

    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      // Always call SEO run endpoint - backend handles CMS-specific routing
      const response = await fetchWithAuth('/api/seo/run', {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        const errorMsg = data.message || data.error || 'Failed to run SEO changes'
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

  // Determine button text
  const getButtonText = () => {
    if (!canProceed) return 'Initializing...'
    if (isLoading) return 'Running SEO...'
    return 'Run SEO Changes'
  }

  return (
    <div className="space-y-4">
      <button
        onClick={handleSync}
        disabled={isLoading || !canProceed}
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
          <p className="text-green-800 dark:text-green-200 mb-2">SEO Run Complete</p>
          <div className="text-sm text-green-700 dark:text-green-300 whitespace-pre-line">
            <p>Generated:</p>
            <p>  Meta: {result.counts?.UPDATE_META || 0}</p>
            <p>  Links: {result.counts?.ADD_INTERNAL_LINK || 0}</p>
            <p>  Schema: {result.counts?.INJECT_SCHEMA || 0}</p>
            <p>Applied:</p>
            <p>  Meta: {result.applied?.UPDATE_META || 0}</p>
            <p>  Links: {result.applied?.ADD_INTERNAL_LINK || 0}</p>
            <p>  Schema: {result.applied?.INJECT_SCHEMA || 0}</p>
            <p>Failed:</p>
            <p>  Meta: {result.failed?.UPDATE_META || 0}</p>
            <p>  Links: {result.failed?.ADD_INTERNAL_LINK || 0}</p>
            <p>  Schema: {result.failed?.INJECT_SCHEMA || 0}</p>
            <p>Total Pages: {result.totalPages || 0}</p>
          </div>
        </div>
      )}
    </div>
  )
}

