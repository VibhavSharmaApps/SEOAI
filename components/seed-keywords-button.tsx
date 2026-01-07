"use client"

import { useState } from "react"

export function SeedKeywordsButton() {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSeed = async () => {
    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/keywords/seed', {
        method: 'POST',
        credentials: 'include',
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || data.message || 'Failed to seed keywords')
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
        onClick={handleSeed}
        disabled={isLoading}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Seeding Keywords...' : 'Seed Keywords'}
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
            ✅ Keywords Seeded Successfully!
          </p>
          <div className="text-sm text-green-700 dark:text-green-300 space-y-1">
            <p><strong>Pages Processed:</strong> {result.pagesProcessed || 0}</p>
            <p><strong>Keywords Created:</strong> {result.keywordsCreated || 0}</p>
            {result.keywordsSkipped > 0 && (
              <p><strong>Keywords Skipped (already exist):</strong> {result.keywordsSkipped}</p>
            )}
            <p><strong>Total Keywords in Database:</strong> {result.totalKeywordsInDatabase || 0}</p>
          </div>
          {result.pageDetails && result.pageDetails.length > 0 && (
            <details className="mt-3">
              <summary className="text-xs cursor-pointer text-green-600 dark:text-green-400 font-semibold">
                View page-by-page breakdown
              </summary>
              <div className="mt-2 space-y-2 text-xs">
                {result.pageDetails.map((page: any, idx: number) => (
                  <div key={idx} className="p-2 bg-white dark:bg-gray-900 rounded border">
                    <p className="font-semibold">{page.pageTitle} ({page.pageType})</p>
                    <div className="text-muted-foreground mt-1">
                      <p>Generated: {page.keywordsGenerated} | Created: {page.keywordsCreated} | Skipped: {page.keywordsSkipped}</p>
                      {page.error && <p className="text-red-600">Error: {page.error}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </details>
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

