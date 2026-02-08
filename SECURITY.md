# Security Best Practices

## ⚠️ CRITICAL: Exposed Secrets

### Immediate Action Required

Your `.env.local` file contains **exposed API keys and secrets**. These must be rotated immediately:

1. **OpenAI API Key**: `sk-proj-hNEYYeQlBUBQQwIcvyitU45P9...` ← ROTATE NOW
2. **Supabase Keys**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` ← ROTATE NOW
3. **Database Credentials**: Connection string exposed ← CHANGE PASSWORD

### How to Rotate Keys

#### 1. OpenAI
- Go to https://platform.openai.com/api-keys
- Revoke the exposed key
- Generate a new key
- Add to Vercel environment variables only (NEVER commit)

#### 2. Supabase
- Go to your Supabase project settings
- Navigate to API settings
- Reset your service role key
- Update anon key if compromised
- Add to Vercel environment variables

#### 3. Database
- Update the Supabase database password
- Get new connection string
- Update in Vercel environment variables

---

## 🔒 Environment Variables Security

### Rules (NEVER Break These)

1. ✅ **NEVER** commit `.env`, `.env.local`, or any file with secrets
2. ✅ **NEVER** push API keys to Git
3. ✅ **NEVER** share secrets in screenshots or logs
4. ✅ **ALWAYS** use environment variables for secrets
5. ✅ **ALWAYS** add sensitive variables to `.gitignore`

### Proper Setup

```bash
# .gitignore (already configured)
.env
.env*.local
.env.local
.env.development.local
.env.test.local
.env.production.local
```

### Adding Secrets to Vercel

```bash
# Option 1: Vercel Dashboard
1. Go to Project Settings
2. Environment Variables
3. Add each variable
4. Select environments (Production/Preview/Development)
5. Mark as "Sensitive" for secrets

# Option 2: Vercel CLI
vercel env add OPENAI_API_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add DATABASE_URL
```

---

## 🛡️ API Security

### Rate Limiting

Implement rate limiting on all API routes:

```typescript
// apps/web/lib/rate-limit.ts
import { NextRequest } from 'next/server';

const rateLimit = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(request: NextRequest, limit = 10, window = 60000) {
  const ip = request.ip || 'unknown';
  const now = Date.now();
  const record = rateLimit.get(ip);

  if (!record || now > record.resetTime) {
    rateLimit.set(ip, { count: 1, resetTime: now + window });
    return { allowed: true, remaining: limit - 1 };
  }

  if (record.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  record.count++;
  return { allowed: true, remaining: limit - record.count };
}
```

### Usage in API Routes

```typescript
// apps/web/app/api/example/route.ts
import { checkRateLimit } from '@/lib/rate-limit';
import { apiResponse } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  const { allowed, remaining } = checkRateLimit(request);
  
  if (!allowed) {
    return apiResponse.tooManyRequests('Rate limit exceeded');
  }

  // Your API logic here
  return apiResponse.success({ data: 'success' });
}
```

---

## 🔐 Authentication & Authorization

### Supabase Auth Setup

```typescript
// apps/web/lib/supabase-server.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { serverEnv } from './env';

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );
}
```

### Protected API Routes

```typescript
// apps/web/app/api/protected/route.ts
import { createClient } from '@/lib/supabase-server';
import { apiResponse } from '@/lib/api-response';

export async function GET() {
  const supabase = createClient();
  
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return apiResponse.unauthorized();
  }

  // Your protected logic here
  return apiResponse.success({ user });
}
```

---

## 🌐 CORS & CSP

### Content Security Policy

```typescript
// apps/web/middleware.ts
export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Content Security Policy
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://bbhxvgxrzfzpbrkkddsh.supabase.co",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
  );

  return response;
}
```

---

## 📊 Logging & Monitoring

### Security Logging

```typescript
// apps/web/lib/security-logger.ts
import { logger } from './logger';

export const securityLogger = {
  authFailure(reason: string, context?: any) {
    logger.warn(`Auth failure: ${reason}`, {
      type: 'security',
      event: 'auth_failure',
      ...context,
    });
  },

  suspiciousActivity(description: string, context?: any) {
    logger.error(`Suspicious activity: ${description}`, undefined, {
      type: 'security',
      event: 'suspicious_activity',
      ...context,
    });
  },

  apiKeyUsage(endpoint: string, success: boolean) {
    logger.info(`API key usage: ${endpoint}`, {
      type: 'security',
      event: 'api_key_usage',
      endpoint,
      success,
    });
  },
};
```

---

## 🔍 Input Validation

### Validate All Inputs

```typescript
// apps/web/lib/validation.ts
import { z } from 'zod';

export const schemas = {
  email: z.string().email(),
  url: z.string().url(),
  keyword: z.string().min(1).max(200),
  page: z.number().int().positive(),
};

// Usage in API route
export async function POST(request: NextRequest) {
  const body = await request.json();
  
  const result = schemas.email.safeParse(body.email);
  
  if (!result.success) {
    return apiResponse.badRequest('Invalid email');
  }

  // Process validated data
}
```

---

## 🚨 Git History Cleanup

If you've accidentally committed secrets, clean your Git history:

```bash
# Remove sensitive file from history
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch apps/web/.env.local" \
  --prune-empty --tag-name-filter cat -- --all

# Force push (DANGER: Only do this if you're sure)
git push origin --force --all

# Clean up
rm -rf .git/refs/original/
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

**Better approach**: If the repo is new, consider deleting and recreating it.

---

## ✅ Security Checklist

Before deploying:

- [ ] All API keys rotated
- [ ] No secrets in Git history
- [ ] Environment variables in Vercel only
- [ ] Rate limiting implemented
- [ ] Authentication on protected routes
- [ ] Input validation on all endpoints
- [ ] Security headers configured
- [ ] HTTPS enforced
- [ ] CSP policy defined
- [ ] Error messages don't leak sensitive info
- [ ] Logging configured (no sensitive data in logs)
- [ ] Database uses connection pooling
- [ ] Supabase RLS policies enabled
- [ ] API routes have proper error handling

---

## 📚 Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security](https://nextjs.org/docs/app/building-your-application/configuring/security)
- [Vercel Security](https://vercel.com/docs/security)
- [Supabase Security](https://supabase.com/docs/guides/platform/going-into-prod)
