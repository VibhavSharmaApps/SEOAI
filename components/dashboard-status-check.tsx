'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuthenticatedFetch } from '@/lib/use-authenticated-fetch'
import { useAppBridgeReady } from '@/lib/use-app-bridge-ready'

// Global state to track if initial authenticated request has completed
// This ensures the request runs only once per session
let hasInitialized = false
const initializationListeners = new Set<(initialized: boolean) => void>()

/**
 * Hook to check if the initial authenticated request has completed
 */
export function useDashboardInitialized(): boolean {
  const [initialized, setInitialized] = useState(hasInitialized)

  useEffect(() => {
    if (hasInitialized) {
      setInitialized(true)
      return
    }

    const listener = (value: boolean) => setInitialized(value)
    initializationListeners.add(listener)

    return () => {
      initializationListeners.delete(listener)
    }
  }, [])

  return initialized
}

/**
 * Component that makes authenticated status check
 * Runs automatically once App Bridge is ready, only once per session
 */
function DashboardStatusCheckInner() {
  const fetchWithAuth = useAuthenticatedFetch()
  const isAppBridgeReady = useAppBridgeReady()
  const hasRunRef = useRef(false)

  useEffect(() => {
    // Guard: Only run on client
    if (typeof window === 'undefined') {
      return
    }

    // Guard: Wait for App Bridge to be ready
    if (!isAppBridgeReady) {
      return
    }

    // Guard: Run only once per session
    if (hasRunRef.current || hasInitialized) {
      return
    }

    // Mark as running
    hasRunRef.current = true

    // Make authenticated request once App Bridge is ready
    async function checkStatus() {
      try {
        // Request session token and call backend endpoint
        const response = await fetchWithAuth('/api/dashboard/status', {
          method: 'GET',
        })
        
        // Mark as initialized (regardless of success/failure)
        hasInitialized = true
        initializationListeners.forEach(listener => listener(true))
      } catch (error) {
        // Mark as initialized even on error (so UI doesn't stay in "Initializing" forever)
        hasInitialized = true
        initializationListeners.forEach(listener => listener(true))
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

