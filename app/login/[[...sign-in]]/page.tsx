import { SignIn } from "@clerk/nextjs"
import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

/**
 * Catch-all route for Clerk sign-in pages
 * Handles routes like:
 * - /login
 * - /login/factor-one (MFA)
 * - /login/sso-callback
 * - /login/continue (password reset, etc.)
 * - etc.
 * 
 * IMPORTANT: If user accesses login page directly (not from Shopify installation),
 * they must install the app from Shopify App Store first.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined }
}) {
  const { userId } = await auth()

  // Redirect to dashboard if already logged in
  if (userId) {
    redirect("/dashboard")
  }

  // Check if this request is coming from Shopify installation flow
  // Shopify sends `shop` parameter in URL when redirecting from App Store/Partners
  const shopParam = searchParams?.shop as string | undefined
  const hostParam = searchParams?.host as string | undefined
  
  // If no shop/host parameter, user accessed login directly
  // Redirect them to understand they need to install from Shopify first
  if (!shopParam && !hostParam) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <div className="z-10 max-w-2xl w-full">
          <div className="bg-card p-8 rounded-lg border text-center space-y-6">
            <h1 className="text-3xl font-bold">Install from Shopify App Store</h1>
            <p className="text-muted-foreground text-lg">
              This app must be installed from the Shopify App Store before you can sign in.
            </p>
            <div className="space-y-4">
              <div className="p-6 bg-muted rounded-md text-left">
                <p className="font-medium mb-3">To get started:</p>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>Go to the <a href="https://apps.shopify.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">Shopify App Store</a></li>
                  <li>Search for this app or go to your Partners dashboard</li>
                  <li>Click &quot;Install&quot; or &quot;Get&quot; on the app listing</li>
                  <li>Follow Shopify&apos;s installation flow</li>
                  <li>You&apos;ll be redirected here automatically after installation</li>
                </ol>
              </div>
              <p className="text-sm text-muted-foreground">
                <strong>Note:</strong> Installation must be initiated from Shopify&apos;s App Store or Partners dashboard for security and compliance.
              </p>
            </div>
          </div>
        </div>
      </main>
    )
  }

  // If shop/host parameter exists, this is likely from Shopify installation flow
  // Allow normal sign-in process
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-md w-full">
        <div className="flex justify-center">
          <SignIn
            afterSignInUrl="/dashboard"
            appearance={{
              elements: {
                rootBox: "mx-auto",
              },
            }}
          />
        </div>
      </div>
    </main>
  )
}

