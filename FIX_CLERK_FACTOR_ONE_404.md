# Fix: 404 Error for /login/factor-one

## Problem

Getting a 404 error when Clerk tries to access `/login/factor-one` (multi-factor authentication route).

## Root Cause

Clerk uses sub-routes under `/login` for various authentication flows:
- `/login/factor-one` - MFA verification
- `/login/sso-callback` - SSO callbacks
- `/login/continue` - Password reset, etc.

The original setup only had `/login/page.tsx`, which doesn't handle these sub-routes.

## Solution

Replaced `/login/page.tsx` with a catch-all route: `/login/[[...sign-in]]/page.tsx`

This Next.js catch-all route pattern (`[[...sign-in]]`) handles:
- `/login` - Main sign-in page
- `/login/factor-one` - MFA
- `/login/sso-callback` - SSO
- `/login/continue` - Password reset
- Any other Clerk sub-routes

## What Changed

**Before:**
```
app/login/page.tsx  (only handles /login)
```

**After:**
```
app/login/[[...sign-in]]/page.tsx  (handles /login and all sub-routes)
```

## Testing

After deploying, test:
1. ✅ `/login` - Should work
2. ✅ `/login/factor-one` - Should work (no more 404)
3. ✅ `/login/sso-callback` - Should work
4. ✅ Logout → Login flow - Should work

## Next.js Catch-All Routes

The `[[...sign-in]]` syntax means:
- `[...]` - Catch-all (matches any number of segments)
- `[[...]]` - Optional catch-all (matches zero or more segments)

So `/login/[[...sign-in]]` matches:
- `/login` (zero segments)
- `/login/factor-one` (one segment)
- `/login/factor-one/verify` (two segments)
- etc.

## Deployment

After this change:
1. Commit and push to Git
2. Vercel will auto-deploy
3. The 404 error should be resolved

