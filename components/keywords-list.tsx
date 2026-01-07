"use client"

import { useState, useEffect } from "react"

export function KeywordsList() {
  const [keywords, setKeywords] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchKeywords()
  }, [])

  const fetchKeywords = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/keywords/list?limit=50', {
        credentials: 'include',
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || data.message || 'Failed to fetch keywords')
        return
      }

      setKeywords(data.keywords || [])
      setSummary(data.summary)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Loading keywords...
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
        <p className="text-red-800 dark:text-red-200 text-sm">
          ❌ Error: {error}
        </p>
      </div>
    )
  }

  if (keywords.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        No keywords found. Seed keywords to get started.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {summary && (
        <div className="p-4 bg-muted rounded-md">
          <p className="text-sm font-semibold mb-2">Summary</p>
          <div className="text-sm space-y-1">
            <p><strong>Total Keywords:</strong> {summary.total}</p>
            {summary.bySource && summary.bySource.length > 0 && (
              <div>
                <p className="font-semibold mt-2">By Source:</p>
                <ul className="list-disc list-inside ml-2">
                  {summary.bySource.map((item: any, idx: number) => (
                    <li key={idx}>
                      {item.source}: {item.count}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      <div>
        <p className="text-sm font-semibold mb-2">Recent Keywords ({keywords.length})</p>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {keywords.map((keyword) => (
            <div
              key={keyword.id}
              className="p-3 bg-card border rounded-md text-sm"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="font-medium">{keyword.keyword}</p>
                  {keyword.source && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Source: {keyword.source}
                    </p>
                  )}
                </div>
                <div className="text-xs text-muted-foreground ml-4">
                  {new Date(keyword.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={fetchKeywords}
        className="text-sm text-primary hover:underline"
      >
        Refresh
      </button>
    </div>
  )
}

