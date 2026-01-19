/**
 * Shopify Webhook HMAC Verification
 * Verifies webhook requests from Shopify using HMAC-SHA256 signature
 * 
 * Required for all Shopify webhook endpoints for security
 * 
 * This utility function:
 * - Uses the raw request body (not parsed JSON)
 * - Uses the app's Shopify API secret
 * - Computes HMAC SHA256
 * - Compares against the 'X-Shopify-Hmac-Sha256' header
 * - Uses timing-safe comparison to prevent timing attacks
 * - Throws an error if verification fails
 */

import crypto from 'crypto'

const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET

/**
 * Custom error class for webhook verification failures
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
 * This function:
 * - Reads the raw request body (Buffer or string)
 * - Computes HMAC-SHA256 using SHOPIFY_API_SECRET
 * - Compares against X-Shopify-Hmac-Sha256 header using timing-safe comparison
 * - Throws ShopifyWebhookVerificationError if verification fails
 * 
 * @param rawBody - Raw request body (as Buffer or string) - MUST be unparsed
 * @param hmacHeader - X-Shopify-Hmac-Sha256 header value from request headers
 * @throws ShopifyWebhookVerificationError if:
 *   - SHOPIFY_API_SECRET is not set
 *   - HMAC header is missing
 *   - HMAC signature does not match
 */
export function verifyShopifyWebhook(
  rawBody: Buffer | string,
  hmacHeader: string | null
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
  const bodyBuffer = typeof rawBody === 'string' 
    ? Buffer.from(rawBody, 'utf-8') 
    : rawBody

  // Compute HMAC-SHA256 using the app's Shopify API secret
  const calculatedHmac = crypto
    .createHmac('sha256', SHOPIFY_API_SECRET)
    .update(bodyBuffer)
    .digest('base64')

  // Compare HMACs using timing-safe comparison to prevent timing attacks
  // This prevents attackers from inferring the correct HMAC through timing analysis
  const isValid = crypto.timingSafeEqual(
    Buffer.from(calculatedHmac),
    Buffer.from(hmacHeader)
  )

  // Throw error if verification fails
  if (!isValid) {
    throw new ShopifyWebhookVerificationError(
      'HMAC signature verification failed. Webhook may be from an untrusted source.',
      401
    )
  }

  // If we reach here, verification succeeded
  // No return value needed - function throws on failure
}

