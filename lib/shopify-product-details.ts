import { decryptToken } from './shopify-oauth'

/**
 * Fetches product details including description from Shopify
 */
export async function fetchProductDescription(
  shop: string,
  accessToken: string,
  productId: string
): Promise<string | null> {
  const apiVersion = '2024-10'
  const url = `https://${shop}/admin/api/${apiVersion}/products/${productId}.json?fields=body_html`

  try {
    const response = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      console.warn(`[Product Details] Failed to fetch product ${productId}: ${response.status}`)
      return null
    }

    const data = await response.json()
    // Extract text from HTML description
    const bodyHtml = data.product?.body_html || ''
    
    if (!bodyHtml) {
      return null
    }

    // Simple HTML to text conversion (remove tags)
    const text = bodyHtml
      .replace(/<[^>]*>/g, ' ') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .substring(0, 1000) // Limit length

    return text || null
  } catch (error) {
    console.error(`[Product Details] Error fetching product ${productId}:`, error)
    return null
  }
}

