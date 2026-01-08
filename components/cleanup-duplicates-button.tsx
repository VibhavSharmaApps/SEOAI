'use client'

import { useState } from 'react'

export function CleanupDuplicatesButton() {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [dryRun, setDryRun] = useState(true)

  const handleCleanup = async (actuallyDelete: boolean) => {
    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch(
        `/api/keywords/cleanup-duplicates?dry_run=${!actuallyDelete}`,
        {
          method: 'POST',
          credentials: 'include',
        }
      )

      const data = await response.json()

      if (!response.ok) {
        const errorMsg = data.message || data.error || 'Failed to cleanup duplicates'
        setError(errorMsg)
        return
      }

      setResult(data)
      setDryRun(!actuallyDelete)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => handleCleanup(false)}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Checking...' : 'Check for Duplicates'}
        </button>
        {result && result.summary.totalDuplicates > 0 && (
          <button
            onClick={() => handleCleanup(true)}
            disabled={isLoading || dryRun === false}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Deleting...' : 'Delete Duplicates'}
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-red-800 dark:text-red-200 text-sm">
            ❌ Error: {error}
          </p>
        </div>
      )}

      {result && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
          <p className="text-blue-800 dark:text-blue-200 font-semibold mb-2">
            {result.dryRun ? '🔍 Duplicate Check Results' : '✅ Cleanup Complete'}
          </p>
          <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
            <p>
              <strong>Total Keywords:</strong> {result.summary.totalKeywords}
            </p>
            <p>
              <strong>Pages with &gt;2 keywords:</strong> {result.summary.sourcesWithMoreThan2}
            </p>
            <p>
              <strong>Excess keywords found:</strong> {result.summary.totalDuplicates}
            </p>
            {result.summary.deletedCount > 0 && (
              <p className="text-green-700 dark:text-green-300 font-semibold">
                <strong>Deleted:</strong> {result.summary.deletedCount} keywords
              </p>
            )}
          </div>
          {result.duplicates && result.duplicates.length > 0 && (
            <details className="mt-3">
              <summary className="text-xs cursor-pointer text-blue-600 dark:text-blue-400 font-semibold">
                View Duplicate Details ({result.duplicates.length} pages)
              </summary>
              <div className="mt-2 space-y-2 text-xs">
                {result.duplicates.map((dup: any, idx: number) => (
                  <div key={idx} className="p-2 bg-white dark:bg-gray-900 rounded border">
                    <p className="font-semibold">
                      {dup.source} - {dup.count} keywords (excess: {dup.excess})
                    </p>
                    <div className="text-muted-foreground mt-1">
                      <p className="font-semibold">To delete:</p>
                      <ul className="list-disc list-inside ml-2">
                        {dup.toDelete.map((kw: any, i: number) => (
                          <li key={i}>{kw.keyword}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
          <details className="mt-2">
            <summary className="text-xs cursor-pointer text-blue-600 dark:text-blue-400">
              View Full Response
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

