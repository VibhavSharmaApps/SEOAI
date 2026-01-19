import { NextResponse } from 'next/server'
import { 
  verifyShopifyWebhook, 
  ShopifyWebhookVerificationError 
} from '@/lib/shopify-webhook-verification'

// Force dynamic rendering (webhooks are always dynamic)
export const dynamic = 'force-dynamic'

// Use Node.js runtime for webhook routes
export const runtime = 'nodejs'

/**
 * RAW BODY ACCESS - WEBHOOK ROUTES ONLY
 * 
 * This route uses raw body access for HMAC verification.
 * Other API routes (/api/*) continue to use request.json() normally.
 * 
 * How raw body is obtained:
 * 1. Request body is a stream (not pre-parsed)
 * 2. Call request.arrayBuffer() to read raw bytes
 * 3. Convert ArrayBuffer to Buffer for HMAC verification
 * 4. Stream is consumed - cannot be read again
 * 5. Parse JSON from the same buffer (after verification)
 * 
 * Implementation:
 * ```typescript
 * const rawBody = await request.arrayBuffer()  // Read raw bytes from stream
 * const bodyBuffer = Buffer.from(rawBody)       // Convert to Buffer
 * verifyShopifyWebhook(bodyBuffer, hmacHeader) // Verify using raw bytes
 * const payload = JSON.parse(bodyBuffer.toString('utf-8')) // Parse after verification
 * ```
 * 
 * Why this works:
 * - Next.js App Router provides body as a stream
 * - Calling arrayBuffer() consumes the stream
 * - No global body parser affects this route
 * - Other routes use request.json() and are unaffected
 * 
 * IMPORTANT: Do NOT call request.json() - it would consume the stream.
 *            Use arrayBuffer() first, then parse from the buffer.
 */

/**
 * POST /api/webhooks/customers/redact
 * 
 * Mandatory Shopify webhook for customer data deletion requests (GDPR/CCPA compliance)
 * 
 * This webhook is triggered when a customer requests deletion of their data.
 * 
 * Requirements:
 * - Must verify HMAC signature
 * - Must return HTTP 200 OK
 * - Must log the webhook payload
 * 
 * Note: This endpoint does NOT perform data mutation - it only logs the request.
 * Actual data deletion logic should be implemented separately if needed.
 */
export async function POST(request: Request) {
  const timestamp = new Date().toISOString()
  
  try {
    // STEP 1: Get webhook topic (log immediately to confirm receipt)
    const topic = request.headers.get('X-Shopify-Topic')
    const shopDomain = request.headers.get('X-Shopify-Shop-Domain')
    const webhookId = request.headers.get('X-Shopify-Webhook-Id')
    
    // Log: Webhook topic received
    console.log(`[Webhook ${timestamp}] Topic received: ${topic}`, {
      shop: shopDomain,
      webhookId,
    })

    // STEP 2: Read raw body FIRST (before any processing)
    // IMPORTANT: Must read as raw bytes, not JSON, for HMAC verification
    // Do NOT parse JSON before HMAC verification
    const rawBody = await request.arrayBuffer()
    const bodyBuffer = Buffer.from(rawBody)

    // STEP 3: Get HMAC signature from headers
    const hmacHeader = request.headers.get('X-Shopify-Hmac-Sha256')

    // STEP 4: Verify HMAC signature IMMEDIATELY
    // This MUST happen before any JSON parsing or data processing
    // Throws ShopifyWebhookVerificationError if verification fails
    verifyShopifyWebhook(bodyBuffer, hmacHeader)

    // Log: HMAC verification passed
    console.log(`[Webhook ${timestamp}] HMAC verification passed`, {
      topic,
      shop: shopDomain,
    })

    // STEP 5: Parse JSON payload ONLY after verification succeeds
    // Note: We don't log the full payload to avoid storing sensitive data
    let payload: any = null
    try {
      payload = JSON.parse(bodyBuffer.toString('utf-8'))
      // Only log non-sensitive metadata (no customer emails, names, or personal data)
      const payloadSize = bodyBuffer.length
      console.log(`[Webhook ${timestamp}] Payload parsed`, {
        topic,
        payloadSize,
        hasCustomerData: !!(payload?.customer || payload?.customer_id),
      })
    } catch (error) {
      console.warn(`[Webhook ${timestamp}] Failed to parse JSON payload:`, error)
      // Still return 200 OK even if JSON parsing fails (webhook was verified)
    }

    // STEP 6: Return 200 OK (required by Shopify)
    // Note: No data mutation is performed - this is just logging
    const response = NextResponse.json({ 
      success: true,
      message: 'Webhook received and verified',
      timestamp,
    }, { status: 200 })

    // Log: Response returned successfully
    console.log(`[Webhook ${timestamp}] Response returned successfully`, {
      topic,
      shop: shopDomain,
      statusCode: 200,
    })

    return response

  } catch (error) {
    // Handle webhook verification errors - REJECT immediately with 401
    if (error instanceof ShopifyWebhookVerificationError) {
      const topic = request.headers.get('X-Shopify-Topic') || 'unknown'
      console.error(`[Webhook ${timestamp}] HMAC verification failed`, {
        topic,
        error: error.message,
      })
      // Reject invalid requests immediately - do not process any data
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: error.statusCode }
      )
    }

    // Handle other errors (still return 200 OK to prevent Shopify from retrying)
    const topic = request.headers.get('X-Shopify-Topic') || 'unknown'
    console.error(`[Webhook ${timestamp}] Error processing webhook`, {
      topic,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return NextResponse.json({ 
      success: false,
      error: 'Error processing webhook',
      timestamp,
    }, { status: 200 })
  }
}

