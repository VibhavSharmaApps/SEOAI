# Vercel Deployment Guide for Workforce SEO

## 🚀 Pre-Deployment Checklist

### 1. **Environment Variables Setup**
Before deploying, configure these environment variables in Vercel Dashboard:

#### Required Variables:
```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Database
DATABASE_URL=postgresql://postgres.xxxxx:password@...

# AI Provider API Keys
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-...

# DataForSEO API
DATAFORSEO_LOGIN=your_login@example.com
DATAFORSEO_PASSWORD=your_password

# Application Settings
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
NODE_ENV=production
```

### 2. **Security Best Practices**

✅ **NEVER commit these files:**
- `.env.local`
- `.env`
- Any file containing API keys or secrets

✅ **Use Vercel Environment Variables:**
- Go to Project Settings → Environment Variables
- Add all variables from `.env.example`
- Use different values for Production/Preview/Development

✅ **API Keys Security:**
- Rotate any exposed API keys immediately
- Use Vercel's encrypted environment variables
- Enable "Sensitive" flag for secret keys

### 3. **Performance Optimization**

#### A. Image Optimization
```typescript
// Use Next.js Image component
import Image from 'next/image';

<Image
  src="/path/to/image.jpg"
  width={800}
  height={600}
  alt="Description"
  priority={false} // Set true for above-fold images
  loading="lazy" // Default behavior
/>
```

#### B. Code Splitting
- Use dynamic imports for large components
```typescript
import dynamic from 'next/dynamic';

const HeavyComponent = dynamic(() => import('@/components/HeavyComponent'), {
  loading: () => <p>Loading...</p>,
  ssr: false, // Disable SSR if not needed
});
```

#### C. API Routes Optimization
```typescript
// apps/web/app/api/example/route.ts
export const runtime = 'edge'; // Use Edge Runtime when possible
export const dynamic = 'force-dynamic'; // or 'force-static' for static routes
export const revalidate = 3600; // ISR: Revalidate every hour
```

### 4. **Database & External Services**

#### Supabase Connection Pooling
```bash
# Use pooled connection for serverless
DATABASE_URL=postgresql://...pooler.supabase.com:5432/postgres
```

#### Connection Limits
- Vercel serverless functions are stateless
- Use connection pooling (already configured with Supabase)
- Close connections properly in API routes

### 5. **Monorepo Configuration**

Your project uses Turborepo + pnpm:

```json
// Root directory structure
{
  "buildCommand": "pnpm build --filter=@workforce/web",
  "installCommand": "pnpm install",
  "outputDirectory": "apps/web/.next"
}
```

### 6. **Build Optimization**

#### Package.json Scripts
```json
{
  "scripts": {
    "build": "turbo build",
    "build:web": "turbo build --filter=@workforce/web"
  }
}
```

#### Reduce Bundle Size
- Remove unused dependencies
- Use tree-shaking
- Enable compression (auto-enabled on Vercel)

### 7. **Caching Strategy**

```typescript
// Static Generation with ISR
export const revalidate = 3600; // Revalidate every hour

// Dynamic with caching
export const dynamic = 'force-dynamic';

// Edge Caching
export const runtime = 'edge';
```

### 8. **Monitoring & Logging**

```typescript
// apps/web/lib/logger.ts
export const logger = {
  info: (message: string, data?: any) => {
    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify({ level: 'info', message, data, timestamp: new Date().toISOString() }));
    } else {
      console.log(message, data);
    }
  },
  error: (message: string, error?: any) => {
    console.error(JSON.stringify({ level: 'error', message, error: error?.message, stack: error?.stack, timestamp: new Date().toISOString() }));
  },
};
```

### 9. **Error Handling**

```typescript
// apps/web/app/error.tsx
'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={() => reset()}>Try again</button>
    </div>
  );
}
```

### 10. **Rate Limiting**

```typescript
// apps/web/lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Optional: Add Upstash Redis for rate limiting
export const ratelimit = process.env.UPSTASH_REDIS_REST_URL
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(10, '10 s'),
    })
  : null;
```

---

## 📋 Deployment Steps

### Option 1: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

### Option 2: Deploy via GitHub Integration

1. Push code to GitHub
2. Import repository in Vercel Dashboard
3. Configure:
   - **Framework Preset:** Next.js
   - **Root Directory:** Leave as root (monorepo auto-detected)
   - **Build Command:** `pnpm build --filter=@workforce/web`
   - **Output Directory:** `apps/web/.next`
   - **Install Command:** `pnpm install`

### Option 3: Deploy via Vercel Dashboard

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your Git repository
3. Vercel auto-detects Turborepo
4. Add environment variables
5. Click "Deploy"

---

## 🔧 Post-Deployment

### 1. **Verify Deployment**
- [ ] Check build logs for errors
- [ ] Test all API routes
- [ ] Verify environment variables are loaded
- [ ] Test database connections
- [ ] Check external API integrations (OpenAI, DataForSEO)

### 2. **Performance Testing**
- [ ] Run Lighthouse audit
- [ ] Check Core Web Vitals
- [ ] Monitor response times
- [ ] Test on different devices

### 3. **Domain Setup**
```bash
# Add custom domain in Vercel Dashboard
# Update environment variable:
NEXT_PUBLIC_APP_URL=https://your-custom-domain.com
```

### 4. **Continuous Deployment**
- Every push to `main` → Production
- Every push to other branches → Preview deployments
- Pull requests get automatic preview URLs

---

## ⚠️ Common Issues & Solutions

### Issue 1: Build Fails
```bash
# Check if pnpm is installed
# Verify turbo.json configuration
# Check package.json scripts
```

### Issue 2: Environment Variables Not Working
- Ensure variables are added in Vercel Dashboard
- Check if variable names match exactly
- Redeploy after adding new variables

### Issue 3: Database Connection Errors
- Use pooled connection URL
- Verify Supabase IP allowlist (should allow all IPs)
- Check connection string format

### Issue 4: API Routes Timeout
- Optimize database queries
- Add caching where possible
- Use Edge runtime for faster responses
- Check serverless function timeout (default: 10s)

### Issue 5: Large Bundle Size
```bash
# Analyze bundle
npm install -g @next/bundle-analyzer
ANALYZE=true npm run build
```

---

## 📊 Monitoring & Analytics

### Vercel Analytics
```bash
npm install @vercel/analytics

# Add to apps/web/app/layout.tsx
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

### Speed Insights
```bash
npm install @vercel/speed-insights

# Add to apps/web/app/layout.tsx
import { SpeedInsights } from '@vercel/speed-insights/next';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
```

---

## 🎯 Best Practices Summary

1. ✅ Use environment variables for all secrets
2. ✅ Enable ISR for dynamic but cacheable content
3. ✅ Use Edge Runtime where possible
4. ✅ Implement proper error handling
5. ✅ Add monitoring and analytics
6. ✅ Optimize images with Next.js Image component
7. ✅ Use dynamic imports for code splitting
8. ✅ Implement rate limiting for API routes
9. ✅ Use connection pooling for database
10. ✅ Test preview deployments before production

---

## 📚 Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Turborepo with Vercel](https://turbo.build/repo/docs/handbook/deploying-with-vercel)
- [Supabase with Vercel](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)

---

## 🔒 Security Reminders

⚠️ **URGENT**: Your current `.env.local` contains exposed API keys:
- OpenAI API key is visible
- Supabase keys are visible
- Database credentials are exposed

### Immediate Actions Required:
1. **Rotate all API keys immediately**
2. **Never commit `.env.local` or `.env` files**
3. **Add all secrets to Vercel Environment Variables**
4. **Review git history and remove any committed secrets**

```bash
# Remove sensitive files from git history
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch apps/web/.env.local" \
  --prune-empty --tag-name-filter cat -- --all
```

---

## ✅ Ready to Deploy!

Your project is now optimized for Vercel. Follow the deployment steps above and monitor your application's performance post-deployment.
