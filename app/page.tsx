import { redirect } from 'next/navigation'

/**
 * Public Landing Page
 * This page is accessible without authentication (no Shopify OAuth, no Clerk)
 * Contains marketing content and a single CTA to install the app on Shopify
 * 
 * IMPORTANT: If accessed with 'host' query parameter (embedded context),
 * redirects to /dashboard to ensure embedded users see the app UI.
 */
export default function LandingPage({
  searchParams,
}: {
  searchParams: { host?: string }
}) {
  // Detect embedded context - if 'host' parameter is present, user is in Shopify Admin
  // Redirect to dashboard to show the app UI instead of landing page
  if (searchParams.host) {
    redirect('/dashboard')
  }

  // Get Shopify App Store listing URL or Partner install link from environment variable
  // Format: App Store listing URL (e.g., https://apps.shopify.com/rankifyeo)
  // Or: Partner install link (e.g., https://partners.shopify.com/.../apps/.../install)
  // Falls back to general App Store if not set
  const installUrl = process.env.NEXT_PUBLIC_SHOPIFY_INSTALL_URL || 'https://apps.shopify.com'

  return (
    <main className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <section className="flex-1 flex items-center justify-center bg-gradient-to-b from-background to-muted/20 px-4 py-24">
        <div className="max-w-4xl w-full text-center space-y-8">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
            RankifyEO
          </h1>
          
          <h2 className="text-3xl md:text-4xl font-semibold">
            Generate SEO-relevant blog drafts for your Shopify store
          </h2>
          
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
            Create editable blog drafts based on your store and target keywords — directly inside Shopify.
          </p>

          <div className="pt-8 space-y-4">
            <a
              href={installUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-8 py-4 bg-primary text-primary-foreground text-lg font-semibold rounded-lg hover:bg-primary/90 transition-colors shadow-lg hover:shadow-xl"
            >
              Install on Shopify
            </a>
            <p className="text-sm text-muted-foreground">
              Works entirely inside Shopify Admin. No external accounts required.
            </p>
            
            {/* Development/Testing: Direct link to dashboard */}
            <div className="pt-4">
              <a
                href="/dashboard"
                className="inline-block px-6 py-3 bg-secondary text-secondary-foreground text-base font-medium rounded-lg hover:bg-secondary/80 transition-colors border border-border"
              >
                Go to Dashboard (Testing)
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* What the app does */}
      <section className="bg-card border-t py-24 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">
            What this app helps you do
          </h2>
          
          <ul className="space-y-6 mt-8">
            <li className="flex items-start">
              <span className="mr-4 text-primary">•</span>
              <p className="text-lg text-muted-foreground">
                Generates SEO-relevant blog drafts based on selected keywords
              </p>
            </li>
            <li className="flex items-start">
              <span className="mr-4 text-primary">•</span>
              <p className="text-lg text-muted-foreground">
                Uses your store&apos;s context to tailor draft content
              </p>
            </li>
            <li className="flex items-start">
              <span className="mr-4 text-primary">•</span>
              <p className="text-lg text-muted-foreground">
                Saves drafts to Shopify so you can review and edit before publishing
              </p>
            </li>
            <li className="flex items-start">
              <span className="mr-4 text-primary">•</span>
              <p className="text-lg text-muted-foreground">
                Reduces the time spent starting blog content from scratch
              </p>
            </li>
          </ul>

          <p className="text-center mt-8 text-muted-foreground italic">
            The app does not publish content automatically.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-muted/30 py-24 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">
            How it works
          </h2>
          
          <ol className="space-y-6 mt-8 list-decimal list-inside">
            <li className="text-lg text-muted-foreground">
              Install the app from the Shopify App Store
            </li>
            <li className="text-lg text-muted-foreground">
              Select keywords you want to write about
            </li>
            <li className="text-lg text-muted-foreground">
              The app generates blog drafts you can review and edit in Shopify
            </li>
          </ol>

          <p className="text-center mt-8 text-muted-foreground">
            No setup beyond installation.
          </p>
        </div>
      </section>

      {/* Who this is for */}
      <section className="bg-card border-t py-24 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">
            Who this is for
          </h2>
          
          <ul className="space-y-6 mt-8">
            <li className="flex items-start">
              <span className="mr-4 text-primary">•</span>
              <p className="text-lg text-muted-foreground">
                Shopify merchants who want help starting SEO blog content
              </p>
            </li>
            <li className="flex items-start">
              <span className="mr-4 text-primary">•</span>
              <p className="text-lg text-muted-foreground">
                Small teams that don&apos;t want to write blog drafts from scratch
              </p>
            </li>
            <li className="flex items-start">
              <span className="mr-4 text-primary">•</span>
              <p className="text-lg text-muted-foreground">
                Stores experimenting with content without committing to full automation
              </p>
            </li>
          </ul>
        </div>
      </section>

      {/* What this app does NOT do - Critical Section */}
      <section className="bg-red-50 dark:bg-red-950/20 border-t border-red-200 dark:border-red-900 py-24 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">
            What this app does not do
          </h2>
          
          <ul className="space-y-6 mt-8">
            <li className="flex items-start">
              <span className="mr-4 text-red-600 dark:text-red-400">•</span>
              <p className="text-lg text-muted-foreground">
                It does not guarantee search rankings or traffic
              </p>
            </li>
            <li className="flex items-start">
              <span className="mr-4 text-red-600 dark:text-red-400">•</span>
              <p className="text-lg text-muted-foreground">
                It does not automatically publish blog posts
              </p>
            </li>
            <li className="flex items-start">
              <span className="mr-4 text-red-600 dark:text-red-400">•</span>
              <p className="text-lg text-muted-foreground">
                It does not manage content strategy or editorial planning
              </p>
            </li>
          </ul>
        </div>
      </section>

      {/* Data & permissions transparency */}
      <section className="bg-muted/30 py-24 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">
            Data access and permissions
          </h2>
          
          <p className="text-lg text-muted-foreground text-center mt-8">
            The app only accesses store data required to generate blog drafts and save them to your Shopify blog.
          </p>
          <p className="text-lg text-muted-foreground text-center mt-4">
            It does not access orders, payments, or customer data.
          </p>
        </div>
      </section>
    </main>
  )
}
