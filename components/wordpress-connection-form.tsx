'use client'

import { useState } from 'react'
import { useWordPressFetch } from '@/lib/use-wordpress-fetch'

export function WordPressConnectionForm() {
  const [siteUrl, setSiteUrl] = useState('')
  const [username, setUsername] = useState('')
  const [applicationPassword, setApplicationPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [siteConnected, setSiteConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fetchWithAuth = useWordPressFetch()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Basic required field validation
    if (!siteUrl || !username || !applicationPassword) {
      setError('All fields are required')
      return
    }

    setIsLoading(true)
    setError(null)
    setSiteConnected(false)

    try {
      const response = await fetchWithAuth('/api/wordpress/connect', {
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
        setError(data.error || data.message || 'Failed to connect WordPress site')
        return
      }

      setSiteConnected(true)
      // Clear form on success
      setSiteUrl('')
      setUsername('')
      setApplicationPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-card p-6 rounded-lg border mb-6">
      <h2 className="text-lg font-semibold mb-4">WordPress Connection</h2>
      
      {siteConnected && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
          <p className="text-green-800 dark:text-green-200 text-sm">WordPress site connected</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="site-url" className="block text-sm font-medium mb-1">
            Site URL
          </label>
          <input
            id="site-url"
            type="text"
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
            placeholder="https://example.com"
            required
            disabled={isLoading}
            className="w-full px-3 py-2 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <div>
          <label htmlFor="username" className="block text-sm font-medium mb-1">
            Username
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="wordpress-username"
            required
            disabled={isLoading}
            className="w-full px-3 py-2 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <div>
          <label htmlFor="application-password" className="block text-sm font-medium mb-1">
            Application Password
          </label>
          <input
            id="application-password"
            type="password"
            value={applicationPassword}
            onChange={(e) => setApplicationPassword(e.target.value)}
            placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
            required
            disabled={isLoading}
            className="w-full px-3 py-2 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Connecting...' : 'Connect WordPress Site'}
        </button>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-red-800 dark:text-red-200 text-sm">❌ {error}</p>
          </div>
        )}

      </form>
    </div>
  )
}

