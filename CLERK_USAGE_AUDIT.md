# Clerk Usage Audit

Complete scan of all Clerk usage in the codebase, categorized by type.

---

## 📋 Summary

- **Total Files with Clerk Usage:** 7 files
- **Frontend UI Files:** 3 files
- **Backend Middleware Files:** 1 file
- **API Routes:** 0 files (all use Shopify session tokens)
- **Deprecated Files:** 1 file (`lib/gscClient.ts`)

---

## 🎨 Frontend UI

### 1. **`components/conditional-clerk-provider.tsx`**
   - **Status:** ✅ Active
   - **Imports:**
     - `ClerkProvider` from `@clerk/nextjs`
   - **Usage:**
     - Conditionally wraps routes with `ClerkProvider`
     - Excludes public routes (`/`, `/landing`)
     - Used in root layout for protected routes only
   - **Purpose:** Conditional provider to avoid loading Clerk on landing page

---

### 2. **`app/login/[[...sign-in]]/page.tsx`**
   - **Status:** ✅ Active
   - **Imports:**
     - `SignIn` from `@clerk/nextjs`
     - `auth` from `@clerk/nextjs/server`
   - **Usage:**
     - Uses `SignIn` component for authentication UI
     - Uses `auth()` to check if user is logged in
     - Redirects logged-in users to `/dashboard`
   - **Purpose:** Clerk sign-in page for user authentication

---

### 3. **`app/dashboard/page.tsx`**
   - **Status:** ✅ Active
   - **Imports:**
     - `auth, currentUser` from `@clerk/nextjs/server`
     - `UserButton` from `@clerk/nextjs`
   - **Usage:**
     - Uses `auth()` to check authentication
     - Uses `currentUser()` to get user info on first login
     - Uses `UserButton` component for user menu/logout
     - Queries database using `clerkId` to find user record
   - **Purpose:** Protected dashboard page with Clerk authentication and user management

---

## ⚙️ Backend Middleware

### 4. **`middleware.ts`**
   - **Status:** ✅ Active
   - **Imports:**
     - `clerkMiddleware` from `@clerk/nextjs/server`
     - `createRouteMatcher` from `@clerk/nextjs/server`
   - **Usage:**
     - Uses `clerkMiddleware` for route protection
     - Protects `/dashboard(.*)` routes
     - Calls `auth().protect()` for protected routes
   - **Purpose:** Route-level authentication middleware

---

## 🔧 Deprecated / Reference Only

### 5. **`lib/gscClient.ts`**
   - **Status:** ❌ Deprecated (not used)
   - **Imports:**
     - `auth` from `@clerk/nextjs/server`
   - **Usage:**
     - Uses `auth()` to get `userId`
     - Queries database using `clerkId`
   - **Purpose:** ⚠️ **DEPRECATED** - Replaced by `getSiteFromSessionWithGSC()` which uses Shopify session tokens
   - **Note:** Kept for reference only, should not be used in new code

---

## 📊 Schema / Configuration

### 6. **`prisma/schema.prisma`**
   - **Status:** ✅ Active
   - **Usage:**
     - `User` model has `clerkId` field (String @unique)
     - Used to link users to Clerk authentication
     - Referenced in dashboard to find user records
   - **Purpose:** Database schema linking users to Clerk IDs

---

### 7. **`package.json`**
   - **Status:** ✅ Active
   - **Usage:**
     - Lists `@clerk/nextjs` as dependency (^5.0.0)
   - **Purpose:** Package dependency declaration

---

## ✅ API Routes Status

**All API routes use Shopify session tokens, NOT Clerk:**

- `/api/store/baseline` - Uses `getSiteFromSession()`
- `/api/keywords/seed` - Uses `getSiteFromSession()`
- `/api/keywords/list` - Uses `getSiteFromSession()`
- `/api/keywords/cleanup-duplicates` - Uses `getSiteFromSession()`
- `/api/content/generate` - Uses `getSiteFromSession()`
- `/api/content/publish` - Uses `getSiteFromSession()`
- `/api/pages/list` - Uses `getSiteFromSession()`
- `/api/shopify/disconnect` - Uses `getSiteFromSession()`
- `/api/gsc/pull-keywords` - Uses `getSiteFromSessionWithGSC()`
- `/api/performance/snapshot` - Uses `getSiteFromSessionWithGSC()`
- `/api/shopify/auth` - Public route (OAuth initiation)
- `/api/shopify/callback` - Public route (OAuth callback)
- `/api/test-auth` - Uses `getSiteFromSession()`

**✅ NO API routes use Clerk authentication.**

---

## 📝 Usage Breakdown

### Active Clerk Usage:
1. **Frontend UI Components:**
   - `ClerkProvider` - Conditional wrapper (conditional-clerk-provider.tsx)
   - `SignIn` - Login component (login page)
   - `UserButton` - User menu component (dashboard page)
   - `auth()` - Server-side auth check (login, dashboard pages)
   - `currentUser()` - Get user info (dashboard page)

2. **Backend Middleware:**
   - `clerkMiddleware` - Route protection middleware
   - `auth().protect()` - Route-level protection

3. **Database:**
   - `clerkId` field in `User` model - Links users to Clerk

### Deprecated:
- `lib/gscClient.ts` - Old GSC client using Clerk (replaced with Shopify session tokens)

---

## 🔄 Migration Status

- ✅ **API Routes:** Fully migrated to Shopify session tokens
- ✅ **Landing Page:** No Clerk (uses ConditionalClerkProvider)
- ⚠️ **Frontend Protected Routes:** Still using Clerk for user authentication
- ⚠️ **Backend Middleware:** Still using Clerk for route protection
- ⚠️ **User Management:** Still using Clerk for user identity (clerkId in database)

---

## 📌 Notes

1. Clerk is **only used for user authentication** on protected frontend routes (`/dashboard`, `/login`)
2. All API routes have been migrated to **Shopify session tokens** (no Clerk dependency)
3. The landing page (`/`) is **public** and doesn't load Clerk thanks to `ConditionalClerkProvider`
4. `lib/gscClient.ts` is deprecated and should not be used (all GSC routes use Shopify tokens)

---

## ✅ Conclusion

Clerk usage is **limited to frontend user authentication** only:
- Login/sign-in functionality
- Dashboard access control
- User profile display (UserButton)

**All backend API authentication uses Shopify session tokens, not Clerk.**

