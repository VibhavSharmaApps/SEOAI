/**
 * Shopify Session Token Verification
 * Validates JWT session tokens from App Bridge requests
 * 
 * Production-safe implementation using Shopify's official JWT verification
 */

import { shopifyApi, InvalidJwtError, ApiVersion } from '@shopify/shopify-api'

const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET

if (!SHOPIFY_API_KEY || !SHOPIFY_API_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SHOPIFY_API_KEY and SHOPIFY_API_SECRET must be set for session token verification')
  }
  console.warn('⚠️  SHOPIFY_API_KEY or SHOPIFY_API_SECRET not set. Session token verification will fail.')
}

// Lazy initialization of Shopify API instance
// Only initialize when needed (at runtime), not during build
let shopify: ReturnType<typeof shopifyApi> | null = null

/**
 * Gets or initializes the Shopify API instance for token verification
 * Lazy initialization prevents build-time errors from missing runtime adapters
 */
function getShopifyInstance(): ReturnType<typeof shopifyApi> {
  if (!shopify) {
    if (!SHOPIFY_API_KEY || !SHOPIFY_API_SECRET) {
      throw new Error('SHOPIFY_API_KEY and SHOPIFY_API_SECRET must be set for session token verification')
    }
    
    shopify = shopifyApi({
      apiKey: SHOPIFY_API_KEY,
      apiSecretKey: SHOPIFY_API_SECRET,
      scopes: [], // Not needed for token verification
      hostName: process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, '').split('/')[0] || 'localhost',
      apiVersion: ApiVersion.October24, // Use enum value for 2024-10 API version
      isEmbeddedApp: true, // Required for session token verification
    })
  }
  
  return shopify
}

export interface ShopifySessionInfo {
  shop: string
  userId?: string
  sessionId?: string
  iat?: number
  exp?: number
}

export class ShopifySessionTokenError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401
  ) {
    super(message)
    this.name = 'ShopifySessionTokenError'
    Object.setPrototypeOf(this, ShopifySessionTokenError.prototype)
  }
}

/**
 * Verifies Shopify session token from Authorization header
 * Validates signature, expiration, audience, and issuer
 * 
 * @param authHeader - Authorization header value (e.g., "Bearer <token>")
 * @returns Decoded session token with shop and user information
 * @throws ShopifySessionTokenError if token is invalid, expired, or missing
 */
export async function verifyShopifySessionToken(
  authHeader: string | null | undefined
): Promise<ShopifySessionInfo> {
  // Log token verification attempt
  const timestamp = new Date().toISOString()
  const logPrefix = `[Token Verification ${timestamp}]`
  console.log(`${logPrefix} Starting token verification`)

  // Extract token from Authorization header
  if (!authHeader) {
    console.warn(`${logPrefix} ❌ Authorization header missing`)
    throw new ShopifySessionTokenError('Authorization header missing', 401)
  }

  if (!authHeader.startsWith('Bearer ')) {
    console.warn(`${logPrefix} ❌ Authorization header format invalid (expected "Bearer <token>")`)
    throw new ShopifySessionTokenError('Authorization header must start with "Bearer"', 401)
  }

  const token = authHeader.slice(7).trim()

  if (!token) {
    console.warn(`${logPrefix} ❌ Session token missing (empty after "Bearer ")`)
    throw new ShopifySessionTokenError('Session token missing', 401)
  }

  console.log(`${logPrefix} ✓ Token extracted (length: ${token.length})`)

  // Get Shopify API instance (lazy initialization - only when needed at runtime)
  const shopifyInstance = getShopifyInstance()

  try {
    console.log(`${logPrefix} Verifying JWT signature, expiration, issuer, audience...`)
    
    // Use Shopify's official JWT verification
    // This validates:
    // - Signature using Shopify public keys (via API secret)
    // - Expiration (exp claim)
    // - Issuer (iss claim)
    // - Audience (aud claim - must match SHOPIFY_API_KEY)
    // - Shop domain (dest claim)
    const decoded = await shopifyInstance.session.decodeSessionToken(token)

    console.log(`${logPrefix} ✓ JWT signature valid`)

    // Extract shop domain from dest claim (required)
    // Format: "https://mystore.myshopify.com/admin" -> "mystore.myshopify.com"
    let shop = decoded.dest?.replace(/^https:\/\//, '').replace(/\/.*$/, '')
    
    if (!shop) {
      console.warn(`${logPrefix} ❌ Session token missing shop domain (dest claim)`)
      throw new ShopifySessionTokenError('Session token missing shop domain (dest claim)', 401)
    }

    // Ensure shop domain is normalized (e.g., "mystore.myshopify.com")
    // Handle both "mystore.myshopify.com" and "mystore" formats
    if (!shop.endsWith('.myshopify.com')) {
      shop = `${shop}.myshopify.com`
    }

    // Extract user ID from sub claim (optional, may be undefined for offline tokens)
    const userId = decoded.sub

    // Validate that the audience matches our API key (additional security check)
    const expectedAudience = SHOPIFY_API_KEY
    if (decoded.aud && decoded.aud !== expectedAudience) {
      console.warn(`${logPrefix} ❌ Audience mismatch (expected: ${expectedAudience}, got: ${decoded.aud})`)
      throw new ShopifySessionTokenError('Session token audience mismatch', 401)
    }

    // Log token expiration info
    if (decoded.exp) {
      const expDate = new Date(decoded.exp * 1000)
      const now = new Date()
      const timeUntilExpiry = Math.floor((expDate.getTime() - now.getTime()) / 1000)
      console.log(`${logPrefix} ✓ Token valid until ${expDate.toISOString()} (${timeUntilExpiry}s remaining)`)
    }

    console.log(`${logPrefix} ✅ Token verification successful - Shop: ${shop}, User: ${userId || 'N/A'}`)

    return {
      shop,
      userId,
      sessionId: decoded.sid,
      iat: decoded.iat,
      exp: decoded.exp,
    }
  } catch (error) {
    // Handle specific Shopify JWT errors
    if (error instanceof InvalidJwtError) {
      // Invalid signature, expired, or malformed token
      console.error(`${logPrefix} ❌ Invalid JWT: ${error.message}`)
      throw new ShopifySessionTokenError(
        `Invalid or expired session token: ${error.message}`,
        401
      )
    }

    // Unknown error - log for debugging but don't expose details
    console.error(`${logPrefix} ❌ Unexpected error:`, error)
    throw new ShopifySessionTokenError(
      'Unable to verify session token',
      401
    )
  }
}

/**
 * Middleware helper for Next.js API routes
 * Verifies Shopify session token and attaches session info to request
 * 
 * @param request - Next.js Request object
 * @returns Session information with shop and user data
 * @throws ShopifySessionTokenError if verification fails
 */
export async function verifyShopifyRequest(
  request: Request
): Promise<ShopifySessionInfo> {
  const url = new URL(request.url)
  const method = request.method
  const timestamp = new Date().toISOString()
  
  console.log(`[Token Verification ${timestamp}] 🔒 Verifying request: ${method} ${url.pathname}`)
  
  const authHeader = request.headers.get('authorization')
  
  if (!authHeader) {
    console.warn(`[Token Verification ${timestamp}] ❌ No Authorization header in ${method} ${url.pathname}`)
  }
  
  const result = await verifyShopifySessionToken(authHeader)
  
  console.log(`[Token Verification ${timestamp}] ✅ Request authorized: ${method} ${url.pathname} - Shop: ${result.shop}`)
  
  return result
}

