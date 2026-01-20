'use client'

import { useEffect, useState } from 'react'
import { useAuthenticatedFetch } from '@/lib/use-authenticated-fetch'

/**
 * Component that makes authenticated status check
 * Only renders when App Bridge Provider is available (embedded context)
 */
function DashboardStatusCheckInner() {
  const fetchWithAuth = useAuthenticatedFetch()

  useEffect(() => {
    // Silent background fetch after initial render
    async function checkStatus() {
      try {
        await fetchWithAuth('/api/dashboard/status', {
          method: 'GET',
        })
      } catch (error) {
        // Silently fail
      }
    }

    checkStatus()
  }, [fetchWithAuth])

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

