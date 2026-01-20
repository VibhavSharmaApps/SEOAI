'use client'

import { useState, useEffect } from 'react'

/**
 * Hook to check if App Bridge is ready
 * Returns true only when App Bridge is fully initialized on the client
 * 
 * Usage:
 * ```tsx
 * const isReady = useAppBridgeReady()
 * if (!isReady) return <div>Loading...</div>
 * ```
 */
export function useAppBridgeReady(): boolean {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    // Only run on client
    if (typeof window === 'undefined') {
      return
    }

    // Check if App Bridge is already initialized
    if ((window as any).shopify?.app) {
      setIsReady(true)
      return
    }

    // Poll for App Bridge initialization (with timeout)
    const maxAttempts = 50 // 5 seconds max (50 * 100ms)
    let attempts = 0

    const checkInterval = setInterval(() => {
      attempts++
      
      if ((window as any).shopify?.app) {
        setIsReady(true)
        clearInterval(checkInterval)
      } else if (attempts >= maxAttempts) {
        // Timeout - App Bridge not initialized after 5 seconds
        // Log warning but don't set isReady to true (let components handle timeout)
        console.warn('[App Bridge Ready] Timeout waiting for App Bridge initialization')
        clearInterval(checkInterval)
      }
    }, 100) // Check every 100ms

    return () => clearInterval(checkInterval)
  }, [])

  return isReady
}

/**
 * Wait for App Bridge to be ready (utility function for async operations)
 * 
 * Usage:
 * ```tsx
 * await waitForAppBridge()
 * // Now App Bridge is ready
 * ```
 */
export async function waitForAppBridge(timeout: number = 5000): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('waitForAppBridge can only be called on the client')
  }

  // Check if already ready
  if ((window as any).shopify?.app) {
    return
  }

  // Wait for initialization
  const startTime = Date.now()
  while (Date.now() - startTime < timeout) {
    if ((window as any).shopify?.app) {
      return
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  throw new Error('App Bridge initialization timeout')
}

