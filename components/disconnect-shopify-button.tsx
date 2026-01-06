"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export function DisconnectShopifyButton() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your Shopify store? You will need to reconnect to use Shopify features.')) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/shopify/disconnect', {
        method: 'POST',
        credentials: 'include',
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || data.message || 'Failed to disconnect Shopify store')
        return
      }

      // Refresh the page to show updated status
      router.refresh()
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
        disabled={isLoading}
        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
      >
        {isLoading ? 'Disconnecting...' : 'Disconnect Shopify Store'}
      </button>

      {error && (
        <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
      )}
    </div>
  )
}

