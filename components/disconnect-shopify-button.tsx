"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthenticatedFetch } from "@/lib/use-authenticated-fetch"
import { useAppBridgeReady } from "@/lib/use-app-bridge-ready"

export function DisconnectShopifyButton() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const fetchWithAuth = useAuthenticatedFetch()
  const isAppBridgeReady = useAppBridgeReady()

  const handleDisconnect = async () => {
    // Guard: Only run on client
    if (typeof window === 'undefined') {
      return
    }

    // Guard: Wait for App Bridge to be ready
    if (!isAppBridgeReady) {
      setError('App Bridge is not ready yet. Please wait a moment and try again.')
      return
    }

    if (!confirm('Are you sure you want to disconnect your Shopify store? You will need to reconnect to use Shopify features.')) {
      return
    }

    setIsLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const response = await fetchWithAuth('/api/shopify/disconnect', {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || data.message || 'Failed to disconnect Shopify store')
        return
      }

      setSuccess(true)
      
      // Force a full page reload to ensure the UI updates
      setTimeout(() => {
        window.location.href = '/dashboard'
      }, 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleDisconnect}
        disabled={isLoading || success || !isAppBridgeReady}
        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
      >
        {isLoading ? 'Disconnecting...' : success ? 'Disconnected! Redirecting...' : !isAppBridgeReady ? 'Initializing...' : 'Disconnect Shopify Store'}
      </button>

      {error && (
        <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
      )}

      {success && (
        <p className="text-green-600 dark:text-green-400 text-sm">✅ Store disconnected successfully! Redirecting...</p>
      )}
    </div>
  )
}

