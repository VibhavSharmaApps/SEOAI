# Vercel Optimization Tips

## 🚀 Performance Best Practices

### 1. Static Generation vs Server-Side Rendering

```typescript
// ✅ GOOD: Static Generation (fastest)
export default function StaticPage() {
  return <div>Static content</div>;
}

// ✅ GOOD: Static with ISR (revalidate every hour)
export const revalidate = 3600;

export default async function ISRPage() {
  const data = await fetch('https://api.example.com/data');
  return <div>{JSON.stringify(data)}</div>;
}

// ⚠️ USE SPARINGLY: Server-Side Rendering (slower)
export const dynamic = 'force-dynamic';

export default async function SSRPage() {
  const data = await fetch('https://api.example.com/data');
  return <div>{JSON.stringify(data)}</div>;
}
```

### 2. Edge Runtime for API Routes

```typescript
// ✅ BEST: Use Edge Runtime for simple API routes
// apps/web/app/api/fast/route.ts
export const runtime = 'edge';

export async function GET() {
  return Response.json({ message: 'Fast response' });
}

// ⚠️ Node.js Runtime only when you need:
// - Node.js APIs (fs, crypto, etc.)
// - Large dependencies
// - Complex computations
export const runtime = 'nodejs';
```

### 3. Database Query Optimization

```typescript
// ❌ BAD: Multiple sequential queries
const user = await db.user.findUnique({ where: { id: 1 } });
const posts = await db.post.findMany({ where: { userId: user.id } });
const comments = await db.comment.findMany({ where: { postId: posts[0].id } });

// ✅ GOOD: Single query with relations
const user = await db.user.findUnique({
  where: { id: 1 },
  include: {
    posts: {
      include: {
        comments: true,
      },
    },
  },
});

// ✅ BEST: Use Supabase RPC for complex queries
const { data } = await supabase.rpc('get_user_with_posts_and_comments', {
  user_id: 1,
});
```

### 4. Image Optimization

```typescript
// ❌ BAD: Regular <img> tag
<img src="/large-image.jpg" alt="Large image" />

// ✅ GOOD: Next.js Image component
import Image from 'next/image';

<Image
  src="/large-image.jpg"
  alt="Large image"
  width={800}
  height={600}
  priority={false} // true for above-fold images
  placeholder="blur" // requires blurDataURL
  quality={85} // 75-85 is optimal
  loading="lazy"
/>

// ✅ BEST: Remote images with optimization
<Image
  src="https://example.com/image.jpg"
  alt="Remote image"
  width={800}
  height={600}
  loader={({ src, width, quality }) => {
    return `${src}?w=${width}&q=${quality || 75}`;
  }}
/>
```

### 5. Code Splitting

```typescript
// ❌ BAD: Import everything
import HeavyComponent from './HeavyComponent';
import AnotherHeavyComponent from './AnotherHeavyComponent';

// ✅ GOOD: Dynamic imports
import dynamic from 'next/dynamic';

const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <p>Loading...</p>,
  ssr: false, // Disable SSR if component doesn't need it
});

const AnotherHeavyComponent = dynamic(
  () => import('./AnotherHeavyComponent'),
  {
    ssr: true, // Keep SSR if needed for SEO
  }
);
```

### 6. Font Optimization

```typescript
// apps/web/app/layout.tsx
import { Inter, Roboto_Mono } from 'next/font/google';

// ✅ GOOD: Use Next.js font optimization
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-roboto-mono',
});

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${robotoMono.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
```

### 7. Caching Strategies

```typescript
// ✅ Client-side caching with React Query
import { useQuery } from '@tanstack/react-query';

function useData() {
  return useQuery({
    queryKey: ['data'],
    queryFn: fetchData,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });
}

// ✅ Server-side caching with fetch
const data = await fetch('https://api.example.com/data', {
  next: {
    revalidate: 3600, // Cache for 1 hour
    tags: ['data'], // For on-demand revalidation
  },
});

// ✅ Edge caching with headers
export async function GET() {
  return Response.json(
    { data: 'cached response' },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
      },
    }
  );
}
```

### 8. Bundle Size Optimization

```typescript
// ❌ BAD: Import entire library
import _ from 'lodash';
import moment from 'moment';

// ✅ GOOD: Import only what you need
import debounce from 'lodash/debounce';
import { format } from 'date-fns';

// ✅ BEST: Use native alternatives
// Instead of lodash debounce, use native:
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
```

### 9. React Server Components

```typescript
// ✅ BEST: Use Server Components by default
// apps/web/app/page.tsx
async function ServerComponent() {
  const data = await fetchData(); // Runs on server
  
  return (
    <div>
      <h1>{data.title}</h1>
      <ClientComponent data={data} />
    </div>
  );
}

// ✅ GOOD: Use Client Components only when needed
// apps/web/components/ClientComponent.tsx
'use client';

import { useState } from 'react';

export function ClientComponent({ data }) {
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  );
}
```

### 10. API Route Optimization

```typescript
// ✅ GOOD: Add response caching
export async function GET(request: Request) {
  const data = await fetchExpensiveData();
  
  return Response.json(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
    },
  });
}

// ✅ GOOD: Use streaming for large responses
export async function GET() {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      const data = await fetchLargeData();
      
      for (const item of data) {
        controller.enqueue(encoder.encode(JSON.stringify(item) + '\n'));
      }
      
      controller.close();
    },
  });
  
  return new Response(stream, {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

---

## 📊 Monitoring & Analytics

### 1. Bundle Analysis

```bash
# Install bundle analyzer
pnpm add -D @next/bundle-analyzer

# Update next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

module.exports = withBundleAnalyzer(nextConfig);

# Run analysis
ANALYZE=true pnpm build:web
```

### 2. Performance Monitoring

```typescript
// apps/web/app/layout.tsx
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
```

### 3. Custom Performance Metrics

```typescript
// apps/web/lib/metrics.ts
export function reportWebVitals(metric) {
  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log(metric);
  }
  
  // Send to analytics in production
  if (process.env.NODE_ENV === 'production') {
    const body = JSON.stringify(metric);
    const url = '/api/analytics';
    
    // Use `navigator.sendBeacon()` if available, falling back to `fetch()`
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, body);
    } else {
      fetch(url, { body, method: 'POST', keepalive: true });
    }
  }
}
```

---

## 🎯 Quick Wins

### Immediate Improvements

1. **Enable Compression** (automatic on Vercel)
2. **Use Next.js Image** for all images
3. **Add revalidate** to data-fetching pages
4. **Use Edge Runtime** for simple API routes
5. **Enable Turbopack** for faster local dev (experimental)
   ```bash
   pnpm dev:web --turbo
   ```

### Medium-term Improvements

1. **Implement ISR** for dynamic but cacheable pages
2. **Add React Query** for client-side caching
3. **Use Server Components** where possible
4. **Optimize database queries** with proper indexes
5. **Add Redis** for session/cache management (optional)

### Long-term Improvements

1. **Implement CDN** for static assets
2. **Add read replicas** for database scaling
3. **Use Edge Middleware** for geolocation/A-B testing
4. **Implement micro-frontends** if scaling significantly
5. **Add observability** (Datadog, New Relic, etc.)

---

## 📈 Performance Targets

Aim for these metrics:

| Metric | Target | Good | Poor |
|--------|--------|------|------|
| FCP (First Contentful Paint) | < 1.8s | < 2.5s | > 4.0s |
| LCP (Largest Contentful Paint) | < 2.5s | < 4.0s | > 4.0s |
| FID (First Input Delay) | < 100ms | < 300ms | > 300ms |
| CLS (Cumulative Layout Shift) | < 0.1 | < 0.25 | > 0.25 |
| TTFB (Time to First Byte) | < 600ms | < 1.5s | > 1.5s |

---

## 🔧 Tools

- [Lighthouse](https://developers.google.com/web/tools/lighthouse)
- [WebPageTest](https://www.webpagetest.org/)
- [Vercel Analytics](https://vercel.com/analytics)
- [Bundle Analyzer](https://www.npmjs.com/package/@next/bundle-analyzer)
- [React DevTools Profiler](https://react.dev/reference/react/Profiler)

---

## 📚 Resources

- [Next.js Performance](https://nextjs.org/docs/app/building-your-application/optimizing)
- [Vercel Edge Network](https://vercel.com/docs/edge-network/overview)
- [Web Vitals](https://web.dev/vitals/)
- [React Performance](https://react.dev/learn/render-and-commit)
