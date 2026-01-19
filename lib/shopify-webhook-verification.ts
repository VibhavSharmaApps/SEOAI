/**
 * Shopify Webhook HMAC Verification Utility
 * 
 * Framework-agnostic utility for verifying Shopify webhook HMAC signatures.
 * Can be used with any Node.js web framework (Express, Next.js, Fastify, etc.).
 * 
 * Requirements:
 * - Accept raw body (Buffer)
 * - Accept HMAC header value
 * - Use timing-safe comparison
 * - Throw error on failure
 * - No framework-specific code
 * 
 * Usage:
 * ```typescript
 * import { verifyShopifyWebhook, ShopifyWebhookVerificationError } from './shopify-webhook-verification'
 * 
 * try {
 *   verifyShopifyWebhook(rawBodyBuffer, hmacHeader)
 *   // Verification succeeded - proceed with webhook processing
 * } catch (error) {
 *   if (error instanceof ShopifyWebhookVerificationError) {
 *     // Return 401 or 403
 *   }
 * }
 * ```
 */

import crypto from 'crypto'

const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET

/**
 * Custom error class for webhook verification failures
 * Framework-agnostic - can be used with any web framework
 */
export class ShopifyWebhookVerificationError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401
  ) {
    super(message)
    this.name = 'ShopifyWebhookVerificationError'
    Object.setPrototypeOf(this, ShopifyWebhookVerificationError.prototype)
  }
}

/**
 * Verifies Shopify webhook HMAC signature
 * 
 * Framework-agnostic utility function that:
 * - Accepts raw request body as Buffer (or string, converted to Buffer)
 * - Accepts HMAC header value from X-Shopify-Hmac-Sha256 header
 * - Computes HMAC-SHA256 using SHOPIFY_API_SECRET
 * - Uses timing-safe comparison to prevent timing attacks
 * - Throws ShopifyWebhookVerificationError on failure
 * 
 * @param rawBody - Raw request body as Buffer (or string, will be converted to Buffer)
 *                  MUST be unparsed raw bytes for accurate HMAC verification
 * @param hmacHeader - X-Shopify-Hmac-Sha256 header value from request headers
 *                    Can be null/undefined if header is missing
 * 
 * @throws ShopifyWebhookVerificationError if:
 *   - SHOPIFY_API_SECRET is not set (statusCode: 500)
 *   - HMAC header is missing (statusCode: 401)
 *   - HMAC signature does not match (statusCode: 401)
 * 
 * @example
 * ```typescript
 * // In Express.js
 * app.post('/webhook', async (req, res) => {
 *   const rawBody = Buffer.from(req.body)
 *   const hmacHeader = req.headers['x-shopify-hmac-sha256']
 *   
 *   try {
 *     verifyShopifyWebhook(rawBody, hmacHeader)
 *     res.status(200).json({ success: true })
 *   } catch (error) {
 *     if (error instanceof ShopifyWebhookVerificationError) {
 *       res.status(error.statusCode).json({ error: error.message })
 *     }
 *   }
 * })
 * 
 * // In Next.js App Router
 * export async function POST(request: Request) {
 *   const rawBody = await request.arrayBuffer()
 *   const bodyBuffer = Buffer.from(rawBody)
 *   const hmacHeader = request.headers.get('X-Shopify-Hmac-Sha256')
 *   
 *   try {
 *     verifyShopifyWebhook(bodyBuffer, hmacHeader)
 *     return NextResponse.json({ success: true }, { status: 200 })
 *   } catch (error) {
 *     if (error instanceof ShopifyWebhookVerificationError) {
 *       return NextResponse.json({ error: error.message }, { status: error.statusCode })
 *     }
 *   }
 * }
 * ```
 */
export function verifyShopifyWebhook(
  rawBody: Buffer | string,
  hmacHeader: string | null | undefined
): void {
  // Validate API secret is configured
  if (!SHOPIFY_API_SECRET) {
    throw new ShopifyWebhookVerificationError(
      'SHOPIFY_API_SECRET is not set. Cannot verify webhook signature.',
      500
    )
  }

  // Validate HMAC header is present
  if (!hmacHeader) {
    throw new ShopifyWebhookVerificationError(
      'Missing X-Shopify-Hmac-Sha256 header. Webhook signature verification failed.',
      401
    )
  }

  // Convert rawBody to Buffer if it's a string
  // IMPORTANT: Body must be raw (unparsed) for accurate HMAC verification
  // Framework-agnostic: accepts Buffer (preferred) or string
  const bodyBuffer = typeof rawBody === 'string' 
    ? Buffer.from(rawBody, 'utf-8') 
    : rawBody

  // Compute HMAC-SHA256 using the app's Shopify API secret
  // Framework-agnostic: uses Node.js crypto module (standard library)
  const calculatedHmac = crypto
    .createHmac('sha256', SHOPIFY_API_SECRET)
    .update(bodyBuffer)
    .digest('base64')

  // Compare HMACs using timing-safe comparison to prevent timing attacks
  // This prevents attackers from inferring the correct HMAC through timing analysis
  // Framework-agnostic: uses Node.js crypto.timingSafeEqual (standard library)
  const isValid = crypto.timingSafeEqual(
    Buffer.from(calculatedHmac),
    Buffer.from(hmacHeader)
  )

  // Throw error if verification fails
  // Framework-agnostic: throws error, caller handles response
  if (!isValid) {
    throw new ShopifyWebhookVerificationError(
      'HMAC signature verification failed. Webhook may be from an untrusted source.',
      401
    )
  }

  // If we reach here, verification succeeded
  // No return value needed - function throws on failure
  // Framework-agnostic: silent success, caller proceeds with webhook processing
}

