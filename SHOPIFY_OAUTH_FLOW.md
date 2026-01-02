# Shopify OAuth Flow Explained

## Simple Overview

Shopify OAuth is like giving your app permission to access a Shopify store. Here's how it works in simple terms:

1. **User clicks "Connect Shopify"** → Your app asks: "Which store do you want to connect?"
2. **User enters store name** → Your app redirects to Shopify's login page
3. **User logs into Shopify** → Shopify asks: "Do you want to give this app permission?"
4. **User approves** → Shopify sends your app a special code
5. **Your app exchanges code for token** → Your app gets a permanent access token
6. **Token is stored securely** → Token is encrypted and saved to database
7. **User redirected to dashboard** → Connection complete!

---

## Detailed Flow

### Step 1: User Initiates Connection

**Location:** `/dashboard/connect-shopify`

- User enters their Shopify store domain (e.g., "mystore" or "mystore.myshopify.com")
- Clicks "Connect Shopify Store"
- Form submits to `/api/shopify/auth?shop=mystore`

### Step 2: OAuth Authorization Request

**Location:** `/api/shopify/auth` (API Route)

**What happens:**
1. Validates user is authenticated (via Clerk)
2. Normalizes shop domain (adds `.myshopify.com` if needed)
3. Generates OAuth URL with:
   - Your app's API key
   - Requested permissions (scopes)
   - Callback URL (where Shopify will send user back)
   - State parameter (contains user ID and shop for security)
4. Redirects user to Shopify's authorization page

**Shopify URL format:**
```
https://mystore.myshopify.com/admin/oauth/authorize?
  client_id=YOUR_API_KEY&
  scope=read_content,write_content&
  redirect_uri=https://yourapp.com/api/shopify/callback&
  state=ENCRYPTED_STATE
```

### Step 3: User Approves on Shopify

**Location:** Shopify's website

- User sees Shopify login page (if not logged in)
- User logs in and reviews permissions
- User clicks "Install app" or "Allow"
- Shopify redirects back to your callback URL with an authorization code

### Step 4: OAuth Callback

**Location:** `/api/shopify/callback` (API Route)

**What happens:**
1. Receives authorization code from Shopify
2. Validates state parameter (ensures request is legitimate)
3. Exchanges authorization code for access token:
   - Makes POST request to Shopify
   - Sends API key, secret, and authorization code
   - Receives permanent access token
4. Encrypts access token (for secure storage)
5. Saves to database:
   - Creates or updates Site record
   - Stores encrypted token, domain, and store URL
6. Redirects user to dashboard with success message

### Step 5: Token Storage

**Security measures:**
- Access token is encrypted using AES-256-CBC
- Encryption key is stored in environment variables
- Token is never exposed in logs or responses
- Only decrypted when making API calls to Shopify

---

## Security Features

### 1. State Parameter
- Contains user ID and shop domain
- Base64 encoded (not encrypted, but prevents tampering)
- Validated on callback to ensure request is legitimate

### 2. Token Encryption
- Tokens are encrypted before storage
- Uses AES-256-CBC encryption
- Encryption key stored in environment variables (never in code)

### 3. User Verification
- All API routes check Clerk authentication
- State parameter verified to match current user
- Prevents token theft or unauthorized access

### 4. One Store Per User (MVP)
- Each user can only connect one Shopify store
- If user tries to connect another, existing connection is updated
- Prevents confusion and simplifies data model

---

## API Endpoints

### `GET /api/shopify/auth`
**Purpose:** Initiate OAuth flow

**Query Parameters:**
- `shop` (required): Shopify store domain

**Response:** Redirects to Shopify authorization page

**Example:**
```
GET /api/shopify/auth?shop=mystore
→ Redirects to Shopify
```

### `GET /api/shopify/callback`
**Purpose:** Handle OAuth callback

**Query Parameters:**
- `code` (required): Authorization code from Shopify
- `shop` (required): Shopify store domain
- `state` (required): Encrypted state parameter

**Response:** Redirects to dashboard

**Example:**
```
GET /api/shopify/callback?code=abc123&shop=mystore&state=xyz789
→ Saves token, redirects to /dashboard?shopify=connected
```

---

## Error Handling

### Common Errors

1. **Missing shop parameter**
   - User didn't enter store domain
   - Returns 400 error

2. **Invalid shop domain**
   - Store doesn't exist or format is wrong
   - Shopify will show error page

3. **User denies permission**
   - User clicks "Cancel" on Shopify
   - Redirects back with error

4. **Token exchange fails**
   - Invalid code or expired
   - Redirects to dashboard with error message

5. **Database error**
   - Failed to save token
   - Redirects to dashboard with error message

---

## Testing the Flow

### Development Setup

1. **Create Shopify App:**
   - Go to [Shopify Partners](https://partners.shopify.com)
   - Create new app
   - Get **Client ID** (this is `SHOPIFY_API_KEY`) and **Client Secret** (this is `SHOPIFY_API_SECRET`)

2. **Configure Redirect URLs:**
   - Add `http://localhost:3000/api/shopify/callback` for local development
   - Add `https://your-app.vercel.app/api/shopify/callback` for Vercel production
   - Add custom domain URL if applicable

3. **Set Environment Variables:**
   ```env
   SHOPIFY_API_KEY=your_client_id
   SHOPIFY_API_SECRET=your_client_secret
   SHOPIFY_ENCRYPTION_KEY=your_64_char_hex_key
   ```
   
   **Note:** For Vercel deployments, you don't need `NEXT_PUBLIC_APP_URL` - it automatically uses `VERCEL_URL`!

4. **Test Flow:**
   - Start dev server: `npm run dev`
   - Go to `/dashboard/connect-shopify`
   - Enter test store domain
   - Complete OAuth flow

### Using Test Stores

Shopify provides test stores for development:
- Create test store in Partners dashboard
- Use test store domain for OAuth
- Test store has limited functionality but works for OAuth

---

## Next Steps After Connection

Once a store is connected:

1. **Access token is stored** (encrypted in database)
2. **Site record created** (links user to store)
3. **Ready for API calls** (can now make Shopify API requests)
4. **Dashboard shows connection status** (user sees connected store)

### Making API Calls

After connection, you can use the stored token to make Shopify API calls:

```typescript
import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/shopify-oauth'

// Get site and decrypt token
const site = await prisma.site.findFirst({ where: { userId } })
const token = decryptToken(site.shopifyAccessToken)

// Make API call
const response = await fetch(`https://${site.domain}/admin/api/2024-01/products.json`, {
  headers: {
    'X-Shopify-Access-Token': token,
  },
})
```

---

## Troubleshooting

### OAuth redirects to wrong URL
- Check `NEXT_PUBLIC_APP_URL` matches your actual URL
- Verify redirect URL in Shopify app settings

### Token exchange fails
- Verify API key and secret are correct
- Check authorization code hasn't expired (codes expire quickly)
- Ensure scopes match app configuration

### Token decryption fails
- Verify `SHOPIFY_ENCRYPTION_KEY` is set correctly
- Key must be exactly 64 characters (32 bytes in hex)
- If key changes, all tokens need to be re-authenticated

### User sees "Already connected" but no store
- Check database for Site records
- Verify user ID matches Clerk user ID
- Check if token was saved successfully

