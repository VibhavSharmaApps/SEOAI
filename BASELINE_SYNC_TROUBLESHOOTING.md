# Troubleshooting Baseline Sync Errors

## Common Causes

### 1. Database Table Doesn't Exist

**Error:** `Table "pages" does not exist` or similar

**Fix:**
```bash
npm run db:migrate
```

If it says "Already in sync", the table exists. Check other issues below.

### 2. Shopify API Permissions

**Error:** `Shopify API error: 403` or `Unauthorized`

**Cause:** Your Shopify app doesn't have the required scopes

**Fix:**
1. Go to Shopify Partners → Your App → App setup
2. Check **API scopes** include:
   - `read_content`
   - `write_content`
   - `read_products`
3. If scopes are missing, update them and re-authenticate

### 3. Empty Store (This is OK!)

**If your store has no products/collections/articles:**
- ✅ This is **NOT** an error
- The sync will complete successfully
- You'll see: `products: 0, collections: 0, articles: 0`
- This is expected for new/empty stores

### 4. Shopify API Rate Limits

**Error:** `429 Too Many Requests`

**Fix:**
- Wait a few minutes and try again
- Shopify has rate limits (2 requests per second)
- The sync handles pagination automatically

### 5. Invalid Access Token

**Error:** `Shopify API error: 401`

**Fix:**
- Re-authenticate your Shopify store
- Go to `/dashboard/connect-shopify` and connect again
- This will refresh the access token

### 6. Database Connection Issues

**Error:** Database connection errors

**Fix:**
- Verify `DATABASE_URL` is correct
- Check Supabase is running
- Test connection: `npm run db:studio`

## How to Debug

### Check Server Logs

Look for `[Baseline]` messages in your terminal:

```
[Baseline] Starting baseline sync for shop: mystore.myshopify.com
[Baseline] Fetched: 150 products, 25 collections, 45 articles
[Baseline] Error: ...
```

### Check Browser Console

Open DevTools (F12) → Console tab when clicking "Sync Baseline Data"

### Check Error Message

The dashboard now shows the specific error. Common messages:
- "Failed to fetch data from Shopify: ..."
- "Failed to store products in database: ..."
- "Table 'pages' does not exist" (run migration)

## Step-by-Step Fix

1. **Check if migration is needed:**
   ```bash
   npm run db:migrate
   ```

2. **Verify Shopify connection:**
   - Go to dashboard
   - Check if store shows as "Connected"
   - If not, reconnect

3. **Check Shopify app scopes:**
   - Partners Dashboard → Your App → Scopes
   - Must include: `read_content`, `read_products`

4. **Try sync again:**
   - Click "Sync Baseline Data"
   - Watch terminal for `[Baseline]` logs
   - Check error message on dashboard

5. **If still failing:**
   - Check the specific error message
   - Look at server logs
   - Verify all environment variables are set

## Expected Behavior

**Empty Store:**
```json
{
  "success": true,
  "synced": { "products": 0, "collections": 0, "articles": 0 },
  "stored": { "PRODUCT": 0, "COLLECTION": 0, "ARTICLE": 0 },
  "total": 0
}
```

**Store with Data:**
```json
{
  "success": true,
  "synced": { "products": 150, "collections": 25, "articles": 45 },
  "stored": { "PRODUCT": 150, "COLLECTION": 25, "ARTICLE": 45 },
  "total": 220
}
```

Both are **successful** - empty stores are fine!

