# Fix: Shopify API 403 Error - Missing read_products Scope

## Problem

Error: `This action requires merchant approval for read_products scope`

Your Shopify app is missing the required API scopes/permissions.

## Solution

### Step 1: Update App Scopes in Shopify Partners

1. **Go to Shopify Partners Dashboard:**
   - Visit [partners.shopify.com](https://partners.shopify.com)
   - Sign in
   - Select your app

2. **Navigate to App Setup:**
   - Click on your app
   - Go to **App setup** in the sidebar
   - Scroll to **API scopes** section

3. **Add Required Scopes:**
   You need these scopes:
   - ✅ `read_content` - Read blog posts
   - ✅ `write_content` - Create/update blog posts
   - ✅ `read_products` - **This is the missing one!**

4. **Save Changes:**
   - Click "Save" at the bottom
   - Note: You may need to submit for review if adding new scopes

### Step 2: Re-authenticate Your Store

**Important:** After updating scopes, you MUST reconnect your store:

1. **Go to your dashboard:**
   - Visit `/dashboard/connect-shopify`

2. **Disconnect (if needed):**
   - You may need to remove the app from Shopify first
   - Go to Shopify Admin → Apps → Your App → Uninstall

3. **Reconnect:**
   - Go back to `/dashboard/connect-shopify`
   - Enter your store domain
   - Click "Connect Shopify Store"
   - **This time, Shopify will ask for the new permissions**
   - Click "Install app" or "Allow"

### Step 3: Verify Scopes

After reconnecting, the app should have all required scopes and the sync should work.

## Alternative: Update Scopes in Code (If Needed)

If you want to request additional scopes, update `lib/shopify-oauth.ts`:

```typescript
const scopes = 'read_content,write_content,read_products,read_collections'
```

Then users will need to re-authenticate to get the new scopes.

## Quick Checklist

- [ ] Added `read_products` scope in Shopify Partners
- [ ] Saved changes in Partners dashboard
- [ ] Re-authenticated store (disconnected and reconnected)
- [ ] Approved new permissions when prompted
- [ ] Tried sync again

## Why This Happened

When you first connected, the app only requested `read_content` and `write_content` scopes. The baseline sync endpoint needs `read_products` to fetch product data, which wasn't included initially.

After adding the scope and re-authenticating, the sync should work!

