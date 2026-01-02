/**
 * Gets the base URL for the application
 * Automatically detects Vercel URL in production, falls back to localhost in development
 */
export function getAppUrl(): string {
  // In production on Vercel, use the automatically provided URL
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  
  // Use explicit NEXT_PUBLIC_APP_URL if set
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL
  }
  
  // Fallback to localhost for development
  return 'http://localhost:3000'
}

