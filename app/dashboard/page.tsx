import { auth, currentUser } from "@clerk/nextjs/server"
import { UserButton } from "@clerk/nextjs"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { SyncBaselineButton } from "@/components/sync-baseline-button"
import { DisconnectShopifyButton } from "@/components/disconnect-shopify-button"
import { SeedKeywordsButton } from "@/components/seed-keywords-button"
import { KeywordsList } from "@/components/keywords-list"
import { TestContentGenerate } from "@/components/test-content-generate"
import { CleanupDuplicatesButton } from "@/components/cleanup-duplicates-button"

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { shopify?: string; msg?: string }
}) {
  const { userId } = await auth()

  // Redirect to login if not authenticated
  if (!userId) {
    redirect("/login")
  }

  // Get or create user in database
  let user = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: { sites: true },
  })

  // If user doesn't exist in database, create them
  // This happens on first login after Clerk authentication
  if (!user) {
    // Get user info from Clerk
    const clerkUser = await currentUser()
    
    if (!clerkUser) {
      redirect("/login")
    }

    // Get primary email
    const primaryEmail = clerkUser.emailAddresses.find(
      (email) => email.id === clerkUser.primaryEmailAddressId
    )?.emailAddress || clerkUser.emailAddresses[0]?.emailAddress || ''

    // Create user in database
    user = await prisma.user.create({
      data: {
        clerkId: userId,
        email: primaryEmail,
        name: clerkUser.firstName && clerkUser.lastName 
          ? `${clerkUser.firstName} ${clerkUser.lastName}`
          : clerkUser.firstName || clerkUser.lastName || null,
      },
      include: { sites: true },
    })
  }

  const site = user.sites[0] // MVP: one site per user
  const hasShopify = !!site?.shopifyAccessToken

  // Get keyword count
  const keywordCount = site
    ? await prisma.keyword.count({
        where: { siteId: site.id },
      })
    : 0

  return (
    <main className="flex min-h-screen flex-col p-24">
      <div className="z-10 max-w-7xl w-full">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <UserButton afterSignOutUrl="/login" />
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

        {/* Shopify Connection Status */}
        <div className="bg-card p-8 rounded-lg border mb-6">
          <h2 className="text-xl font-semibold mb-4">Shopify Store</h2>
          
          {hasShopify ? (
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-green-600 dark:text-green-400">●</span>
                  <span className="font-medium">Connected</span>
                </div>
                <div className="pl-6 space-y-1 text-sm text-muted-foreground">
                  <p><span className="font-medium">Domain:</span> {site.domain}</p>
                  <p><span className="font-medium">Store URL:</span> {site.shopifyStoreUrl}</p>
                  <p><span className="font-medium">Status:</span> {site.isActive ? "Active" : "Inactive"}</p>
                </div>
              </div>
              <div className="pt-4 border-t space-y-4">
                <div>
                  <h3 className="text-sm font-semibold mb-2">Baseline Data Sync</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Sync products, collections, and blog articles from your Shopify store.
                  </p>
                  <SyncBaselineButton />
                </div>
                <div className="pt-4 border-t">
                  <h3 className="text-sm font-semibold mb-2">Keyword Seeding</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Generate SEO keywords for all products and collections using AI.
                  </p>
                  <SeedKeywordsButton />
                </div>
                <div className="pt-4 border-t">
                  <h3 className="text-sm font-semibold mb-2">Cleanup Duplicate Keywords</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Remove excess keywords (keeps 2 oldest per page). The seeding logic now prevents duplicates, but this cleans up old ones.
                  </p>
                  <CleanupDuplicatesButton />
                </div>
                <div className="pt-4 border-t">
                  <h3 className="text-sm font-semibold mb-2">Disconnect Store</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Disconnect this Shopify store to connect a different one.
                  </p>
                  <DisconnectShopifyButton />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Connect your Shopify store to get started with SEO automation.
              </p>
              <a
                href="/dashboard/connect-shopify"
                className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                Connect Shopify Store
              </a>
            </div>
          )}
        </div>

        {/* Additional Dashboard Content */}
        <div className="bg-card p-8 rounded-lg border mb-6">
          <h2 className="text-xl font-semibold mb-4">Overview</h2>
          <p className="text-muted-foreground mb-4">
            Welcome to your dashboard! {hasShopify ? "Your Shopify store is connected and ready." : "Connect your Shopify store to begin."}
          </p>
          {hasShopify && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="p-4 bg-muted rounded-md">
                <p className="text-sm text-muted-foreground">Keywords</p>
                <p className="text-2xl font-bold">{keywordCount}</p>
              </div>
              <div className="p-4 bg-muted rounded-md">
                <p className="text-sm text-muted-foreground">Blog Posts</p>
                <p className="text-2xl font-bold">0</p>
              </div>
              <div className="p-4 bg-muted rounded-md">
                <p className="text-sm text-muted-foreground">Autopilot Runs</p>
                <p className="text-2xl font-bold">0</p>
              </div>
            </div>
          )}
        </div>

        {/* Content Generation Test */}
        {hasShopify && (
          <div className="bg-card p-8 rounded-lg border mb-6">
            <h2 className="text-xl font-semibold mb-4">Content Generation Test</h2>
            <TestContentGenerate />
          </div>
        )}

        {/* Keywords Section */}
        {hasShopify && (
          <div className="bg-card p-8 rounded-lg border">
            <h2 className="text-xl font-semibold mb-4">Keywords</h2>
            <KeywordsList />
          </div>
        )}
      </div>
    </main>
  )
}

