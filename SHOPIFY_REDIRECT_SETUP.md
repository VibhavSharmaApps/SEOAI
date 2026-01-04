# Shopify Redirect URL Setup Guide

## Common Error: "redirect_uri is not whitelisted"

This error occurs when the redirect URL in your code doesn't **exactly match** what's configured in Shopify.

## Critical Requirements

1. **Exact Match Required** - The URL must match character-for-character
2. **No Trailing Spaces** - Remove any spaces before/after the URL
3. **Case Sensitive** - URLs are case-sensitive
4. **Protocol Must Match** - `https://` not `http://` (for production)
5. **No Trailing Slash** - Don't add `/` at the end

## Step-by-Step Fix

### 1. Check Your Current Redirect URL

The app automatically generates the redirect URL. Check your Vercel logs or add this to see what URL is being sent:

The redirect URL should be: `https://myappname.vercel.app/api/shopify/callback`

### 2. Configure in Shopify Partners Dashboard

1. Go to [Shopify Partners Dashboard](https://partners.shopify.com)
2. Select your app
3. Go to **App setup** → **App URL**
4. Under **Allowed redirection URL(s)**, add:

```
https://myappname.vercel.app/api/shopify/callback
```

**Important:**
- ✅ Use `https://` (not `http://`)
- ✅ No trailing space
- ✅ No trailing slash
- ✅ Exact match with what your app sends

### 3. Verify Environment Variables

In Vercel, check your environment variables:

- `VERCEL_URL` - Automatically set by Vercel (e.g., `myappname.vercel.app`)
- `NEXT_PUBLIC_APP_URL` - Optional, only if you want to override

The app will use `VERCEL_URL` automatically, so you typically don't need `NEXT_PUBLIC_APP_URL` for Vercel.

### 4. Test the Redirect URL

After adding the URL in Shopify:

1. Try the OAuth flow again
2. Check the browser console or Vercel logs for the redirect URI being used
3. Verify it matches exactly what's in Shopify

## Troubleshooting

### Error: "redirect_uri is not whitelisted"

**Check:**
- [ ] URL in Shopify has no trailing space
- [ ] URL in Shopify uses `https://` (not `http://`)
- [ ] URL in Shopify has no trailing slash
- [ ] URL matches exactly (case-sensitive)
- [ ] You saved the changes in Shopify

### Multiple Environments

If you have multiple environments (dev, staging, production), add all redirect URLs:

```
http://localhost:3000/api/shopify/callback
https://myappname.vercel.app/api/shopify/callback
https://myappname-staging.vercel.app/api/shopify/callback
```

### Custom Domain

If you're using a custom domain:

1. Add the custom domain redirect URL in Shopify:
   ```
   https://yourdomain.com/api/shopify/callback
   ```

2. Set `NEXT_PUBLIC_APP_URL` in Vercel:
   ```
   NEXT_PUBLIC_APP_URL=https://yourdomain.com
   ```

## Quick Checklist

- [ ] Redirect URL in Shopify: `https://myappname.vercel.app/api/shopify/callback`
- [ ] No trailing space in Shopify
- [ ] No trailing slash in Shopify
- [ ] Using `https://` (not `http://`)
- [ ] Changes saved in Shopify
- [ ] Redeployed app after any environment variable changes

## How to Find Your Exact Redirect URL

The app logs the redirect URI. Check:

1. **Vercel Logs:**
   - Go to your deployment → **Functions** tab
   - Look for: `Shopify OAuth Redirect URI: https://...`

2. **Browser Console:**
   - Open browser DevTools
   - Check Network tab for the OAuth request
   - Look at the `redirect_uri` parameter

3. **Add Temporary Logging:**
   The code now logs the redirect URI automatically.

## Still Not Working?

1. **Clear browser cache** and try again
2. **Wait a few minutes** - Shopify changes can take time to propagate
3. **Double-check** the URL character-by-character
4. **Try in incognito mode** to rule out browser issues
5. **Check Vercel logs** for the exact URL being sent

