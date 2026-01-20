'use client'

import { useEffect, useState } from 'react'
import { useAuthenticatedFetch } from '@/lib/use-authenticated-fetch'
import { useAppBridgeReady } from '@/lib/use-app-bridge-ready'

/**
 * Component that makes authenticated status check
 * Only runs after App Bridge is initialized
 */
function DashboardStatusCheckInner() {
  const fetchWithAuth = useAuthenticatedFetch()
  const isAppBridgeReady = useAppBridgeReady()

  useEffect(() => {
    // Guard: Only run on client
    if (typeof window === 'undefined') {
      return
    }

    // Guard: Wait for App Bridge to be ready before making request
    if (!isAppBridgeReady) {
      return
    }

    // Silent background fetch after App Bridge is ready
    async function checkStatus() {
      try {
        await fetchWithAuth('/api/dashboard/status', {
          method: 'GET',
        })
      } catch (error) {
        // Silently fail - this is just a background check
      }
    }

    checkStatus()
  }, [fetchWithAuth, isAppBridgeReady])

  return null // No UI
}

/**
 * Wrapper that conditionally renders the status check
 * Only renders when host parameter is present (embedded context)
 */
export function DashboardStatusCheck() {
  const [isEmbedded, setIsEmbedded] = useState(false)

  useEffect(() => {
    // Check if we're in embedded context
    const urlParams = new URLSearchParams(window.location.search)
    const host = urlParams.get('host')
    setIsEmbedded(!!host)
  }, [])

  // Only render if we're in embedded context (host present)
  // This ensures Provider is available for useAppBridge() hook
  if (!isEmbedded) {
    return null
  }

  return <DashboardStatusCheckInner />
}

