# Quick Vercel Auto-Deploy Setup

Your repo is already connected to GitHub: `git@github.com:VibhavSharmaApps/SEOAI.git`

## Quick Setup Steps

### 1. Connect to Vercel (2 minutes)

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click "Import Project"
3. Sign in with GitHub (use the same account: `VibhavSharmaApps`)
4. Select your repository: **SEOAI**
5. Click "Import"

### 2. Configure Build Settings

Vercel should auto-detect Next.js, but verify:

- **Framework Preset:** Next.js ✅
- **Root Directory:** `./` ✅
- **Build Command:** `npm run build` ✅ (now includes Prisma generate)
- **Output Directory:** (leave empty) ✅

### 3. Add Environment Variables (CRITICAL!)

Go to **Settings** → **Environment Variables** and add ALL of these:

```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Database
DATABASE_URL=postgresql://postgres:[PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres?pgbouncer=true&connection_limit=1

# Shopify
SHOPIFY_API_KEY=your_client_id
SHOPIFY_API_SECRET=your_client_secret
SHOPIFY_ENCRYPTION_KEY=your_64_char_hex_key
```

**Important:**
- Select **all environments** (Production, Preview, Development)
- Copy values from your local `.env` file
- Click "Save" for each variable

### 4. Deploy!

Click **"Deploy"** - Vercel will:
1. Install dependencies
2. Generate Prisma Client
3. Build your Next.js app
4. Deploy to production

### 5. Update Shopify Redirect URL

After deployment, you'll get a URL like: `seoai.vercel.app`

1. Go to [Shopify Partners](https://partners.shopify.com)
2. Select your app → **App setup**
3. Add redirect URL: `https://seoai.vercel.app/api/shopify/callback`

---

## ✅ Done! Auto-Deploy is Active

Now whenever you push to GitHub:

```bash
git add .
git commit -m "Your changes"
git push
```

Vercel will automatically:
- ✅ Detect the push
- ✅ Build your app
- ✅ Deploy to production
- ✅ Send you an email notification

---

## Troubleshooting

### Build fails with "Prisma Client not found"
✅ **Fixed!** The build script now includes `prisma generate`

### Environment variables not working
- Make sure you added them in Vercel dashboard
- Select "All environments" when adding
- Redeploy after adding variables

### Need to see build logs?
- Go to **Deployments** → Click on deployment → **Build Logs**

---

## Your Vercel URL

After first deployment, you'll get:
- **Production:** `https://seoai.vercel.app` (or custom domain)
- **Preview:** `https://seoai-git-branch.vercel.app` (for PRs)

Bookmark your Vercel dashboard: [vercel.com/dashboard](https://vercel.com/dashboard)

