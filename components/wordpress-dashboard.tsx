'use client'

import { useState, useEffect } from 'react'
import { useWordPressFetch } from '@/lib/use-wordpress-fetch'

interface WordPressStatus {
  connected: boolean
  cmsType: string | null
  siteUrl: string | null
  domain: string | null
}

interface SEORunResult {
  success: boolean
  message?: string
  counts?: {
    UPDATE_META: number
    ADD_INTERNAL_LINK: number
    INJECT_SCHEMA: number
  }
  applied?: {
    UPDATE_META: number
    ADD_INTERNAL_LINK: number
    INJECT_SCHEMA: number
  }
  failed?: {
    UPDATE_META: number
    ADD_INTERNAL_LINK: number
    INJECT_SCHEMA: number
  }
  totalPages?: number
  error?: string
}

export function WordPressDashboard() {
  const [status, setStatus] = useState<WordPressStatus | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [siteUrl, setSiteUrl] = useState('')
  const [username, setUsername] = useState('')
  const [applicationPassword, setApplicationPassword] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [runningSEO, setRunningSEO] = useState(false)
  const [seoResult, setSeoResult] = useState<SEORunResult | null>(null)
  const [seoError, setSeoError] = useState<string | null>(null)
  const fetchWithAuth = useWordPressFetch()

  // Load WordPress connection status on mount
  useEffect(() => {
    loadStatus()
  }, [])

  const loadStatus = async () => {
    setLoadingStatus(true)
    try {
      // WordPress status endpoint is now public - no auth required
      const response = await fetch('/api/wordpress/status')
      const data = await response.json()
      if (response.ok) {
        // Use cmsType from database response, or default to null if not provided
        setStatus({
          connected: data.connected || false,
          cmsType: data.cmsType || null,
          siteUrl: data.siteUrl || null,
          domain: null, // Not returned by status endpoint
        })
      } else {
        // If status check fails, assume not connected
        setStatus({ connected: false, cmsType: null, siteUrl: null, domain: null })
      }
    } catch (err) {
      console.error('Error loading status:', err)
      setStatus({ connected: false, cmsType: null, siteUrl: null, domain: null })
    } finally {
      setLoadingStatus(false)
    }
  }

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!siteUrl || !username || !applicationPassword) {
      setConnectError('All fields are required')
      return
    }

    setConnecting(true)
    setConnectError(null)

    try {
      // WordPress connect endpoint is now public - no auth required
      const response = await fetch('/api/wordpress/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          siteUrl,
          username,
          applicationPassword,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setConnectError(data.error || data.message || 'Failed to connect WordPress site')
        return
      }

      // Clear form and reload status
      setSiteUrl('')
      setUsername('')
      setApplicationPassword('')
      await loadStatus()
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setConnecting(false)
    }
  }

  const handleRunSEO = async () => {
    setRunningSEO(true)
    setSeoError(null)
    setSeoResult(null)

    try {
      const response = await fetchWithAuth('/api/seo/run', {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        setSeoError(data.error || data.message || 'Failed to run SEO changes')
        return
      }

      setSeoResult(data)
    } catch (err) {
      setSeoError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setRunningSEO(false)
    }
  }

  if (loadingStatus) {
    return <div>Loading...</div>
  }

  const isConnected = status?.connected === true

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b pb-4">
        <h2 className="text-2xl font-bold mb-2">WordPress MVP Testing Console</h2>
        <div className="space-y-1 text-sm">
          <div>
            <strong>CMS Type:</strong> {status?.cmsType === 'WORDPRESS' ? 'WordPress' : status?.cmsType || 'Not set'}
          </div>
          <div>
            <strong>Site URL:</strong> {status?.siteUrl || 'Not connected'}
          </div>
          <div>
            <strong>Connection Status:</strong> {isConnected ? 'Connected' : 'Not connected'}
          </div>
        </div>
      </div>

      {/* Connection Form (if not connected) */}
      {!isConnected && (
        <div className="border p-4">
          <h3 className="text-lg font-semibold mb-4">Connect WordPress Site</h3>
          <form onSubmit={handleConnect} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Site URL</label>
              <input
                type="text"
                value={siteUrl}
                onChange={(e) => setSiteUrl(e.target.value)}
                placeholder="https://example.com"
                required
                disabled={connecting}
                className="w-full px-3 py-2 border rounded disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="wordpress-username"
                required
                disabled={connecting}
                className="w-full px-3 py-2 border rounded disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Application Password</label>
              <input
                type="password"
                value={applicationPassword}
                onChange={(e) => setApplicationPassword(e.target.value)}
                placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                required
                disabled={connecting}
                className="w-full px-3 py-2 border rounded disabled:opacity-50"
              />
            </div>
            <button
              type="submit"
              disabled={connecting}
              className="px-4 py-2 bg-primary text-primary-foreground rounded disabled:opacity-50"
            >
              {connecting ? 'Connecting...' : 'Connect'}
            </button>
            {connectError && (
              <div className="text-red-600 text-sm">Error: {connectError}</div>
            )}
          </form>
        </div>
      )}

      {/* Connected State */}
      {isConnected && (
        <div className="space-y-4">
          <div className="border p-4 bg-green-50 dark:bg-green-900/20">
            <p className="text-green-800 dark:text-green-200">WordPress site connected</p>
          </div>

          <div>
            <button
              onClick={handleRunSEO}
              disabled={runningSEO}
              className="px-6 py-3 bg-primary text-primary-foreground rounded font-semibold disabled:opacity-50"
            >
              {runningSEO ? 'Running SEO...' : 'Run SEO'}
            </button>
          </div>

          {/* SEO Results */}
          {seoError && (
            <div className="border p-4 bg-red-50 dark:bg-red-900/20">
              <p className="text-red-800 dark:text-red-200">Error: {seoError}</p>
            </div>
          )}

          {seoResult && (
            <div className="border p-4">
              <h3 className="text-lg font-semibold mb-2">SEO Run Results</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <strong>Generated:</strong>
                  <ul className="list-disc list-inside ml-4">
                    <li>Meta fixes: {seoResult.counts?.UPDATE_META || 0}</li>
                    <li>Internal links: {seoResult.counts?.ADD_INTERNAL_LINK || 0}</li>
                    <li>Schema injections: {seoResult.counts?.INJECT_SCHEMA || 0}</li>
                  </ul>
                </div>
                <div>
                  <strong>Applied:</strong>
                  <ul className="list-disc list-inside ml-4">
                    <li>Meta fixes: {seoResult.applied?.UPDATE_META || 0}</li>
                    <li>Internal links: {seoResult.applied?.ADD_INTERNAL_LINK || 0}</li>
                    <li>Schema injections: {seoResult.applied?.INJECT_SCHEMA || 0}</li>
                  </ul>
                </div>
                <div>
                  <strong>Failed:</strong>
                  <ul className="list-disc list-inside ml-4">
                    <li>Meta fixes: {seoResult.failed?.UPDATE_META || 0}</li>
                    <li>Internal links: {seoResult.failed?.ADD_INTERNAL_LINK || 0}</li>
                    <li>Schema injections: {seoResult.failed?.INJECT_SCHEMA || 0}</li>
                  </ul>
                </div>
                {seoResult.totalPages !== undefined && (
                  <div>
                    <strong>Total Pages:</strong> {seoResult.totalPages}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

