# Troubleshooting Shopify OAuth Callback Errors

## Problem: App appears in Shopify but callback fails

If the app appears in your Shopify Apps list but you see "Failed to connect" in your dashboard, the callback is encountering an error.

## How to Diagnose

### Step 1: Check Server Logs

**Local Development:**
- Check your terminal where `npm run dev` is running
- Look for `[Shopify Callback]` log messages
- The logs will show exactly where it's failing

**Vercel Production:**
- Go to Vercel Dashboard → Your Project → Deployments
- Click on the latest deployment → Functions tab
- Look for error logs

### Step 2: Check Error Message on Dashboard

The dashboard now shows the specific error message. Look for:
- "SHOPIFY_ENCRYPTION_KEY is required"
- "User not found in database"
- "Shopify API error"
- etc.

## Common Issues and Fixes

### Issue 1: Missing SHOPIFY_ENCRYPTION_KEY

**Error:** `SHOPIFY_ENCRYPTION_KEY is required for token encryption`

**Fix:**
1. Generate encryption key:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. Add to `.env`:
   ```env
   SHOPIFY_ENCRYPTION_KEY=your_64_character_hex_key
   ```

3. **In Vercel:** Add the same key to environment variables

4. Restart dev server or redeploy

### Issue 2: User Not Found in Database

**Error:** `User not found in database`

**Cause:** User exists in Clerk but not in your database yet

**Fix:**
- This shouldn't happen if you've logged into the dashboard (user is auto-created)
- Try logging out and back in
- Or manually create the user in the database

### Issue 3: Database Connection Issues

**Error:** Database connection errors

**Fix:**
- Verify `DATABASE_URL` is set correctly in `.env`
- Check Supabase connection is working
- Run `npm run db:generate` to ensure Prisma Client is up to date

### Issue 4: Invalid Shopify API Credentials

**Error:** `Shopify API error: 401` or `Shopify API credentials are not set`

**Fix:**
- Verify `SHOPIFY_API_KEY` and `SHOPIFY_API_SECRET` are set
- Check they match your Shopify Partners app
- Make sure they're in both `.env` (local) and Vercel (production)

### Issue 5: Token Exchange Fails

**Error:** `Failed to exchange code for token`

**Possible causes:**
- Authorization code expired (codes expire quickly)
- Wrong API secret
- Shop domain mismatch

**Fix:**
- Try the OAuth flow again (get a fresh code)
- Verify API credentials are correct
- Check shop domain matches exactly

## Step-by-Step Debugging

1. **Try the connection again** - Get fresh logs
2. **Check terminal/logs** for `[Shopify Callback]` messages
3. **Look at the error message** on the dashboard
4. **Verify environment variables** are all set
5. **Check database** - Can you connect? Is user there?

## Quick Checklist

- [ ] `SHOPIFY_ENCRYPTION_KEY` is set (64 characters)
- [ ] `SHOPIFY_API_KEY` is set
- [ ] `SHOPIFY_API_SECRET` is set
- [ ] `DATABASE_URL` is set and working
- [ ] User exists in database (try logging in first)
- [ ] All env vars are in Vercel (if deployed)

## Test Environment Variables

Run this in your terminal to check:

```bash
# Check if encryption key is set
node -e "console.log('ENCRYPTION_KEY:', process.env.SHOPIFY_ENCRYPTION_KEY ? 'SET (' + process.env.SHOPIFY_ENCRYPTION_KEY.length + ' chars)' : 'MISSING')"
```

## Next Steps After Fixing

1. **Clear browser cache/cookies** (or use incognito)
2. **Try connecting again**
3. **Watch the logs** in real-time
4. **Check the dashboard** for the specific error message

