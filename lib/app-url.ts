/**
 * Gets the base URL for the application
 * Automatically detects Vercel URL in production, falls back to localhost in development
 */
export function getAppUrl(): string {
  let baseUrl: string
  let source: string
  
  // In production on Vercel, use the automatically provided URL
  if (process.env.VERCEL_URL) {
    baseUrl = `https://${process.env.VERCEL_URL}`
    source = 'VERCEL_URL'
  }
  // Use explicit NEXT_PUBLIC_APP_URL if set (trim any whitespace)
  else if (process.env.NEXT_PUBLIC_APP_URL) {
    baseUrl = process.env.NEXT_PUBLIC_APP_URL.trim()
    source = 'NEXT_PUBLIC_APP_URL'
  }
  // Fallback to localhost for development
  else {
    baseUrl = 'http://localhost:3000'
    source = 'fallback (localhost)'
  }
  
  console.log(`[getAppUrl] Resolved base URL: ${baseUrl} (source: ${source})`)
  return baseUrl
}

