"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export function ConnectShopifyForm() {
  const [shop, setShop] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!shop.trim()) {
      alert("Please enter your Shopify store domain")
      return
    }

    setIsLoading(true)

    try {
      // Redirect to OAuth initiation endpoint
      const authUrl = `/api/shopify/auth?shop=${encodeURIComponent(shop.trim())}`
      window.location.href = authUrl
    } catch (error) {
      console.error("Error initiating Shopify OAuth:", error)
      alert("Failed to connect Shopify store. Please try again.")
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-card p-8 rounded-lg border">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="shop" className="block text-sm font-medium mb-2">
            Shopify Store Domain
          </label>
          <input
            id="shop"
            type="text"
            value={shop}
            onChange={(e) => setShop(e.target.value)}
            placeholder="yourstore or yourstore.myshopify.com"
            className="w-full px-4 py-2 border rounded-md bg-background"
            disabled={isLoading}
            required
          />
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your store name (e.g., "mystore" or "mystore.myshopify.com")
          </p>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "Connecting..." : "Connect Shopify Store"}
        </button>
      </form>

      <div className="mt-6 p-4 bg-muted rounded-md">
        <h3 className="font-semibold mb-2">What happens next?</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
          <li>You'll be redirected to Shopify (you may need to log in)</li>
          <li><strong>Look for the authorization page</strong> - it will ask for permission</li>
          <li><strong>Click "Install app" or "Allow"</strong> to approve the connection</li>
          <li>You'll be automatically redirected back to your dashboard</li>
        </ol>
        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
          <p className="text-xs text-blue-800 dark:text-blue-200">
            <strong>Important:</strong> After clicking "Connect", look for Shopify's authorization page and click "Install app" or "Allow". Don't just close the tab!
          </p>
        </div>
      </div>
    </div>
  )
}

