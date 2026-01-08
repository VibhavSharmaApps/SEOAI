# Vercel Auto-Deployment Setup Guide

This guide will help you set up automatic deployments to Vercel whenever you push to Git.

## Prerequisites

- ✅ Git repository initialized
- ✅ Code pushed to GitHub, GitLab, or Bitbucket
- ✅ Vercel account (sign up at [vercel.com](https://vercel.com))

---

## Step 1: Push Your Code to Git

If you haven't pushed your code to a remote repository yet:

### Option A: GitHub (Recommended)

1. **Create a new repository on GitHub:**
   - Go to [github.com/new](https://github.com/new)
   - Name it (e.g., `seoai`)
   - Don't initialize with README (you already have code)
   - Click "Create repository"

2. **Connect your local repo:**
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/seoai.git
   git branch -M main
   git push -u origin main
   ```

### Option B: GitLab or Bitbucket

Similar process - create a repo and push your code.

---

## Step 2: Connect Repository to Vercel

1. **Go to Vercel Dashboard:**
   - Visit [vercel.com/new](https://vercel.com/new)
   - Sign in with GitHub/GitLab/Bitbucket (use the same account as your Git provider)

2. **Import your repository:**
   - Click "Import Project"
   - Select your repository (`seoai` or whatever you named it)
   - Click "Import"

3. **Configure Project Settings:**
   - **Framework Preset:** Next.js (should auto-detect)
   - **Root Directory:** `./` (leave as default)
   - **Build Command:** `npm run build` (auto-detected)
   - **Output Directory:** `.next` (auto-detected)
   - **Install Command:** `npm install` (auto-detected)

4. **Click "Deploy"** - Vercel will deploy your app!

---

## Step 3: Configure Environment Variables

**Critical:** You must add all environment variables in Vercel for the app to work.

### In Vercel Dashboard:

1. Go to your project → **Settings** → **Environment Variables**

2. Add these variables (copy from your `.env` file):

   ```
   # Clerk Authentication
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...

   # Database
   DATABASE_URL=postgresql://postgres:[PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres?pgbouncer=true&connection_limit=1

   # Shopify OAuth
   SHOPIFY_API_KEY=your_client_id
   SHOPIFY_API_SECRET=your_client_secret
   SHOPIFY_ENCRYPTION_KEY=your_64_char_hex_key
   ```

3. **Important Settings:**
   - Select **all environments** (Production, Preview, Development)
   - Click "Save" for each variable

### Environment Variable Reference:

| Variable | Where to Find It |
|----------|------------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk Dashboard → API Keys |
| `CLERK_SECRET_KEY` | Clerk Dashboard → API Keys |
| `DATABASE_URL` | Supabase Dashboard → Settings → Database |
| `SHOPIFY_API_KEY` | Shopify Partners → App → Client ID |
| `SHOPIFY_API_SECRET` | Shopify Partners → App → Client Secret |
| `SHOPIFY_ENCRYPTION_KEY` | Generated locally (see ENV_SETUP.md) |

---

## Step 4: Configure Build Settings

Vercel should auto-detect Next.js, but verify these settings:

1. Go to **Settings** → **General**
2. Check:
   - **Framework:** Next.js
   - **Node.js Version:** 18.x or 20.x (recommended)
   - **Build Command:** `npm run build`
   - **Output Directory:** (leave empty, Next.js handles this)

### Prisma Build Configuration

Since you're using Prisma, you need to generate the Prisma Client during build:

1. Go to **Settings** → **Build & Development Settings**
2. Add a **Build Command** override:
   ```
   npm run db:generate && npm run build
   ```

   Or update your `package.json` build script (recommended):
   ```json
   "build": "prisma generate && next build"
   ```

---

## Step 5: Update Shopify Redirect URLs

After deployment, you'll get a Vercel URL like `your-app.vercel.app`.

1. **Go to Shopify Partners Dashboard:**
   - [partners.shopify.com](https://partners.shopify.com)
   - Select your app
   - Go to **App setup** → **App URL**

2. **Add Redirect URL:**
   - Add: `https://your-app.vercel.app/api/shopify/callback`
   - Keep `http://localhost:3000/api/shopify/callback` for local testing

---

## Step 6: Auto-Deployment is Now Active! 🎉

Once connected, Vercel will automatically:

- ✅ Deploy when you push to `main`/`master` branch (Production)
- ✅ Create preview deployments for pull requests
- ✅ Rebuild on every push

### How It Works:

1. **Push to Git:**
   ```bash
   git add .
   git commit -m "Your changes"
   git push
   ```

2. **Vercel detects the push** (usually within seconds)

3. **Automatic build starts** - you'll see it in Vercel dashboard

4. **Deployment completes** - your changes are live!

---

## Step 7: Custom Domain (Optional)

If you have a custom domain:

1. Go to **Settings** → **Domains**
2. Add your domain (e.g., `seoai.com`)
3. Follow Vercel's DNS instructions
4. Update `NEXT_PUBLIC_APP_URL` in environment variables if needed

---

## Troubleshooting

### Build Fails

**Error: "Prisma Client not generated"**
- Solution: Add `prisma generate` to build command (see Step 4)

**Error: "Environment variable not found"**
- Solution: Make sure all env vars are added in Vercel dashboard

**Error: "Module not found"**
- Solution: Check that all dependencies are in `package.json`

### Deployment Works But App Errors

**Check:**
1. All environment variables are set in Vercel
2. Database connection string is correct
3. Shopify redirect URLs are updated
4. Check Vercel function logs for errors

### View Logs

- Go to **Deployments** → Click on a deployment → **Functions** tab
- Or use Vercel CLI: `vercel logs`

---

## Vercel CLI (Optional)

You can also deploy from command line:

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# Link to existing project
vercel link
```

---

## Quick Checklist

- [ ] Code pushed to GitHub/GitLab/Bitbucket
- [ ] Repository connected to Vercel
- [ ] All environment variables added in Vercel
- [ ] Build command includes `prisma generate`
- [ ] Shopify redirect URLs updated
- [ ] First deployment successful
- [ ] Test OAuth flow on production URL

---

## Next Steps

After setup:

1. **Test the deployment:**
   - Visit your Vercel URL
   - Try logging in
   - Test Shopify OAuth connection

2. **Set up branch protection:**
   - Use `main` branch for production
   - Create `develop` branch for testing

3. **Monitor deployments:**
   - Vercel sends email notifications
   - Check dashboard for build status

4. **Set up preview deployments:**
   - Create pull requests to test changes
   - Vercel creates preview URLs automatically

---

## Support

- **Vercel Docs:** [vercel.com/docs](https://vercel.com/docs)
- **Vercel Status:** [vercel-status.com](https://vercel-status.com)
- **Community:** [github.com/vercel/vercel/discussions](https://github.com/vercel/vercel/discussions)


