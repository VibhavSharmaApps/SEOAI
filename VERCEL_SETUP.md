# Vercel Monorepo Setup Instructions

## 🚨 IMPORTANT: Vercel Configuration for Turborepo

Your project is a **Turborepo monorepo** with the Next.js app in `apps/web`. Follow these exact steps:

---

## 📋 **Vercel Dashboard Configuration**

### Step 1: Import Project

1. Go to https://vercel.com/new
2. Import your Git repository
3. **DO NOT deploy yet** - configure first!

### Step 2: Configure Build Settings

**Framework Preset:**
- Select: **Next.js**

**Root Directory:**
- Set to: **`apps/web`** ⚠️ **CRITICAL**
- Click "Edit" next to Root Directory
- Type: `apps/web`
- Check "Include source files outside of the Root Directory in the Build Step"

**Build & Development Settings:**
- **Build Command:** `cd ../.. && pnpm build --filter=@workforce/web`
- **Output Directory:** `.next` (default)
- **Install Command:** `pnpm install` (at workspace root)
- **Development Command:** `pnpm dev`

**Node.js Version:**
- Select: **18.x** (or let it auto-detect from `.nvmrc`)

---

## 🔐 **Environment Variables**

Add these in Settings → Environment Variables:

### Required for all environments:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Database
DATABASE_URL=postgresql://...

# AI Provider
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-...

# DataForSEO
DATAFORSEO_LOGIN=your_login
DATAFORSEO_PASSWORD=your_password

# App Settings
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
NODE_ENV=production
```

**Mark as "Sensitive":**
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `DATAFORSEO_LOGIN`
- `DATAFORSEO_PASSWORD`

---

## 🚀 **Deploy**

After configuration:
1. Click **"Deploy"**
2. Wait for build to complete
3. Check deployment URL

---

## ⚠️ **Troubleshooting**

### "No Next.js version detected"

**Cause:** Root Directory not set to `apps/web`

**Fix:**
1. Go to Project Settings → General
2. Find "Root Directory"
3. Click "Edit"
4. Set to `apps/web`
5. Enable "Include source files outside Root Directory"
6. Redeploy

### Build fails with "Command not found"

**Cause:** Build command not finding pnpm or turbo

**Fix:**
1. Ensure build command is: `cd ../.. && pnpm build --filter=@workforce/web`
2. This changes to workspace root before running build
3. Redeploy

### Environment variables not loading

**Cause:** Variables not added or not available in correct environment

**Fix:**
1. Go to Settings → Environment Variables
2. Ensure each variable is checked for Production/Preview/Development
3. Redeploy after adding variables

---

## 📝 **Summary of Key Settings**

| Setting | Value |
|---------|-------|
| Framework | Next.js |
| Root Directory | `apps/web` |
| Build Command | `cd ../.. && pnpm build --filter=@workforce/web` |
| Output Directory | `.next` |
| Install Command | `pnpm install` |
| Node Version | 18.x |

---

## ✅ **Verification**

After deployment, check:
1. Build logs show "pnpm build --filter=@workforce/web"
2. No errors about missing Next.js
3. Deployment URL is accessible
4. Environment variables are loaded

---

## 🔄 **Alternative: Deploy from CLI**

If dashboard setup doesn't work:

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Link project (from workspace root)
vercel link

# Set root directory
vercel project set root-directory apps/web

# Deploy
vercel --prod
```

---

## 📚 **Resources**

- [Vercel Turborepo Guide](https://vercel.com/docs/monorepos/turborepo)
- [Vercel Root Directory](https://vercel.com/docs/concepts/projects/overview#root-directory)
- [Turborepo + Vercel](https://turbo.build/repo/docs/handbook/deploying-with-vercel)
