# Fix: Invalid Key Length Error

## Problem

The error "Invalid key length" means your `SHOPIFY_ENCRYPTION_KEY` is set but has the wrong length or format.

## Solution

### Step 1: Generate a New Key

Run this command to generate a proper 64-character hex key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Example output:**
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

### Step 2: Update Your .env File

Replace the existing `SHOPIFY_ENCRYPTION_KEY` with the newly generated key:

```env
SHOPIFY_ENCRYPTION_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

**Important:**
- Must be exactly 64 characters
- Must be hexadecimal (0-9, a-f)
- No spaces, quotes, or special characters
- Copy the entire key exactly

### Step 3: Update Vercel (if deployed)

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Find `SHOPIFY_ENCRYPTION_KEY`
3. Update it with the new key
4. Redeploy your app

### Step 4: Restart Your Dev Server

```bash
# Stop the server (Ctrl+C)
npm run dev
```

### Step 5: Try Connecting Again

Go back to `/dashboard/connect-shopify` and try the OAuth flow again.

## Common Mistakes

❌ **Wrong:** `SHOPIFY_ENCRYPTION_KEY="abc123"` (too short)  
❌ **Wrong:** `SHOPIFY_ENCRYPTION_KEY=abc123 def456` (has spaces)  
❌ **Wrong:** `SHOPIFY_ENCRYPTION_KEY=abc123...` (truncated)  
✅ **Correct:** `SHOPIFY_ENCRYPTION_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2` (64 hex chars)

## Verify Your Key

Check if your key is valid:

```bash
node -e "const key = process.env.SHOPIFY_ENCRYPTION_KEY; console.log('Length:', key?.length || 0, '(needs 64)'); console.log('Valid hex:', key ? /^[0-9a-fA-F]{64}$/.test(key) : false)"
```

## Note About Existing Tokens

⚠️ **Important:** If you change the encryption key, you'll need to:
1. Re-authenticate all Shopify stores (the old encrypted tokens won't decrypt)
2. Or keep the same key if you have existing connections

If this is your first connection, you can safely generate a new key.

