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
  keywordCount?: number
}

interface Keyword {
  id: string
  keyword: string
  source: string | null
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

interface PublishResult {
  success: boolean
  message?: string
  pageId?: string
  pageTitle?: string
  pageType?: string
  version?: number
  publishedAt?: string
  trackingEnabled?: boolean
  error?: string
}

export function TestContentGenerate() {
  const [pages, setPages] = useState<Page[]>([])
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingPages, setLoadingPages] = useState(true)
  const [loadingKeywords, setLoadingKeywords] = useState(false)
  const [selectedPageId, setSelectedPageId] = useState<string>('')
  const [primaryKeyword, setPrimaryKeyword] = useState<string>('')
  const [results, setResults] = useState<GenerateResult[]>([])
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState<string>('')

  // Fetch pages on mount
  useEffect(() => {
    fetchPages()
  }, [])

  // Fetch keywords when page selection changes
  useEffect(() => {
    if (selectedPageId) {
      fetchKeywordsForPage()
    } else {
      setKeywords([])
      setPrimaryKeyword('')
    }
  }, [selectedPageId])

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

  const fetchKeywordsForPage = async () => {
    const selectedPage = pages.find((p) => p.id === selectedPageId)
    if (!selectedPage) return

    try {
      setLoadingKeywords(true)
      // Build source pattern: product:123 or collection:456
      const sourcePattern = `${selectedPage.type.toLowerCase()}:${selectedPage.shopifyId}`
      
      const response = await fetch(`/api/keywords/list?source=${encodeURIComponent(sourcePattern)}`, {
        credentials: 'include',
      })
      const data = await response.json()
      
      if (data.success && data.keywords) {
        setKeywords(data.keywords)
        // Autopopulate first keyword if available
        if (data.keywords.length > 0) {
          setPrimaryKeyword(data.keywords[0].keyword)
        } else {
          setPrimaryKeyword('')
        }
      } else {
        setKeywords([])
        setPrimaryKeyword('')
      }
    } catch (err) {
      console.error('Error loading keywords:', err)
      setKeywords([])
    } finally {
      setLoadingKeywords(false)
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
    setPublishResult(null)

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

  const handlePublish = async () => {
    if (!selectedPageId) {
      setError('Please select a page')
      return
    }

    setPublishing(true)
    setError('')
    setPublishResult(null)

    try {
      const response = await fetch('/api/content/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          page_id: selectedPageId,
        }),
      })

      const data: PublishResult = await response.json()

      if (response.ok && data.success) {
        setPublishResult(data)
        // Refresh pages to update tracking status
        fetchPages()
      } else {
        setError(data.error || data.message || 'Failed to publish content')
      }
    } catch (err) {
      setError('Network error: ' + (err instanceof Error ? err.message : 'Unknown error'))
      console.error(err)
    } finally {
      setPublishing(false)
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
                    {page.type} - {page.title} 
                    {page.contentVersionsCount > 0 && ` (v${page.latestVersion})`}
                    {page.keywordCount !== undefined && page.keywordCount > 0 && ` [${page.keywordCount} keywords]`}
                  </option>
                ))}
              </select>
              {selectedPage && (
                <p className="text-xs text-muted-foreground mt-1">
                  Type: {selectedPage.type} | Content versions: {selectedPage.contentVersionsCount} | Keywords: {selectedPage.keywordCount || 0}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Primary Keyword
                {keywords.length > 0 && (
                  <span className="text-xs text-muted-foreground ml-2">
                    ({keywords.length} keywords available)
                  </span>
                )}
              </label>
              {loadingKeywords ? (
                <p className="text-xs text-muted-foreground">Loading keywords...</p>
              ) : keywords.length > 0 ? (
                <div className="space-y-2">
                  <select
                    value={primaryKeyword}
                    onChange={(e) => setPrimaryKeyword(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                    disabled={loading}
                  >
                    {keywords.map((kw) => (
                      <option key={kw.id} value={kw.keyword}>
                        {kw.keyword}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Or type a custom keyword below
                  </p>
                  <input
                    type="text"
                    value={primaryKeyword}
                    onChange={(e) => setPrimaryKeyword(e.target.value)}
                    placeholder="Or enter custom keyword"
                    className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                    disabled={loading}
                  />
                </div>
              ) : (
                <input
                  type="text"
                  value={primaryKeyword}
                  onChange={(e) => setPrimaryKeyword(e.target.value)}
                  placeholder="e.g., organic coffee beans (no keywords found for this page)"
                  className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                  disabled={loading}
                />
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleGenerate}
                disabled={loading || !selectedPageId || !primaryKeyword.trim()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Generating...' : 'Generate Content'}
              </button>
              <button
                onClick={handlePublish}
                disabled={publishing || !selectedPageId || loading}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {publishing ? 'Publishing...' : 'Publish to Shopify'}
              </button>
            </div>
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

          {publishResult && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-blue-800 dark:text-blue-200 font-semibold">
                    {publishResult.success ? '✅ Published Successfully' : '❌ Publish Failed'}
                  </p>
                  {publishResult.publishedAt && (
                    <span className="text-xs text-blue-600 dark:text-blue-400">
                      {new Date(publishResult.publishedAt).toLocaleString()}
                    </span>
                  )}
                </div>
                {publishResult.message && (
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    {publishResult.message}
                  </p>
                )}
                {publishResult.pageTitle && (
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Page: {publishResult.pageTitle} ({publishResult.pageType})
                  </p>
                )}
                {publishResult.version && (
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Version: {publishResult.version}
                  </p>
                )}
                {publishResult.trackingEnabled && (
                  <p className="text-sm text-green-700 dark:text-green-300 font-semibold">
                    ✓ Tracking enabled for this page
                  </p>
                )}
                <details className="mt-2">
                  <summary className="text-xs cursor-pointer text-blue-600 dark:text-blue-400">
                    View Full Response
                  </summary>
                  <pre className="mt-2 text-xs bg-white dark:bg-gray-900 p-2 rounded overflow-auto">
                    {JSON.stringify(publishResult, null, 2)}
                  </pre>
                </details>
              </div>
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
              <li>
                <strong>Publish to Shopify:</strong> After generating content, click "Publish to Shopify" to push it live.
                Only PRODUCT and ARTICLE pages can be published. COLLECTION pages are not supported.
              </li>
            </ul>
          </div>
        </>
      )}
    </div>
  )
}

