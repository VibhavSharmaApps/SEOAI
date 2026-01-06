"use client"

import { useState } from "react"

export function SyncBaselineButton() {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSync = async () => {
    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/store/baseline', {
        method: 'POST',
        credentials: 'include',
      })

      const data = await response.json()

      if (!response.ok) {
        const errorMsg = data.message || data.error || 'Failed to sync baseline data'
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

  return (
    <div className="space-y-4">
      <button
        onClick={handleSync}
        disabled={isLoading}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Syncing...' : 'Sync Baseline Data'}
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
            ✅ Sync Complete!
          </p>
          <div className="text-sm text-green-700 dark:text-green-300 space-y-1">
            <p><strong>Synced:</strong> {result.synced?.products || 0} products, {result.synced?.collections || 0} collections, {result.synced?.articles || 0} articles</p>
            <p><strong>Stored in DB:</strong> {result.stored?.PRODUCT || 0} products, {result.stored?.COLLECTION || 0} collections, {result.stored?.ARTICLE || 0} articles</p>
            <p><strong>Total:</strong> {result.total || 0} pages</p>
          </div>
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

