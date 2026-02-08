# 🔧 Fix Build Error: "Command exited with 1"

## The Problem

```
Error: Command "cd ../.. && pnpm build --filter=@workforce/web" exited with 1
```

This happens because Vercel handles Turborepo monorepos automatically and doesn't need manual `cd` commands.

---

## ✅ **The Solution: Correct Vercel Dashboard Settings**

### **Step 1: Go to Settings**

Vercel Dashboard → Your Project → **Settings** → **General**

### **Step 2: Configure These Exact Settings**

#### **Root Directory:**
```
apps/web
```
☑️ **Check:** "Include source files outside of the Root Directory in the Build Step"

#### **Build & Development Settings:**

Click **"Override"** and set:

| Setting | Value |
|---------|-------|
| **Build Command** | Leave **EMPTY** or use: `pnpm build` |
| **Output Directory** | `.next` |
| **Install Command** | Leave **EMPTY** (auto-detected) |
| **Development Command** | `pnpm dev` |

**Why leave Build Command empty?**  
Vercel automatically detects Next.js and Turborepo. When Root Directory is set to `apps/web`, it:
1. Installs dependencies at workspace root
2. Builds the Next.js app in `apps/web`
3. Handles all monorepo complexity automatically

---

## 🎯 **Alternative: If You Need Custom Build Command**

If you must override, use one of these:

### **Option A: Simple Next.js Build** (Recommended)
```bash
pnpm build
```

### **Option B: Turbo Build from Root**
```bash
turbo build --filter=@workforce/web
```
**Note:** Don't use `cd` commands - Vercel handles directory context.

---

## 📋 **Complete Settings Checklist**

Copy these EXACT settings to Vercel Dashboard:

```
Framework Preset: Next.js
Root Directory: apps/web
☑ Include source files outside Root Directory: ENABLED

Build Command: (leave empty or use: pnpm build)
Output Directory: .next
Install Command: (leave empty)
Development Command: pnpm dev

Node.js Version: 18.x
```

---

## 🔍 **How to Verify**

After saving settings and redeploying, check build logs:

### ✅ **Success - Should See:**
```
Installing dependencies...
✓ Dependencies installed

Running build command from root dir
> pnpm build

Building @workforce/web...
✓ Next.js 14.2.35 detected
✓ Compiled successfully
✓ Build completed
```

### ❌ **Error - Will See:**
```
Error: Command "cd ../.. && pnpm build..." exited with 1
```

---

## 🛠️ **Step-by-Step Fix**

1. **Go to Vercel Dashboard**
   - Your Project → Settings → General

2. **Set Root Directory:**
   - Click "Edit" on Root Directory
   - Type: `apps/web`
   - Enable: "Include source files outside Root Directory"
   - Click "Save"

3. **Override Build Settings:**
   - Find "Build & Development Settings"
   - Click "Override"
   - **Build Command:** Leave empty (or `pnpm build`)
   - **Output Directory:** `.next`
   - **Install Command:** Leave empty
   - **Development Command:** `pnpm dev`
   - Click "Save"

4. **Redeploy:**
   - Go to Deployments tab
   - Click "..." on latest deployment
   - Click "Redeploy"

---

## 💡 **Why This Works**

When you set Root Directory to `apps/web`:

1. ✅ Vercel detects it's a monorepo
2. ✅ Automatically installs dependencies from workspace root
3. ✅ Runs build from the correct context
4. ✅ Handles Turborepo filtering automatically
5. ✅ No need for manual `cd` commands

**The build command `cd ../.. && pnpm build` was causing issues because:**
- Vercel already handles the monorepo context
- The `cd` command was unnecessary and conflicting
- Simple `pnpm build` or auto-detection works better

---

## 🆘 **Still Having Issues?**

### **Check Environment Variables**

Build might fail if environment variables are missing:

Required variables:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL
OPENAI_API_KEY
NEXT_PUBLIC_APP_URL
NODE_ENV
```

### **Check Build Logs**

Look for specific errors:
- Missing dependencies → Install command issue
- TypeScript errors → Check your code
- Missing env vars → Add in Settings → Environment Variables
- Module not found → Check imports and dependencies

### **Try Vercel CLI**

```bash
# From workspace root
npm i -g vercel
vercel link
vercel env pull
vercel build
```

This will show you the exact error locally.

---

## ✅ **Final Configuration**

After following these steps, your Vercel configuration should be:

```json
// apps/web/vercel.json (simplified)
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs"
}
```

**Vercel Dashboard Settings:**
- Root Directory: `apps/web` ✅
- Include source files: ☑️ ENABLED ✅
- Build Command: (empty or `pnpm build`) ✅
- Output Directory: `.next` ✅
- Install Command: (empty) ✅

---

## 📚 **Resources**

- [Vercel Monorepos](https://vercel.com/docs/monorepos)
- [Turborepo + Vercel](https://turbo.build/repo/docs/handbook/deploying-with-vercel)
- [Next.js Deployment](https://nextjs.org/docs/deployment)

---

**Save these settings and redeploy. Your build should work!** 🚀
