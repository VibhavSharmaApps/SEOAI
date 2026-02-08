# Vercel Deployment Checklist

## Pre-Deployment (Critical)

### 🔐 Security
- [ ] **Rotate ALL exposed API keys** (see SECURITY.md)
  - [ ] OpenAI API key
  - [ ] Supabase keys
  - [ ] Database password
  - [ ] DataForSEO credentials
- [ ] Remove `.env.local` from Git history if committed
- [ ] Verify `.gitignore` includes all sensitive files
- [ ] No secrets in codebase (run: `git log -p | grep -i "api_key\|password\|secret"`)

### 📦 Dependencies
- [ ] Run `pnpm install` successfully
- [ ] No critical vulnerabilities (`pnpm audit`)
- [ ] All packages have compatible versions
- [ ] Lock file (`pnpm-lock.yaml`) is committed

### ⚙️ Configuration Files
- [ ] `turbo.json` exists and is valid
- [ ] `pnpm-workspace.yaml` configured
- [ ] `vercel.json` configured correctly
- [ ] `next.config.js` optimized
- [ ] `.nvmrc` specifies Node version (18.17.0+)

### 🧪 Testing
- [ ] App runs locally: `pnpm dev:web`
- [ ] App builds successfully: `pnpm build:web`
- [ ] No TypeScript errors: `pnpm type-check`
- [ ] No linting errors: `pnpm lint`
- [ ] All API routes tested
- [ ] Database connection works
- [ ] External APIs (OpenAI, DataForSEO) work

---

## Vercel Setup

### 1️⃣ Project Configuration
- [ ] Import GitHub repository
- [ ] Framework: **Next.js** (auto-detected)
- [ ] Root Directory: Leave as root (monorepo)
- [ ] Build Command: `pnpm build --filter=@workforce/web`
- [ ] Output Directory: `apps/web/.next`
- [ ] Install Command: `pnpm install`

### 2️⃣ Environment Variables
Add all variables in Vercel Dashboard (Settings → Environment Variables):

**Production:**
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` (mark as Sensitive)
- [ ] `DATABASE_URL` (mark as Sensitive)
- [ ] `OPENAI_API_KEY` (mark as Sensitive)
- [ ] `ANTHROPIC_API_KEY` (mark as Sensitive)
- [ ] `DATAFORSEO_LOGIN` (mark as Sensitive)
- [ ] `DATAFORSEO_PASSWORD` (mark as Sensitive)
- [ ] `NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app`
- [ ] `NODE_ENV=production`

**Preview (optional):**
- [ ] Use same variables as Production OR
- [ ] Use separate staging/preview environment

**Development (optional):**
- [ ] Use localhost URLs
- [ ] Use development API keys if available

### 3️⃣ Domain Configuration
- [ ] Add custom domain (if applicable)
- [ ] Update `NEXT_PUBLIC_APP_URL` to match domain
- [ ] Configure DNS records
- [ ] Verify SSL certificate

---

## Deployment

### First Deploy
```bash
# Option 1: Push to GitHub (triggers auto-deploy)
git add .
git commit -m "Configure for Vercel deployment"
git push origin main

# Option 2: Vercel CLI
npm i -g vercel
vercel login
vercel --prod
```

### Verify Deployment
- [ ] Build completed successfully
- [ ] No build errors or warnings
- [ ] Deployment URL accessible
- [ ] Homepage loads correctly
- [ ] Dashboard routes work
- [ ] API routes respond correctly

---

## Post-Deployment

### 🧪 Testing
- [ ] Run Lighthouse audit (aim for 90+ on all metrics)
- [ ] Test all major features
- [ ] Check API endpoints
- [ ] Verify database connections
- [ ] Test on mobile devices
- [ ] Test in different browsers

### 📊 Monitoring Setup
- [ ] Enable Vercel Analytics (optional)
- [ ] Enable Speed Insights (optional)
- [ ] Set up error monitoring (Sentry, etc.)
- [ ] Configure log aggregation
- [ ] Set up uptime monitoring

### 🔍 Performance Optimization
- [ ] Check bundle size (next build output)
- [ ] Optimize images (use Next.js Image)
- [ ] Enable caching where appropriate
- [ ] Configure ISR for dynamic pages
- [ ] Use Edge Runtime for suitable routes

### 🔒 Security Hardening
- [ ] Verify security headers (use securityheaders.com)
- [ ] Test rate limiting
- [ ] Verify authentication works
- [ ] Check CORS configuration
- [ ] Review CSP policy
- [ ] Enable Supabase RLS policies

---

## Maintenance

### Regular Tasks
- [ ] Monitor build times
- [ ] Review Vercel Analytics weekly
- [ ] Check for dependency updates monthly
- [ ] Review error logs regularly
- [ ] Backup database weekly
- [ ] Test disaster recovery plan

### Deployment Workflow
1. **Development**: Work on feature branch
2. **Preview**: Push to branch → Vercel creates preview URL
3. **Testing**: Test preview deployment
4. **Production**: Merge to main → Auto-deploy to production

---

## Troubleshooting

### Build Fails
```bash
# Common issues:
1. Missing dependencies → Run `pnpm install`
2. TypeScript errors → Run `pnpm type-check`
3. Environment variables → Check Vercel dashboard
4. Node version → Verify .nvmrc matches Vercel (18.17.0+)
```

### Runtime Errors
```bash
# Check:
1. Vercel Function Logs (Dashboard → Deployments → Function Logs)
2. Environment variables are set correctly
3. Database connection string is correct
4. API keys are valid and not expired
5. Rate limits not exceeded
```

### Performance Issues
```bash
# Optimize:
1. Enable ISR: Add `export const revalidate = 3600`
2. Use Edge Runtime: `export const runtime = 'edge'`
3. Optimize images: Use Next.js Image component
4. Code splitting: Use dynamic imports
5. Database: Add indexes, use connection pooling
```

---

## Emergency Rollback

If something goes wrong:

```bash
# Via Vercel Dashboard
1. Go to Deployments
2. Find last working deployment
3. Click "..." → "Promote to Production"

# Via CLI
vercel rollback [deployment-url]
```

---

## Success Metrics

After successful deployment:

✅ **Performance:**
- First Contentful Paint < 1.8s
- Largest Contentful Paint < 2.5s
- Time to Interactive < 3.8s
- Cumulative Layout Shift < 0.1

✅ **Reliability:**
- Uptime > 99.9%
- Error rate < 0.1%
- API response time < 500ms

✅ **Security:**
- All security headers present
- No exposed secrets
- Rate limiting active
- Authentication working

---

## Next Steps

After deployment:
1. ✅ Monitor first 24 hours closely
2. ✅ Set up alerts for errors
3. ✅ Document any issues
4. ✅ Share deployment URL with team
5. ✅ Plan next iteration

**Congratulations! 🎉**
Your application is now live on Vercel.
