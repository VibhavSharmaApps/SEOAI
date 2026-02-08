# Workforce SEO Dashboard (Next.js 15)

The AI-powered dashboard for autonomous WordPress SEO optimization.

## Features

### 1. SEO Gap Detection & Auto-Fix
- **Detects**: Missing H1, meta tags, focus keywords
- **AI Generates**: Optimized content using GPT-4o-mini or Claude
- **Applies**: Instant updates via WordPress plugin API

See: [`/dashboard/seo-gaps`](./app/dashboard/seo-gaps/page.tsx) for demo

### 2. Opportunities System (Keywords #11-20)
- **Finds**: Keywords ranking on page 2 with high traffic potential
- **Calculates**: Estimated traffic gain if moved to position 1
- **Scores**: Smart prioritization (volume × gain × ease)

See: [`OPPORTUNITIES_USAGE.md`](../../OPPORTUNITIES_USAGE.md)

### 3. Multi-Provider AI
- **OpenAI GPT-4o-mini** — Fast, cost-effective
- **Anthropic Claude** — Powerful, nuanced

See: [`packages/ai-agents`](../../packages/ai-agents/)

## Quick Start

```bash
# Install dependencies
pnpm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your credentials

# Run development server
pnpm dev
```

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# AI
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-...

# DataForSEO (for opportunities)
DATAFORSEO_LOGIN=your_login@example.com
DATAFORSEO_PASSWORD=your_password
```

## Key Server Actions

```typescript
// SEO Gaps
import { fixSEOGaps } from "@/app/actions/seo-gaps";

// Opportunities
import { syncProjectOpportunities } from "@/app/actions/opportunities";

// Projects
import { createProject } from "@/app/actions/projects";
```

## WordPress Integration

All updates are sent to:

```
POST https://yoursite.com/wp-json/workforce/v1/execute
```

With actions:
- `update_post` — Content, title, H1 injection
- `update_meta` — Meta title, description, focus keyword
- `update_schema` — JSON-LD markup
- `batch` — Multiple operations at once

## Tech Stack

- **Next.js 15** (App Router)
- **React 19**
- **Tailwind CSS** + **shadcn/ui**
- **Supabase** (PostgreSQL + Auth)
- **TypeScript** (strict mode)
- **Server Actions** (no API routes!)
