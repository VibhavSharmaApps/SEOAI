# 🚀 Deploy to Vercel - Quick Reference

## ⚡ 3-Step Deploy (5 minutes)

### Step 1: Configure Vercel Dashboard

Go to: **https://vercel.com/new**

**CRITICAL SETTINGS:**

| Setting | Value |
|---------|-------|
| Framework | Next.js |
| **Root Directory** | **`apps/web`** ⚠️ |
| Include source files | **✅ ENABLE** |
| Build Command | `cd ../.. && pnpm build --filter=@workforce/web` |
| Output Directory | `.next` |
| Install Command | `pnpm install` |

---

### Step 2: Add Environment Variables

Settings → Environment Variables → Add New

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key     # Mark Sensitive
DATABASE_URL=postgresql://...                        # Mark Sensitive
OPENAI_API_KEY=sk-proj-...                          # Mark Sensitive
ANTHROPIC_API_KEY=sk-ant-...                        # Mark Sensitive
DATAFORSEO_LOGIN=your_login                         # Mark Sensitive
DATAFORSEO_PASSWORD=your_password                   # Mark Sensitive
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
NODE_ENV=production
```

**⚠️ IMPORTANT:** Use NEW rotated API keys, not exposed ones!

---

### Step 3: Deploy

Click **"Deploy"** button.

---

## 🔴 Getting Error: "No Next.js version detected"?

**Quick Fix:**

1. Settings → General → Root Directory → **Edit**
2. Set to: `apps/web`
3. Enable: "Include source files outside Root Directory"
4. **Save**
5. Deployments → ... menu → **Redeploy**

**Detailed Fix:** [VERCEL_ERROR_FIX.md](./VERCEL_ERROR_FIX.md)

---

## ✅ Success Checklist

```
✓ Root Directory = apps/web
✓ Include source files = ENABLED
✓ Build command has "cd ../.."
✓ All environment variables added
✓ Sensitive variables marked
✓ Build succeeds
✓ App accessible at Vercel URL
```

---

## 📚 Full Documentation

| Document | Purpose |
|----------|---------|
| [VERCEL_ERROR_FIX.md](./VERCEL_ERROR_FIX.md) | Fix "No Next.js detected" error |
| [VERCEL_VISUAL_GUIDE.md](./VERCEL_VISUAL_GUIDE.md) | Visual step-by-step with ASCII diagrams |
| [VERCEL_SETUP.md](./VERCEL_SETUP.md) | Complete setup instructions |
| [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) | Full pre/post deployment checklist |
| [SECURITY.md](./SECURITY.md) | Security best practices & key rotation |

---

## 🆘 Still Having Issues?

### Try Vercel CLI:

```bash
npm i -g vercel
cd C:\Users\vbhav\SEOAI
vercel link
vercel project set root-directory apps/web
vercel --prod
```

---

## 🎉 Deploy Now!

https://vercel.com/new

**Remember:** Set Root Directory to `apps/web` FIRST!
