# ⚡ Fix Build Error RIGHT NOW

## Current Error

```
Error: Command "cd ../.. && pnpm build --filter=@workforce/web" exited with 1
```

---

## ✅ **3-Step Fix (2 minutes)**

### 1️⃣ **Go to Vercel Settings**

https://vercel.com → Your Project → **Settings** → **General**

### 2️⃣ **Update Build Settings**

Find **"Build & Development Settings"** section:

Click **"Override"** and change:

| Setting | FROM (wrong) | TO (correct) |
|---------|--------------|--------------|
| Build Command | `cd ../.. && pnpm build...` | **(DELETE - leave empty)** |
| Install Command | `pnpm install` | **(DELETE - leave empty)** |

**Why?** Vercel auto-detects Turborepo monorepos and handles the build automatically when Root Directory is set.

### 3️⃣ **Save & Redeploy**

1. Click **"Save"** at bottom
2. Go to **Deployments** tab
3. Click **"..."** menu → **"Redeploy"**

---

## 📋 **Your Final Settings Should Be:**

```
Framework: Next.js
Root Directory: apps/web ✓
☑ Include source files outside Root Directory

Build Command: (empty)
Output Directory: .next
Install Command: (empty)
Development Command: pnpm dev
```

---

## ✅ **Expected Result**

After redeploy, build logs should show:

```
✓ Installing dependencies
✓ Running build
✓ Next.js 14.2.35 detected
✓ Build completed successfully
✓ Deployment ready
```

---

## 🆘 **Still Not Working?**

### **Option A: Use Simple Build Command**

Instead of leaving empty, try:
```
pnpm build
```

### **Option B: Check Environment Variables**

Make sure ALL these are added in Settings → Environment Variables:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL
OPENAI_API_KEY
NEXT_PUBLIC_APP_URL
NODE_ENV=production
```

### **Option C: Check Build Logs**

Look for specific errors:
- `Cannot find module` → Missing dependency
- TypeScript errors → Code issue
- `Missing environment variable` → Add in Settings

---

## 💡 **Why This Happened**

The build command `cd ../.. && pnpm build --filter=@workforce/web` was:
- ❌ Unnecessary (Vercel handles monorepo automatically)
- ❌ Causing conflicts with Vercel's auto-detection
- ❌ Wrong directory context

**Simple solution:** Let Vercel handle it automatically! 🎉

---

## 🚀 **Do This Now:**

1. Vercel Dashboard → Settings → General
2. Build Command: **(DELETE, leave empty)**
3. Install Command: **(DELETE, leave empty)**
4. Save
5. Redeploy

**Time to fix:** 2 minutes  
**Build time:** 2-3 minutes

---

**Your build will succeed!** ✅
