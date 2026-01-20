import { DashboardClient } from "@/components/dashboard-client"

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { shopify?: string; msg?: string }
}) {
  return (
    <main className="flex min-h-screen flex-col p-24">
      <div className="z-10 max-w-7xl w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Dashboard</h1>
        </div>

        {/* Success/Error Messages */}
        {searchParams.shopify === "connected" && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
            <p className="text-green-800 dark:text-green-200">
              ✅ Shopify store connected successfully!
            </p>
          </div>
        )}

        {searchParams.shopify === "error" && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-red-800 dark:text-red-200 font-semibold mb-2">
              ❌ Failed to connect Shopify store
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
              <li>Missing SHOPIFY_ENCRYPTION_KEY environment variable</li>
              <li>Database connection issues</li>
              <li>Invalid Shopify API credentials</li>
            </ul>
          </div>
        )}

        {/* Dashboard UI - renders immediately, makes authenticated fetch in background */}
        <DashboardClient />
      </div>
    </main>
  )
}

