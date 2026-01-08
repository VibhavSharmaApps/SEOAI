# Shopify OAuth - Step-by-Step Guide

## What to Do When Redirected to Shopify

When you click "Connect Shopify Store", you'll be redirected to Shopify. Here's what to do:

---

## Step 1: You'll See Shopify's Authorization Page

After clicking "Connect Shopify Store", you'll be redirected to a Shopify page that looks like:

**URL:** `https://yourstore.myshopify.com/admin/oauth/authorize?...`

### What You'll See:

1. **If you're not logged into Shopify:**
   - Shopify login page
   - Enter your Shopify admin email and password
   - Click "Log in"

2. **If you're already logged in:**
   - You'll see an authorization page directly

---

## Step 2: Review the Authorization Request

You'll see a page that says something like:

```
[Your App Name] wants to access your store

This app will be able to:
- Read content
- Write content  
- Read products

[Install app] [Cancel]
```

**What this means:**
- Shopify is asking if you want to give your app permission to access your store
- The permissions listed are what your app needs to function

---

## Step 3: Click "Install app" or "Allow"

**Important:** You need to click the button to approve the connection:

- **Button text might be:** "Install app", "Allow", or "Authorize"
- **Location:** Usually a blue/green button on the page
- **Action:** Click it to approve

### What NOT to do:
- ❌ Don't just close the tab
- ❌ Don't click "Cancel"
- ❌ Don't navigate away

---

## Step 4: Automatic Redirect Back

After clicking "Install app" or "Allow":

1. **Shopify processes your approval**
2. **You'll be automatically redirected back** to your app
3. **URL will be:** `https://your-app.com/dashboard?shopify=connected`
4. **You'll see a success message** on your dashboard

---

## Step 5: Verify Connection

On your dashboard, you should see:

- ✅ "Shopify store connected successfully!" message
- ✅ Store domain and URL displayed
- ✅ "Sync Baseline Data" button available

---

## Troubleshooting

### Problem: I don't see an authorization page

**Possible causes:**
- You're not logged into Shopify
- The app isn't properly configured in Shopify Partners
- Check your browser's address bar - you should be on `yourstore.myshopify.com`

**Solution:**
- Make sure you're logged into your Shopify admin
- Verify your Shopify app is set up correctly in Partners dashboard

### Problem: I see an error page

**Common errors:**

1. **"redirect_uri is not whitelisted"**
   - Your redirect URL isn't configured in Shopify Partners
   - Go to Shopify Partners → Your App → App setup
   - Add: `https://your-app.vercel.app/api/shopify/callback`

2. **"Invalid client_id"**
   - Your `SHOPIFY_API_KEY` might be wrong
   - Check your `.env` file

3. **"Access denied"**
   - You clicked "Cancel" instead of "Install app"
   - Try the connection again

### Problem: I'm stuck on Shopify's dashboard

**If you're on the Shopify admin dashboard instead of the authorization page:**

1. **Check the URL** - it should contain `/admin/oauth/authorize`
2. **If you're just on the dashboard**, the OAuth flow didn't start correctly
3. **Go back to your app** and try connecting again
4. **Make sure you entered the correct store domain**

### Problem: Nothing happens after clicking "Install app"

**Wait a few seconds:**
- The redirect can take 2-5 seconds
- Don't close the tab
- Check if a new tab opened

**If still nothing:**
- Check browser console for errors (F12)
- Verify your callback URL is correct in Shopify Partners
- Try the connection again

---

## What Happens Behind the Scenes

1. **You click "Install app"** → Shopify generates an authorization code
2. **Shopify redirects** → Sends you back to `/api/shopify/callback?code=...`
3. **Your app exchanges code** → Gets permanent access token from Shopify
4. **Token is encrypted** → Stored securely in database
5. **You're redirected** → Back to dashboard with success message

---

## Quick Checklist

- [ ] Entered correct Shopify store domain
- [ ] Clicked "Connect Shopify Store"
- [ ] Logged into Shopify (if prompted)
- [ ] Saw authorization/permissions page
- [ ] Clicked "Install app" or "Allow"
- [ ] Waited for redirect back to your app
- [ ] Saw success message on dashboard

---

## Still Having Issues?

1. **Check browser console** (F12 → Console tab) for errors
2. **Verify environment variables** are set correctly
3. **Check Shopify Partners dashboard** - app must be configured
4. **Try in incognito mode** to rule out cookie issues
5. **Check Vercel logs** if deployed (for server-side errors)


