# Shopify OAuth Flow - End-to-End Trace

This document traces the complete Shopify OAuth flow through the codebase.

## Flow Overview

```
User Action → Form Submit → Auth Route → Shopify → Callback Route → Dashboard
```

## Step-by-Step Trace

### Step 1: User Initiates Connection
**File:** `components/connect-shopify-form.tsx`
**Function:** `handleSubmit()`
**Line:** 11-29

```typescript
// User enters shop domain and clicks "Connect Shopify Store"
const authUrl = `/api/shopify/auth?shop=${encodeURIComponent(shop.trim())}`
window.location.href = authUrl  // Redirects to API route
```

**What happens:**
- User enters shop domain (e.g., "mystore")
- Form submits to `/api/shopify/auth?shop=mystore`
- Browser redirects to the auth route

---

### Step 2: OAuth Authorization URL Construction
**File:** `app/api/shopify/auth/route.ts`
**Function:** `GET(request: Request)`
**Line:** 14-59

**Flow within this function:**

#### 2a. Authentication Check
```typescript
const { userId } = await auth()  // Verify user is logged in
```

#### 2b. Shop Domain Validation
```typescript
const shopDomain = validateShopDomain(shop)
```
**Calls:** `lib/shopify-oauth.ts` → `validateShopDomain()`
- Normalizes shop domain (adds `.myshopify.com` if needed)
- Returns: `mystore.myshopify.com`

#### 2c. Base URL Resolution
```typescript
const baseUrl = getAppUrl()
```
**Calls:** `lib/app-url.ts` → `getAppUrl()`

**URL Resolution Logic:**
1. **First priority:** `VERCEL_URL` environment variable
   - If set: `https://${process.env.VERCEL_URL}`
   - Example: `https://myapp.vercel.app`

2. **Second priority:** `NEXT_PUBLIC_APP_URL` environment variable
   - If set: Uses this value (trimmed)
   - Example: `https://myapp.vercel.app`

3. **Fallback:** `http://localhost:3000`
   - Used in local development

**Logging added:**
```typescript
console.log(`[getAppUrl] Resolved base URL: ${baseUrl} (source: ${source})`)
```

#### 2d. Redirect URI Construction
```typescript
const redirectUri = `${baseUrl.replace(/\/$/, '')}/api/shopify/callback`
```

**Construction:**
- Takes base URL (e.g., `https://myapp.vercel.app`)
- Removes trailing slash if present
- Appends `/api/shopify/callback`
- Result: `https://myapp.vercel.app/api/shopify/callback`

**Logging added:**
```typescript
console.log(`[Shopify OAuth Initiation] RESOLVED REDIRECT URI: ${redirectUri}`)
```

#### 2e. OAuth URL Generation
```typescript
const authUrl = getShopifyAuthUrl(shopDomain, redirectUri)
```
**Calls:** `lib/shopify-oauth.ts` → `getShopifyAuthUrl()`

**Function:** `lib/shopify-oauth.ts` → `getShopifyAuthUrl(shop: string, redirectUri: string)`
**Line:** 61-76

**What it does:**
1. Gets `SHOPIFY_API_KEY` from environment
2. Defines scopes: `read_content,write_content,read_products`
3. Creates URLSearchParams with:
   - `client_id`: Shopify API key
   - `scope`: Requested permissions
   - `redirect_uri`: The callback URL we constructed
4. Returns: `https://${shop}/admin/oauth/authorize?client_id=...&scope=...&redirect_uri=...`

**Logging added:**
```typescript
console.log(`[getShopifyAuthUrl] Input parameters:`)
console.log(`  - shop: ${shop}`)
console.log(`  - redirect_uri: ${redirectUri}`)
console.log(`[getShopifyAuthUrl] Generated OAuth URL: ${authUrl}`)
```

#### 2f. State Parameter
```typescript
const state = Buffer.from(JSON.stringify({ userId, shop: shopDomain })).toString('base64')
const finalAuthUrl = `${authUrl}&state=${encodeURIComponent(state)}`
```

**Purpose:** Security - ensures the callback is for the same user/shop

#### 2g. Redirect to Shopify
```typescript
return NextResponse.redirect(finalAuthUrl)
```

**Final URL format:**
```
https://mystore.myshopify.com/admin/oauth/authorize?
  client_id=YOUR_API_KEY&
  scope=read_content,write_content,read_products&
  redirect_uri=https://myapp.vercel.app/api/shopify/callback&
  state=ENCODED_STATE
```

---

### Step 3: Shopify Authorization
**Location:** Shopify's servers

**What happens:**
- User sees Shopify login page
- User logs in and reviews permissions
- User clicks "Install app" or "Allow"
- Shopify redirects back to your callback URL with:
  - `code`: Authorization code
  - `shop`: Shop domain
  - `state`: The state parameter we sent

---

### Step 4: OAuth Callback Handling
**File:** `app/api/shopify/callback/route.ts`
**Function:** `GET(request: Request)`
**Line:** 15-92

**Flow:**

#### 4a. Extract Parameters
```typescript
const code = searchParams.get('code')      // Authorization code
const shop = searchParams.get('shop')      // Shop domain
const stateParam = searchParams.get('state') // State for verification
```

#### 4b. Verify State
```typescript
const state = JSON.parse(Buffer.from(stateParam, 'base64').toString('utf-8'))
if (state.userId !== userId) {
  return new Response('Invalid state parameter', { status: 400 })
}
```

#### 4c. Exchange Code for Token
```typescript
const tokenData = await exchangeCodeForToken(shop, code)
```
**Calls:** `lib/shopify-oauth.ts` → `exchangeCodeForToken()`

**Function:** `lib/shopify-oauth.ts` → `exchangeCodeForToken()`
**Line:** 81-110

**What it does:**
1. Gets `SHOPIFY_API_KEY` and `SHOPIFY_API_SECRET`
2. POSTs to `https://${shop}/admin/oauth/access_token`
3. Sends: `client_id`, `client_secret`, `code`
4. Returns: `{ access_token: string, scope: string }`

#### 4d. Encrypt and Store Token
```typescript
const encryptedToken = encryptToken(tokenData.access_token)
// Save to database
```

#### 4e. Redirect to Dashboard
```typescript
return NextResponse.redirect(`${baseUrl}/dashboard?shopify=connected`)
```

---

## Key Files and Functions

| File | Function | Purpose |
|------|----------|---------|
| `components/connect-shopify-form.tsx` | `handleSubmit()` | Initiates OAuth flow |
| `app/api/shopify/auth/route.ts` | `GET()` | Constructs OAuth URL |
| `lib/app-url.ts` | `getAppUrl()` | Resolves base URL |
| `lib/shopify-oauth.ts` | `validateShopDomain()` | Normalizes shop domain |
| `lib/shopify-oauth.ts` | `getShopifyAuthUrl()` | **Constructs OAuth authorization URL** |
| `app/api/shopify/callback/route.ts` | `GET()` | Handles callback |
| `lib/shopify-oauth.ts` | `exchangeCodeForToken()` | Exchanges code for token |
| `lib/shopify-oauth.ts` | `encryptToken()` | Encrypts token for storage |

---

## Redirect URI Resolution

**The redirect URI is constructed in:**

**File:** `app/api/shopify/auth/route.ts`
**Line:** 34-36

```typescript
const baseUrl = getAppUrl()  // Resolves base URL
const redirectUri = `${baseUrl.replace(/\/$/, '')}/api/shopify/callback`
```

**Runtime Resolution Order:**
1. Check `process.env.VERCEL_URL` → `https://${VERCEL_URL}`
2. Check `process.env.NEXT_PUBLIC_APP_URL` → Use this value
3. Fallback → `http://localhost:3000`

**Example Resolution:**
- Vercel production: `https://myapp.vercel.app/api/shopify/callback`
- Custom domain: `https://myapp.com/api/shopify/callback`
- Local dev: `http://localhost:3000/api/shopify/callback`

---

## Logging Output

With the added logging, you'll see:

```
[Shopify OAuth Initiation] Starting OAuth flow for user: user_xxx
[Shopify OAuth Initiation] Input shop parameter: mystore
[Shopify OAuth Initiation] Normalized shop domain: mystore.myshopify.com
[getAppUrl] Resolved base URL: https://myapp.vercel.app (source: VERCEL_URL)
[Shopify OAuth Initiation] ========================================
[Shopify OAuth Initiation] RESOLVED REDIRECT URI: https://myapp.vercel.app/api/shopify/callback
[Shopify OAuth Initiation] ========================================
[Shopify OAuth Initiation] Base URL: https://myapp.vercel.app
[Shopify OAuth Initiation] Callback path: /api/shopify/callback
[Shopify OAuth Initiation] Full redirect URI: https://myapp.vercel.app/api/shopify/callback
[getShopifyAuthUrl] Input parameters:
  - shop: mystore.myshopify.com
  - redirect_uri: https://myapp.vercel.app/api/shopify/callback
  - client_id: abc123... (truncated)
  - scopes: read_content,write_content,read_products
[getShopifyAuthUrl] Generated OAuth URL: https://mystore.myshopify.com/admin/oauth/authorize?client_id=...&scope=...&redirect_uri=...
[Shopify OAuth Initiation] Final OAuth URL (with state): https://mystore.myshopify.com/admin/oauth/authorize?...
[Shopify OAuth Initiation] Redirecting to Shopify...
```

---

## Critical Points

1. **Redirect URI must match exactly** in Shopify app settings
2. **Base URL resolution** happens at runtime based on environment
3. **State parameter** ensures security (prevents CSRF)
4. **Token encryption** happens before database storage
5. **All logging** shows the exact values used at each step


