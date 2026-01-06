import crypto from 'crypto'

// Encryption key - MUST be set in environment variables
// Generate a secure key: openssl rand -hex 32
// Key must be 64 characters (32 bytes in hex)
const ENCRYPTION_KEY = process.env.SHOPIFY_ENCRYPTION_KEY

if (!ENCRYPTION_KEY) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SHOPIFY_ENCRYPTION_KEY environment variable is required in production')
  }
  // In development, generate a warning but allow continuation
  console.warn('⚠️  SHOPIFY_ENCRYPTION_KEY not set. Generate one with: openssl rand -hex 32')
}

if (ENCRYPTION_KEY && ENCRYPTION_KEY.length !== 64) {
  throw new Error('SHOPIFY_ENCRYPTION_KEY must be exactly 64 characters (32 bytes in hex)')
}
const ALGORITHM = 'aes-256-cbc'

/**
 * Encrypts a token for secure storage
 */
export function encryptToken(token: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error('SHOPIFY_ENCRYPTION_KEY is required for token encryption')
  }
  
  if (ENCRYPTION_KEY.length !== 64) {
    throw new Error(`SHOPIFY_ENCRYPTION_KEY must be exactly 64 characters (32 bytes in hex). Current length: ${ENCRYPTION_KEY.length}`)
  }
  
  // Validate hex format
  if (!/^[0-9a-fA-F]{64}$/.test(ENCRYPTION_KEY)) {
    throw new Error('SHOPIFY_ENCRYPTION_KEY must be a valid hexadecimal string (64 hex characters)')
  }
  
  try {
    const keyBuffer = Buffer.from(ENCRYPTION_KEY, 'hex')
    if (keyBuffer.length !== 32) {
      throw new Error(`Invalid key length: expected 32 bytes, got ${keyBuffer.length}`)
    }
    
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv)
    
    let encrypted = cipher.update(token, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    return iv.toString('hex') + ':' + encrypted
  } catch (error) {
    if (error instanceof Error && error.message.includes('Invalid key length')) {
      throw new Error(`Invalid SHOPIFY_ENCRYPTION_KEY: Key must be exactly 64 hexadecimal characters. Current length: ${ENCRYPTION_KEY.length}. Generate a new key with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
    }
    throw error
  }
}

/**
 * Decrypts a token from storage
 */
export function decryptToken(encryptedToken: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error('SHOPIFY_ENCRYPTION_KEY is required for token decryption')
  }
  
  if (ENCRYPTION_KEY.length !== 64) {
    throw new Error(`SHOPIFY_ENCRYPTION_KEY must be exactly 64 characters (32 bytes in hex). Current length: ${ENCRYPTION_KEY.length}`)
  }
  
  // Validate hex format
  if (!/^[0-9a-fA-F]{64}$/.test(ENCRYPTION_KEY)) {
    throw new Error('SHOPIFY_ENCRYPTION_KEY must be a valid hexadecimal string (64 hex characters)')
  }
  
  try {
    const keyBuffer = Buffer.from(ENCRYPTION_KEY, 'hex')
    if (keyBuffer.length !== 32) {
      throw new Error(`Invalid key length: expected 32 bytes, got ${keyBuffer.length}`)
    }
    
    const parts = encryptedToken.split(':')
    const iv = Buffer.from(parts[0], 'hex')
    const encrypted = parts[1]
    
    const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv)
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  } catch (error) {
    if (error instanceof Error && error.message.includes('Invalid key length')) {
      throw new Error(`Invalid SHOPIFY_ENCRYPTION_KEY: Key must be exactly 64 hexadecimal characters. Current length: ${ENCRYPTION_KEY.length}. Generate a new key with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
    }
    throw error
  }
}

/**
 * Generates Shopify OAuth authorization URL
 * Redirect URI is derived from NEXT_PUBLIC_APP_URL environment variable
 */
export function getShopifyAuthUrl(shop: string): string {
  const clientId = process.env.SHOPIFY_API_KEY
  const scopes = 'read_content,write_content,read_products' // Adjust scopes as needed
  
  if (!clientId) {
    throw new Error('SHOPIFY_API_KEY is not set')
  }
  
  // Runtime guard: NEXT_PUBLIC_APP_URL is required in production
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (!appUrl) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('NEXT_PUBLIC_APP_URL environment variable is required in production')
    }
    // In development, fallback to localhost
    console.warn('⚠️  NEXT_PUBLIC_APP_URL not set. Using localhost fallback for development.')
  }
  
  // Construct redirect URI from environment variable
  const baseUrl = appUrl || 'http://localhost:3000'
  const redirectUri = `${baseUrl.replace(/\/$/, '')}/api/shopify/callback`
  
  console.log(`[getShopifyAuthUrl] Input parameters:`)
  console.log(`  - shop: ${shop}`)
  console.log(`  - redirect_uri: ${redirectUri} (derived from NEXT_PUBLIC_APP_URL: ${appUrl || 'localhost fallback'})`)
  console.log(`  - client_id: ${clientId.substring(0, 10)}... (truncated)`)
  console.log(`  - scopes: ${scopes}`)
  
  const params = new URLSearchParams({
    client_id: clientId,
    scope: scopes,
    redirect_uri: redirectUri,
  })
  
  const authUrl = `https://${shop}/admin/oauth/authorize?${params.toString()}`
  
  console.log(`[getShopifyAuthUrl] Generated OAuth URL: ${authUrl}`)
  
  return authUrl
}

/**
 * Exchanges authorization code for access token
 */
export async function exchangeCodeForToken(
  shop: string,
  code: string
): Promise<{ access_token: string; scope: string }> {
  const clientId = process.env.SHOPIFY_API_KEY
  const clientSecret = process.env.SHOPIFY_API_SECRET
  
  if (!clientId || !clientSecret) {
    throw new Error('Shopify API credentials are not set')
  }
  
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  })
  
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to exchange code for token: ${error}`)
  }
  
  return response.json()
}

/**
 * Validates Shopify shop domain format
 */
export function validateShopDomain(shop: string): string {
  // Remove protocol and trailing slashes
  let domain = shop.replace(/^https?:\/\//, '').replace(/\/$/, '')
  
  // Remove .myshopify.com if present (we'll add it)
  domain = domain.replace(/\.myshopify\.com$/, '')
  
  // Add .myshopify.com if it's just the shop name
  if (!domain.includes('.')) {
    domain = `${domain}.myshopify.com`
  }
  
  return domain
}

