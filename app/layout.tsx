import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { ShopifyAppBridgeProvider } from "@/components/shopify-app-bridge-provider"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "RankifyEO",
  description: "Generate SEO-relevant blog drafts for your Shopify store",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ShopifyAppBridgeProvider>
          {children}
        </ShopifyAppBridgeProvider>
      </body>
    </html>
  )
}

