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
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Guard: Only run on client
    if (typeof window === 'undefined') {
      return
    }

    // Guard: Run only once per session
    if (hasRunRef.current || hasInitialized) {
      return
    }

    // Set a timeout to mark as initialized even if App Bridge never becomes ready
    // This prevents buttons from being stuck in "Initializing..." forever
    // Timeout is 6 seconds (1 second after App Bridge's 5 second timeout)
    if (!timeoutRef.current) {
      timeoutRef.current = setTimeout(() => {
        if (!hasInitialized) {
          console.warn('[Dashboard Status] App Bridge initialization timeout - marking dashboard as initialized anyway')
          hasInitialized = true
          initializationListeners.forEach(listener => listener(true))
        }
      }, 6000) // 6 second timeout
    }

    // Guard: Wait for App Bridge to be ready
    if (!isAppBridgeReady) {
      return
    }

    // Mark as running
    hasRunRef.current = true

    // Clear timeout since we're proceeding with the request
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

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

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [fetchWithAuth, isAppBridgeReady])

  return null // No UI
}

/**
 * Wrapper that conditionally renders the status check
 * Always renders - if not embedded, marks as initialized immediately
 */
export function DashboardStatusCheck() {
  const [isEmbedded, setIsEmbedded] = useState(false)

  useEffect(() => {
    // Guard: Only run on client
    if (typeof window === 'undefined') {
      return
    }

    // Check if we're in embedded context
    const urlParams = new URLSearchParams(window.location.search)
    const host = urlParams.get('host')
    const embedded = !!host
    setIsEmbedded(embedded)

    // If not embedded, mark as initialized immediately
    // This allows buttons to work even when not in embedded context
    // (they'll just fail when making requests, but won't be stuck)
    if (!embedded && !hasInitialized) {
      console.log('[Dashboard Status] Not in embedded context - marking dashboard as initialized')
      hasInitialized = true
      initializationListeners.forEach(listener => listener(true))
    }
  }, [])

  // Only render inner component if embedded (to make authenticated request)
  // If not embedded, we've already marked as initialized above
  if (!isEmbedded) {
    return null
  }

  return <DashboardStatusCheckInner />
}

