# Fix: 404 Error After Logout/Login

## Problem

Getting a 404 error after logging out and logging back in.

## Common Causes

### 1. Clerk Default Routes Missing

Clerk might be trying to redirect to default routes like `/sign-in` or `/sign-up` that don't exist.

**Fix:** Explicitly configure Clerk routes in `ClerkProvider` (already done in code).

### 2. Middleware Issues

The middleware might be blocking or redirecting incorrectly.

**Check:** Verify middleware is correctly configured.

### 3. Environment Variables

Missing or incorrect Clerk environment variables.

**Check:** Verify `.env` has:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

## Solution Applied

Updated `app/layout.tsx` to explicitly configure Clerk routes:

```typescript
<ClerkProvider
  signInUrl="/login"
  signUpUrl="/login"
  afterSignInUrl="/dashboard"
  afterSignUpUrl="/dashboard"
>
```

This ensures Clerk always redirects to `/login` for sign-in/sign-up and `/dashboard` after authentication.

## Additional Steps

### 1. Check Environment Variables

Verify your `.env` file has:
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

### 2. Restart Dev Server

After making changes:
```bash
# Stop server (Ctrl+C)
npm run dev
```

### 3. Clear Browser Cache

- Clear browser cache/cookies
- Or use incognito mode
- Or hard refresh (Ctrl+Shift+R)

### 4. Check Browser Console

Open DevTools (F12) → Console tab to see any JavaScript errors.

### 5. Check Network Tab

DevTools → Network tab to see what URL is returning 404.

## Testing

1. **Logout:**
   - Click UserButton → Sign out
   - Should redirect to `/login`

2. **Login:**
   - Enter credentials
   - Should redirect to `/dashboard`

3. **Direct URL:**
   - Try `/login` directly
   - Try `/dashboard` directly (should redirect to login if not authenticated)

## If Still Getting 404

1. **Check the exact URL** that's showing 404
2. **Check terminal logs** for errors
3. **Verify all routes exist:**
   - `/` (root - should redirect)
   - `/login` (exists)
   - `/dashboard` (exists)

## Common 404 URLs

- `/sign-in` → Should be `/login` (fixed in ClerkProvider)
- `/sign-up` → Should be `/login` (fixed in ClerkProvider)
- `/sso-callback` → Clerk internal route (should work automatically)

