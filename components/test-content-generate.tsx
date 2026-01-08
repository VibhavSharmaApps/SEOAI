'use client'

import { useState, useEffect } from 'react'

interface Page {
  id: string
  type: string
  title: string
  url: string
  shopifyId: string
  contentVersionsCount: number
  latestVersion: number
}

interface GenerateResult {
  success: boolean
  content?: string
  version?: number
  pageId?: string
  pageTitle?: string
  error?: string
  message?: string
}

export function TestContentGenerate() {
  const [pages, setPages] = useState<Page[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingPages, setLoadingPages] = useState(true)
  const [selectedPageId, setSelectedPageId] = useState<string>('')
  const [primaryKeyword, setPrimaryKeyword] = useState<string>('')
  const [results, setResults] = useState<GenerateResult[]>([])
  const [error, setError] = useState<string>('')

  // Fetch pages on mount
  useEffect(() => {
    fetchPages()
  }, [])

  const fetchPages = async () => {
    try {
      setLoadingPages(true)
      const response = await fetch('/api/pages/list', {
        credentials: 'include',
      })
      const data = await response.json()
      if (data.success) {
        setPages(data.pages || [])
        if (data.pages && data.pages.length > 0) {
          setSelectedPageId(data.pages[0].id)
        }
      } else {
        setError('Failed to load pages')
      }
    } catch (err) {
      setError('Error loading pages')
      console.error(err)
    } finally {
      setLoadingPages(false)
    }
  }

  const handleGenerate = async () => {
    if (!selectedPageId || !primaryKeyword.trim()) {
      setError('Please select a page and enter a primary keyword')
      return
    }

    const selectedPage = pages.find((p) => p.id === selectedPageId)
    if (!selectedPage) {
      setError('Selected page not found')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/content/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          page_id: selectedPageId,
          primary_keyword: primaryKeyword.trim(),
          page_type: selectedPage.type,
        }),
      })

      const data: GenerateResult = await response.json()

      if (response.ok && data.success) {
        setResults((prev) => [data, ...prev])
        // Refresh pages to update version counts
        fetchPages()
      } else {
        setError(data.error || data.message || 'Failed to generate content')
      }
    } catch (err) {
      setError('Network error: ' + (err instanceof Error ? err.message : 'Unknown error'))
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const selectedPage = pages.find((p) => p.id === selectedPageId)

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold mb-2">Content Generation Test</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Test the content generation endpoint. Generate multiple times to verify versioning.
        </p>
      </div>

      {loadingPages ? (
        <p className="text-sm text-muted-foreground">Loading pages...</p>
      ) : pages.length === 0 ? (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
          <p className="text-yellow-800 dark:text-yellow-200 text-sm">
            No pages found. Sync baseline data first.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Select Page</label>
              <select
                value={selectedPageId}
                onChange={(e) => setSelectedPageId(e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                disabled={loading}
              >
                {pages.map((page) => (
                  <option key={page.id} value={page.id}>
                    {page.type} - {page.title} {page.contentVersionsCount > 0 && `(v${page.latestVersion})`}
                  </option>
                ))}
              </select>
              {selectedPage && (
                <p className="text-xs text-muted-foreground mt-1">
                  Type: {selectedPage.type} | Existing versions: {selectedPage.contentVersionsCount}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Primary Keyword</label>
              <input
                type="text"
                value={primaryKeyword}
                onChange={(e) => setPrimaryKeyword(e.target.value)}
                placeholder="e.g., organic coffee beans"
                className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                disabled={loading}
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading || !selectedPageId || !primaryKeyword.trim()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Generating...' : 'Generate Content'}
            </button>
          </div>

          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-red-800 dark:text-red-200 text-sm font-semibold mb-1">❌ Error</p>
              <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Generation Results</h4>
              {results.map((result, index) => (
                <div
                  key={index}
                  className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-green-800 dark:text-green-200 font-semibold">
                        ✅ Version {result.version} Generated
                      </p>
                      <span className="text-xs text-green-600 dark:text-green-400">
                        {new Date().toLocaleTimeString()}
                      </span>
                    </div>
                    {result.pageTitle && (
                      <p className="text-sm text-green-700 dark:text-green-300">
                        Page: {result.pageTitle}
                      </p>
                    )}
                    {result.content && (
                      <details className="mt-2">
                        <summary className="text-xs cursor-pointer text-green-600 dark:text-green-400 font-semibold">
                          View Content Preview ({result.content.length} chars)
                        </summary>
                        <div className="mt-2 p-3 bg-white dark:bg-gray-900 rounded border text-xs overflow-auto max-h-60">
                          <div
                            dangerouslySetInnerHTML={{ __html: result.content.substring(0, 500) }}
                          />
                          {result.content.length > 500 && (
                            <p className="text-muted-foreground mt-2">... (truncated)</p>
                          )}
                        </div>
                      </details>
                    )}
                    <details className="mt-2">
                      <summary className="text-xs cursor-pointer text-green-600 dark:text-green-400">
                        View Full Response
                      </summary>
                      <pre className="mt-2 text-xs bg-white dark:bg-gray-900 p-2 rounded overflow-auto">
                        {JSON.stringify(result, null, 2)}
                      </pre>
                    </details>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Test Instructions */}
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
            <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">
              🧪 Test Checklist
            </h4>
            <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1 list-disc list-inside">
              <li>
                <strong>Generate twice:</strong> Click "Generate Content" twice with the same page/keyword.
                Versions should increment (1 → 2).
              </li>
              <li>
                <strong>Different page types:</strong> Test with PRODUCT, COLLECTION, and ARTICLE pages.
              </li>
              <li>
                <strong>Content differs:</strong> Compare PRODUCT vs ARTICLE content - they should be different.
              </li>
              <li>
                <strong>Missing keyword:</strong> Try generating without a keyword - should show error.
              </li>
              <li>
                <strong>No overwrite:</strong> Generate 3 times - all 3 versions should exist in database.
              </li>
            </ul>
          </div>
        </>
      )}
    </div>
  )
}

