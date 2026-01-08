import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { ConnectShopifyForm } from "@/components/connect-shopify-form"

export default async function ConnectShopifyPage() {
  const { userId } = await auth()

  if (!userId) {
    redirect("/login")
  }

  // Get user from database
  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: { sites: true },
  })

  if (!user) {
    redirect("/dashboard")
  }

  // Check if user already has a connected site
  const hasSite = user.sites.length > 0

  return (
    <main className="flex min-h-screen flex-col p-24">
      <div className="z-10 max-w-2xl w-full mx-auto">
        <h1 className="text-3xl font-bold mb-8">Connect Your Shopify Store</h1>
        
        {hasSite ? (
          <div className="bg-card p-8 rounded-lg border">
            <div className="mb-4">
              <h2 className="text-xl font-semibold mb-2">Store Connected</h2>
              <p className="text-muted-foreground mb-4">
                Your Shopify store is already connected.
              </p>
              <div className="space-y-2">
                <p className="text-sm">
                  <span className="font-medium">Domain:</span> {user.sites[0].domain}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Store URL:</span> {user.sites[0].shopifyStoreUrl}
                </p>
              </div>
            </div>
            <a
              href="/dashboard"
              className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Go to Dashboard
            </a>
          </div>
        ) : (
          <ConnectShopifyForm />
        )}
      </div>
    </main>
  )
}


