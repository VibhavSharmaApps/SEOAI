import { DashboardClient } from "@/components/dashboard-client"

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { site?: string; shopify?: string; msg?: string }
}) {
  // Support both 'site' and 'shopify' query params for backward compatibility
  const siteStatus = searchParams.site || searchParams.shopify

  return (
    <main className="flex min-h-screen flex-col p-24">
      <div className="z-10 max-w-7xl w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Dashboard</h1>
        </div>

        {/* Success/Error Messages */}
        {siteStatus === "connected" && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
            <p className="text-green-800 dark:text-green-200">
              ✅ Site connected successfully!
            </p>
          </div>
        )}

        {siteStatus === "error" && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-red-800 dark:text-red-200 font-semibold mb-2">
              ❌ Failed to connect site
            </p>
            {searchParams.msg && (
              <p className="text-red-700 dark:text-red-300 text-sm mb-2">
                Error: {decodeURIComponent(searchParams.msg as string)}
              </p>
            )}
            <p className="text-red-700 dark:text-red-300 text-sm">
              Check the server logs for more details. Common issues:
            </p>
            <ul className="text-red-700 dark:text-red-300 text-sm list-disc list-inside mt-2 space-y-1">
              <li>Missing encryption key environment variable</li>
              <li>Database connection issues</li>
              <li>Invalid API credentials</li>
            </ul>
          </div>
        )}

        {/* Dashboard UI - renders immediately, makes authenticated fetch in background */}
        <DashboardClient />
      </div>
    </main>
  )
}

