# 🚀 Quick Start - Vercel Deployment

## ⚠️ CRITICAL SECURITY ISSUE

**Your API keys are currently exposed in `apps/web/.env.local`!**

### IMMEDIATE ACTION REQUIRED:

1. **Rotate ALL API keys NOW:**
   - OpenAI: https://platform.openai.com/api-keys
   - Supabase: https://app.supabase.com/project/_/settings/api
   - Database password in Supabase settings

2. **Never commit `.env.local` again** (already in `.gitignore`)

---

## ✅ What Was Done

I've optimized your project for Vercel with:

### Configuration Files Created:
- ✅ `turbo.json` - Turborepo build configuration
- ✅ `pnpm-workspace.yaml` - Workspace configuration
- ✅ `vercel.json` - Vercel deployment settings
- ✅ `.vercelignore` - Files to exclude from deployment
- ✅ `.nvmrc` - Node.js version specification

### Web App Structure:
- ✅ `apps/web/package.json` - Dependencies and scripts
- ✅ `apps/web/next.config.js` - Optimized Next.js configuration
- ✅ `apps/web/tsconfig.json` - TypeScript configuration
- ✅ `apps/web/tailwind.config.ts` - Tailwind CSS setup
- ✅ `apps/web/middleware.ts` - Security headers
- ✅ `apps/web/.eslintrc.json` - Linting rules

### Utility Libraries:
- ✅ `apps/web/lib/env.ts` - Environment variable validation
- ✅ `apps/web/lib/logger.ts` - Production logging
- ✅ `apps/web/lib/api-response.ts` - Standardized API responses

### App Pages:
- ✅ `apps/web/app/layout.tsx` - Root layout
- ✅ `apps/web/app/page.tsx` - Homepage
- ✅ `apps/web/app/error.tsx` - Error boundary
- ✅ `apps/web/app/not-found.tsx` - 404 page
- ✅ `apps/web/app/loading.tsx` - Loading state
- ✅ `apps/web/app/globals.css` - Global styles

### Documentation:
- ✅ `VERCEL_DEPLOYMENT_GUIDE.md` - Complete deployment guide
- ✅ `DEPLOYMENT_CHECKLIST.md` - Step-by-step checklist
- ✅ `SECURITY.md` - Security best practices
- ✅ `OPTIMIZATION_TIPS.md` - Performance optimization
- ✅ `README.md` - Project overview

---

## 📋 Pre-Deployment Checklist

### 1. Security (CRITICAL)
```bash
# ⚠️ Rotate all API keys immediately!
# ✅ Verify .env.local is not committed
git status | grep .env.local  # Should show nothing

# ✅ Check git history for secrets
git log -p | grep -i "api_key"  # Should show nothing sensitive
```

### 2. Install Dependencies
```bash
pnpm install
```

### 3. Set Up Environment Variables
```bash
# Copy example to your local file
cp apps/web/.env.example apps/web/.env.local

# Edit with your REAL values (with rotated keys!)
# DO NOT use the exposed keys!
```

### 4. Test Locally
```bash
# Development
pnpm dev:web

# Build (must succeed before deploying)
pnpm build:web
```

### 5. Commit Changes
```bash
git add .
git commit -m "Configure for Vercel deployment"
git push origin main
```

---

## 🚢 Deploy to Vercel

### ⚠️ CRITICAL: Monorepo Configuration Required

This is a **Turborepo monorepo**. You MUST configure the Root Directory correctly!

**See [VERCEL_SETUP.md](./VERCEL_SETUP.md) for detailed instructions.**

### Quick Setup:

1. **Go to Vercel**: https://vercel.com/new
2. **Import Repository**: Select your Git repository
3. **Configure Project** (BEFORE deploying):
   - Framework: **Next.js**
   - Root Directory: **`apps/web`** ⚠️ **MUST BE SET**
   - Build Command: `cd ../.. && pnpm build --filter=@workforce/web`
   - Output Directory: `.next`
   - Install Command: `pnpm install`
   - Enable: "Include source files outside Root Directory"

4. **Add Environment Variables** (with NEW rotated keys!):
   ```
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY (mark as Sensitive)
   DATABASE_URL (mark as Sensitive)
   OPENAI_API_KEY (mark as Sensitive, use NEW key)
   ANTHROPIC_API_KEY (mark as Sensitive)
   DATAFORSEO_LOGIN (mark as Sensitive)
   DATAFORSEO_PASSWORD (mark as Sensitive)
   NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
   NODE_ENV=production
   ```

5. **Deploy**: Click "Deploy"

**If you get "No Next.js version detected" error:** See [VERCEL_SETUP.md](./VERCEL_SETUP.md)

### Option 2: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

---

## ✅ Post-Deployment

### 1. Verify Deployment
- [ ] Build completed successfully
- [ ] No errors in build logs
- [ ] Site is accessible
- [ ] All pages load correctly
- [ ] API routes work

### 2. Test Features
- [ ] Homepage loads
- [ ] Dashboard is accessible
- [ ] Database connections work
- [ ] AI API calls succeed (with new keys)

### 3. Performance Check
```bash
# Run Lighthouse audit
# Target: 90+ on all metrics
```

### 4. Security Verification
- [ ] Security headers present (check securityheaders.com)
- [ ] No secrets in browser console
- [ ] HTTPS enforced
- [ ] Environment variables loaded correctly

---

## 📊 Monitoring

### Enable Vercel Analytics (Optional)
```bash
pnpm add @vercel/analytics @vercel/speed-insights

# Already configured in app/layout.tsx
```

### Check Logs
- **Vercel Dashboard** → Your Project → Deployments → Function Logs

---

## 🐛 Common Issues

### Build Fails
```bash
# Locally test build
pnpm build:web

# Check errors and fix
# Common: Missing dependencies, TypeScript errors
```

### Environment Variables Not Working
1. Verify all variables are added in Vercel Dashboard
2. Ensure exact name matches (case-sensitive)
3. Redeploy after adding new variables

### Database Connection Issues
1. Use pooled connection URL (ending in `.pooler.supabase.com`)
2. Verify Supabase allows connections (should allow all IPs)
3. Check connection string format

---

## 📚 Key Documents

| Document | Purpose |
|----------|---------|
| [VERCEL_DEPLOYMENT_GUIDE.md](./VERCEL_DEPLOYMENT_GUIDE.md) | Complete deployment guide with all best practices |
| [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) | Step-by-step deployment checklist |
| [SECURITY.md](./SECURITY.md) | Security best practices and exposed key rotation |
| [OPTIMIZATION_TIPS.md](./OPTIMIZATION_TIPS.md) | Performance optimization strategies |
| [README.md](./README.md) | Project overview and development guide |

---

## 🎯 Next Steps

1. ✅ **Rotate ALL exposed API keys** (most important!)
2. ✅ **Test local build**: `pnpm build:web`
3. ✅ **Deploy to Vercel** using GitHub integration
4. ✅ **Add environment variables** in Vercel Dashboard (with NEW keys)
5. ✅ **Verify deployment** works correctly
6. ✅ **Monitor performance** and errors
7. ✅ **Set up alerts** for downtime/errors

---

## 💡 Pro Tips

1. **Preview Deployments**: Every branch push creates a preview URL
2. **Environment Variables**: Use different values for Production/Preview
3. **Instant Rollback**: Can rollback to any previous deployment instantly
4. **Custom Domains**: Add in Vercel Dashboard → Settings → Domains
5. **Performance**: Enable ISR by adding `export const revalidate = 3600`

---

## ⚡ Performance Optimization Priorities

### High Priority (Do These First)
1. Use Next.js `<Image>` component for all images
2. Add `revalidate` to data-fetching pages
3. Use Edge Runtime for simple API routes
4. Enable ISR for dynamic but cacheable content

### Medium Priority
1. Implement React Query for client-side caching
2. Optimize database queries with proper indexes
3. Use Server Components where possible
4. Add bundle analysis and optimize large dependencies

### Low Priority
1. Add Redis for advanced caching
2. Implement micro-frontends if needed
3. Set up advanced monitoring (Datadog, etc.)

---

## 📞 Support

If you encounter issues:

1. Check the documentation files
2. Review Vercel build logs
3. Check Vercel Function logs for runtime errors
4. Verify environment variables are set correctly
5. Test locally first with `pnpm build:web`

---

## ✨ Summary

Your project is now optimized for Vercel with:
- ✅ Proper monorepo configuration
- ✅ Optimized Next.js settings
- ✅ Security headers and middleware
- ✅ Type-safe environment variables
- ✅ Production-ready error handling
- ✅ Performance optimizations
- ✅ Comprehensive documentation

**Just remember to rotate those exposed API keys before deploying!** 🔐

---

**Ready to deploy! 🚀**
