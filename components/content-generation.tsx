'use client'

import { useState, useEffect } from 'react'

interface BlogPost {
  id: string
  title: string
  url: string
  shopifyId: string
}

interface Keyword {
  id: string
  keyword: string
}

interface GenerateKeywordsResult {
  success: boolean
  keywords?: string[]
  error?: string
  message?: string
}

interface PublishResult {
  success: boolean
  message?: string
  error?: string
}

export function ContentGeneration() {
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([])
  const [selectedPostId, setSelectedPostId] = useState<string>('')
  const [keywords, setKeywords] = useState<string[]>([])
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [generatingKeywords, setGeneratingKeywords] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [keywordError, setKeywordError] = useState<string>('')
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null)

  // Fetch blog posts on mount
  useEffect(() => {
    fetchBlogPosts()
  }, [])

  const fetchBlogPosts = async () => {
    try {
      setLoadingPosts(true)
      const response = await fetch('/api/pages/list?type=ARTICLE', {
        credentials: 'include',
      })
      const data = await response.json()
      if (data.success && data.pages) {
        setBlogPosts(data.pages)
        if (data.pages.length > 0) {
          setSelectedPostId(data.pages[0].id)
        }
      }
    } catch (err) {
      console.error('Error loading blog posts:', err)
    } finally {
      setLoadingPosts(false)
    }
  }

  const handleGenerateKeywords = async () => {
    if (!selectedPostId) {
      setKeywordError('Please select a blog post')
      return
    }

    setGeneratingKeywords(true)
    setKeywordError('')
    setKeywords([])
    setPublishResult(null)

    try {
      const selectedPost = blogPosts.find((p) => p.id === selectedPostId)
      if (!selectedPost) {
        setKeywordError('Selected blog post not found')
        return
      }

      // Get keywords for this blog post
      const sourcePattern = `article:${selectedPost.shopifyId}`
      const keywordsResponse = await fetch(
        `/api/keywords/list?source=${encodeURIComponent(sourcePattern)}`,
        { credentials: 'include' }
      )
      const keywordsData = await keywordsResponse.json()

      if (keywordsData.success && keywordsData.keywords && keywordsData.keywords.length > 0) {
        // Use existing keywords (limit to 2)
        const existingKeywords = keywordsData.keywords.slice(0, 2).map((k: Keyword) => k.keyword)
        setKeywords(existingKeywords)
      } else {
        // Generate keywords using seed endpoint
        const seedResponse = await fetch('/api/keywords/seed', {
          method: 'POST',
          credentials: 'include',
        })
        const seedData = await seedResponse.json()

        if (seedResponse.ok && seedData.success) {
          // Fetch keywords again after seeding
          const updatedKeywordsResponse = await fetch(
            `/api/keywords/list?source=${encodeURIComponent(sourcePattern)}`,
            { credentials: 'include' }
          )
          const updatedKeywordsData = await updatedKeywordsResponse.json()

          if (updatedKeywordsData.success && updatedKeywordsData.keywords) {
            const newKeywords = updatedKeywordsData.keywords.slice(0, 2).map((k: Keyword) => k.keyword)
            setKeywords(newKeywords)
          } else {
            setKeywordError('No keywords generated. Please try again.')
          }
        } else {
          setKeywordError(seedData.error || seedData.message || 'Failed to generate keywords')
        }
      }
    } catch (err) {
      setKeywordError('Network error: ' + (err instanceof Error ? err.message : 'Unknown error'))
      console.error(err)
    } finally {
      setGeneratingKeywords(false)
    }
  }

  const handlePublish = async () => {
    if (!selectedPostId) {
      setPublishResult({ success: false, error: 'Please select a blog post to publish.' })
      return
    }

    if (keywords.length === 0) {
      setPublishResult({ success: false, error: 'Please generate keywords first.' })
      return
    }

    setPublishing(true)
    setPublishResult(null)

    try {
      const selectedPost = blogPosts.find((p) => p.id === selectedPostId)
      if (!selectedPost) {
        setPublishResult({ success: false, error: 'Selected blog post not found.' })
        return
      }

      // Generate content first (using first keyword)
      const generateResponse = await fetch('/api/content/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          page_id: selectedPostId,
          primary_keyword: keywords[0],
          page_type: 'ARTICLE',
        }),
      })

      const generateData = await generateResponse.json()

      if (!generateResponse.ok || !generateData.success) {
        setPublishResult({
          success: false,
          error: generateData.error || generateData.message || 'Failed to generate content',
        })
        return
      }

      // Publish to Shopify
      const publishResponse = await fetch('/api/content/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          page_id: selectedPostId,
        }),
      })

      const publishData = await publishResponse.json()

      if (publishResponse.ok && publishData.success) {
        setPublishResult({
          success: true,
          message: publishData.message || 'Content published successfully to Shopify!',
        })
      } else {
        setPublishResult({
          success: false,
          error: publishData.error || publishData.message || 'Failed to publish to Shopify',
        })
      }
    } catch (err) {
      setPublishResult({
        success: false,
        error: 'Network error: ' + (err instanceof Error ? err.message : 'Unknown error'),
      })
      console.error(err)
    } finally {
      setPublishing(false)
    }
  }

  const selectedPost = blogPosts.find((p) => p.id === selectedPostId)

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Select Blog Post</label>
        {loadingPosts ? (
          <p className="text-sm text-muted-foreground">Loading blog posts...</p>
        ) : blogPosts.length === 0 ? (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
            <p className="text-yellow-800 dark:text-yellow-200 text-sm">
              No blog posts found. Sync store content first.
            </p>
          </div>
        ) : (
          <select
            value={selectedPostId}
            onChange={(e) => {
              setSelectedPostId(e.target.value)
              setKeywords([])
              setKeywordError('')
              setPublishResult(null)
            }}
            className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
            disabled={generatingKeywords || publishing}
          >
            {blogPosts.map((post) => (
              <option key={post.id} value={post.id}>
                {post.title}
              </option>
            ))}
          </select>
        )}
      </div>

      <div>
        <button
          onClick={handleGenerateKeywords}
          disabled={generatingKeywords || publishing || !selectedPostId || loadingPosts}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generatingKeywords ? 'Generating Keywords...' : 'Generate Keywords'}
        </button>
      </div>

      {keywordError && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-red-800 dark:text-red-200 text-sm">{keywordError}</p>
        </div>
      )}

      {keywords.length > 0 && (
        <div className="p-4 bg-muted rounded-md">
          <p className="text-sm font-medium mb-2">Generated Keywords:</p>
          <div className="space-y-1">
            {keywords.map((keyword, index) => (
              <p key={index} className="text-sm text-foreground">
                {index + 1}. {keyword}
              </p>
            ))}
          </div>
        </div>
      )}

      <div>
        <button
          onClick={handlePublish}
          disabled={publishing || generatingKeywords || !selectedPostId || keywords.length === 0}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {publishing ? 'Publishing...' : 'Publish to Shopify'}
        </button>
      </div>

      {publishResult && (
        <div
          className={`p-3 rounded-md border ${
            publishResult.success
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          }`}
        >
          <p
            className={`text-sm ${
              publishResult.success
                ? 'text-green-800 dark:text-green-200'
                : 'text-red-800 dark:text-red-200'
            }`}
          >
            {publishResult.success ? '✅ ' : '❌ '}
            {publishResult.message || publishResult.error}
          </p>
        </div>
      )}
    </div>
  )
}

