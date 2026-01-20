import { prisma } from "@/lib/prisma"
import { getSiteFromSessionServer } from "@/lib/get-site-from-session-server"
import { SyncBaselineButton } from "@/components/sync-baseline-button"
import { DisconnectShopifyButton } from "@/components/disconnect-shopify-button"
import { ContentGeneration } from "@/components/content-generation"

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { shopify?: string; msg?: string }
}) {
  // Embedded app route - always render UI, never block access
  // Silently handle missing auth (no error messages or install-enforcement)
  let site = null
  
  try {
    // Try to get site from Shopify session token (optional - don't block if missing)
    site = await getSiteFromSessionServer()
  } catch (error) {
    // Silently handle auth errors - embedded routes must always render UI
    // No error messages, no install-enforcement, just render empty state
    site = null
  }

  const hasShopify = !!site?.shopifyAccessToken

  // Get counts for dashboard
  const blogPostCount = site
    ? await prisma.page.count({
        where: { 
          siteId: site.id,
          type: 'ARTICLE',
        },
      })
    : 0

  const autopilotRunCount = site
    ? await prisma.autopilotRun.count({
        where: { siteId: site.id },
      })
    : 0

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

        {/* Dashboard Tile */}
        {hasShopify && site && (
          <div className="bg-card p-8 rounded-lg border mb-6">
            <h2 className="text-xl font-semibold mb-4">Console</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`${site.isActive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>●</span>
                  <span className="font-medium">Connected Domain: {site.domain}</span>
                </div>
                <div className="pl-6 text-sm text-muted-foreground">
                  <p><span className="font-medium">Status:</span> {site.isActive ? "Active" : "Inactive"}</p>
                </div>
              </div>
              <div className="pt-4 border-t">
                <SyncBaselineButton />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="p-4 bg-muted rounded-md">
                  <p className="text-sm text-muted-foreground">Blog Posts</p>
                  <p className="text-2xl font-bold">{blogPostCount}</p>
                </div>
                <div className="p-4 bg-muted rounded-md">
                  <p className="text-sm text-muted-foreground">Tool Runs</p>
                  <p className="text-2xl font-bold">{autopilotRunCount}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Content Generation Tile */}
        {hasShopify && (
          <div className="bg-card p-8 rounded-lg border mb-6">
            <h2 className="text-xl font-semibold mb-4">Content Generation</h2>
            <ContentGeneration />
          </div>
        )}

        {/* Disconnect Shopify Button */}
        {hasShopify && (
          <div className="bg-card p-8 rounded-lg border">
            <h2 className="text-xl font-semibold mb-4">Settings</h2>
            <DisconnectShopifyButton />
          </div>
        )}

        {/* Empty state when not connected - no install-enforcement messaging */}
        {!hasShopify && (
          <div className="bg-card p-8 rounded-lg border">
            <h2 className="text-xl font-semibold mb-4">Dashboard</h2>
            <p className="text-muted-foreground">
              Connect your Shopify store to get started.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}

