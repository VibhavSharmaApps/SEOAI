# Shopify Scopes Configuration - Manual OAuth vs CLI

## Our Setup: Manual OAuth (Not Shopify CLI)

This app uses **manual OAuth flow**, not Shopify CLI. This means:

- ✅ **Scopes are defined in code** (`lib/shopify-oauth.ts`)
- ✅ **No TOML file needed**
- ✅ **Scopes are requested during OAuth** (in the authorization URL)

## Current Scopes in Code

The scopes are already updated in `lib/shopify-oauth.ts`:

```typescript
const scopes = 'read_content,write_content,read_products,read_collections'
```

## Two Places to Configure Scopes

### 1. Shopify Partners Dashboard (Required)

Even though scopes are in code, you **must also** configure them in Partners:

1. Go to [Shopify Partners Dashboard](https://partners.shopify.com)
2. Select your app
3. Go to **App setup** → **API scopes**
4. Add these scopes:
   - `read_content`
   - `write_content`
   - `read_products` ⚠️ **This was missing!**
   - `read_collections` (recommended)

5. **Save changes**

### 2. Code (Already Done)

The code already requests these scopes when generating the OAuth URL. ✅

## Why Both Are Needed

- **Partners Dashboard:** Tells Shopify what scopes your app is allowed to request
- **Code:** Actually requests those scopes during OAuth

Both must match!

## Re-authentication Required

After updating scopes in Partners dashboard:

1. **Uninstall the app** from your Shopify store:
   - Shopify Admin → Apps → Your App → Uninstall

2. **Reconnect** from your app:
   - Go to `/dashboard/connect-shopify`
   - Enter store domain
   - Click "Connect Shopify Store"
   - Shopify will now request the new scopes
   - Click "Install app" or "Allow"

3. **Try sync again** - should work now!

## If You Were Using Shopify CLI

If you were using Shopify CLI (with TOML file), you would:

1. Update `shopify.app.toml`:
   ```toml
   [access_scopes]
   scopes = "read_content,write_content,read_products,read_collections"
   ```

2. Deploy:
   ```bash
   shopify app deploy
   ```

But we're **not using CLI**, so this doesn't apply to our setup.

## Summary

✅ **Code scopes:** Already updated  
✅ **Partners dashboard:** You need to add `read_products` and `read_collections`  
✅ **Re-authenticate:** Required after updating Partners dashboard  
✅ **Then sync:** Should work!


