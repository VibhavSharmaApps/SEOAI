import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { ClerkProvider } from "@clerk/nextjs"
import { ShopifyAppBridgeProvider } from "@/components/shopify-app-bridge-provider"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "SEOAI",
  description: "SEO AI Application",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider
      signInUrl="/login"
      signUpUrl="/login"
      afterSignInUrl="/dashboard"
      afterSignUpUrl="/dashboard"
    >
      <html lang="en">
        <body className={inter.className}>
          <ShopifyAppBridgeProvider>
            {children}
          </ShopifyAppBridgeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}

