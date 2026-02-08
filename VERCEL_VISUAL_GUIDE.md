# 📸 Vercel Dashboard - Visual Configuration Guide

## Step-by-Step with Visual Reference

---

## 1️⃣ **Import Project**

Go to: https://vercel.com/new

```
┌─────────────────────────────────────────────────┐
│  Import Git Repository                          │
├─────────────────────────────────────────────────┤
│                                                 │
│  [GitHub icon] Connect GitHub Account           │
│                                                 │
│  Your Repositories:                             │
│  ┌─────────────────────────────────────────┐   │
│  │ ○ SEOAI                        [Import] │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
└─────────────────────────────────────────────────┘
```

Click **"Import"** on your SEOAI repository.

---

## 2️⃣ **Configure Project - CRITICAL SETTINGS**

### ⚠️ Root Directory (MUST SET THIS!)

```
┌─────────────────────────────────────────────────────┐
│  Configure Project                                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Framework Preset:                                  │
│  [Next.js ▼]  ← Auto-detected                       │
│                                                     │
│  Root Directory:                                    │
│  ┌─────────────────────────────────────┐           │
│  │ ./ (Root Directory)         [Edit]  │           │
│  └─────────────────────────────────────┘           │
│  ⚠️ CLICK "Edit" ABOVE!                             │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Click "Edit"** and you'll see:

```
┌─────────────────────────────────────────────────────┐
│  Root Directory                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────────────────────────┐               │
│  │ apps/web                         │ ← Type this!  │
│  └─────────────────────────────────┘               │
│                                                     │
│  ☑ Include source files outside of the Root        │
│    Directory in the Build Step                      │
│    ^ CHECK THIS BOX!                                │
│                                                     │
│  [Cancel]                          [Save]           │
│                                     ↑ Click!        │
└─────────────────────────────────────────────────────┘
```

1. Type: `apps/web`
2. Check: "Include source files outside Root Directory"
3. Click: **"Save"**

---

## 3️⃣ **Build & Development Settings**

Click **"Override"** to customize:

```
┌─────────────────────────────────────────────────────┐
│  Build & Development Settings           [Override]  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Build Command:                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ cd ../.. && pnpm build --filter=@workforce/ │   │
│  │ web                                          │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Output Directory:                                  │
│  ┌─────────────────────────────────────────────┐   │
│  │ .next                                        │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Install Command:                                   │
│  ┌─────────────────────────────────────────────┐   │
│  │ pnpm install                                 │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Development Command:                               │
│  ┌─────────────────────────────────────────────┐   │
│  │ pnpm dev                                     │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Set these exactly:**
- Build Command: `cd ../.. && pnpm build --filter=@workforce/web`
- Output Directory: `.next`
- Install Command: `pnpm install`
- Development Command: `pnpm dev`

---

## 4️⃣ **Environment Variables**

```
┌─────────────────────────────────────────────────────┐
│  Environment Variables                   [Add New]  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌───────────────────────────────────────────┐     │
│  │ Name:  NEXT_PUBLIC_SUPABASE_URL            │     │
│  ├───────────────────────────────────────────┤     │
│  │ Value: https://your-project.supabase.co   │     │
│  ├───────────────────────────────────────────┤     │
│  │ ☑ Production  ☑ Preview  ☑ Development   │     │
│  └───────────────────────────────────────────┘     │
│                                                     │
│  ┌───────────────────────────────────────────┐     │
│  │ Name:  SUPABASE_SERVICE_ROLE_KEY           │     │
│  ├───────────────────────────────────────────┤     │
│  │ Value: ••••••••••••••••••                 │     │
│  ├───────────────────────────────────────────┤     │
│  │ ☑ Production  ☑ Preview  ☑ Development   │     │
│  │ ☑ Sensitive                                │     │
│  └───────────────────────────────────────────┘     │
│                                                     │
│  [+ Add Another]                                    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Add all these variables:**

| Variable | Sensitive? |
|----------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Yes |
| `DATABASE_URL` | ✅ Yes |
| `OPENAI_API_KEY` | ✅ Yes |
| `ANTHROPIC_API_KEY` | ✅ Yes |
| `DATAFORSEO_LOGIN` | ✅ Yes |
| `DATAFORSEO_PASSWORD` | ✅ Yes |
| `NEXT_PUBLIC_APP_URL` | No |
| `NODE_ENV` | No |

---

## 5️⃣ **Deploy**

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  Everything looks good!                             │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │         [Deploy]                             │   │
│  └─────────────────────────────────────────────┘   │
│                      ↑ Click!                       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Click "Deploy"** and wait for build to complete.

---

## ✅ **Successful Build Output**

You should see:

```
Running "vercel build"
✓ Detecting Next.js version...
✓ Next.js 14.2.35 detected
✓ Installing dependencies...
✓ Building application...
✓ Compiled successfully

Route (app)                Size     First Load JS
┌ ○ /                      146 B    172 kB
└ ○ /dashboard/seo-gaps    146 B    172 kB

✓ Build completed successfully
```

---

## ❌ **Error: What You'll See If Root Directory is Wrong**

```
Running "vercel build"
⚠ Warning: Could not identify Next.js version
❌ Error: No Next.js version detected

BUILD FAILED
```

**Solution:** Go back and set Root Directory to `apps/web`

---

## 🔧 **After First Deploy - Fixing Configuration**

If you already deployed and got an error:

### Navigate to Settings

```
┌─────────────────────────────────────────────────────┐
│  [Overview]  [Deployments]  [Settings]  [Analytics] │
│                              ↑ Click here           │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Sidebar:                                           │
│  • General         ← You want this                  │
│  • Domains                                          │
│  • Environment Variables                            │
│  • Git                                              │
│  ...                                                │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Find Root Directory Section

```
┌─────────────────────────────────────────────────────┐
│  Settings > General                                 │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Root Directory                          [Edit]     │
│  ./                                      ↑ Click!   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

1. Click **"Edit"**
2. Change to: `apps/web`
3. Enable: "Include source files..."
4. Click **"Save"**

### Redeploy

```
┌─────────────────────────────────────────────────────┐
│  [Deployments] tab                                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Latest deployment:                                 │
│  ┌─────────────────────────────────────────────┐   │
│  │ Production • Failed • 2 minutes ago    [...] │   │
│  │                                         ↑ Click  │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Menu appears:                                      │
│  • View Function Logs                               │
│  • View Build Logs                                  │
│  • Redeploy             ← Click this!               │
│  • Promote to Production                            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 📋 **Final Checklist Before Deploy**

```
☐ Root Directory set to: apps/web
☐ "Include source files outside Root Directory" is CHECKED
☐ Build Command: cd ../.. && pnpm build --filter=@workforce/web
☐ Install Command: pnpm install
☐ Output Directory: .next
☐ All environment variables added
☐ Sensitive variables marked as "Sensitive"
☐ API keys rotated (not using exposed keys)
```

---

## 🎉 **Success!**

After correct configuration, you'll get:

```
✓ Build completed successfully
✓ Deployment ready at: https://your-app.vercel.app

🎉 Your app is live!
```

---

## 📞 **Need Help?**

- **Error Guide**: [VERCEL_ERROR_FIX.md](./VERCEL_ERROR_FIX.md)
- **Complete Setup**: [VERCEL_SETUP.md](./VERCEL_SETUP.md)
- **Deployment Checklist**: [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)
