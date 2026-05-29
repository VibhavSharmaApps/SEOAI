# CLAUDE.md — Workforce SEO (AI-Powered SEO/GEO Tool for SMBs)

## Project overview

Workforce SEO is a SaaS platform that automates SEO and GEO (Generative Engine Optimization) for small businesses. It connects to a customer's WordPress site via a plugin, detects SEO problems, generates AI-powered fixes, and applies them autonomously. The tool also tracks keyword opportunities (positions 11-20) and optimizes content to be cited by AI search engines (ChatGPT, Perplexity, Google AI Overviews).

The codebase is an inherited Turborepo monorepo. The backend scaffolding (DB schema, WP plugin, DataForSEO integration) is solid. The AI agents, dashboard UI, auth, billing, and GEO features need to be built from scratch.

## Tech stack

- **Monorepo**: Turborepo + pnpm workspaces
- **Frontend**: Next.js 14 (App Router), React 18, Tailwind CSS 3.4, TypeScript 5.5
- **Backend**: Next.js Server Actions + API Routes (no separate backend)
- **Database**: Supabase (PostgreSQL + Auth + RLS)
- **AI**: Anthropic Claude (primary), OpenAI GPT-4o-mini (secondary/fallback)
- **SEO data**: DataForSEO API (ranked keywords, SERP data)
- **CMS integration**: WordPress REST API via custom plugin (`apps/wp-plugin`)
- **Deployment**: Vercel (web app), WordPress plugin distributed as .zip
- **Node**: v18.17.0 (see `.nvmrc`)
- **Package manager**: pnpm 9+

## Repo structure

```
workforce-seo/
├── apps/
│   ├── web/                    # Next.js 14 dashboard (main app)
│   │   ├── app/
│   │   │   ├── actions/        # Server Actions (opportunities, projects, seo-gaps)
│   │   │   ├── api/            # API routes (opportunities sync)
│   │   │   └── dashboard/      # Dashboard pages (seo-gaps is the only one)
│   │   ├── lib/                # Shared utilities
│   │   │   ├── dataforseo.ts   # DataForSEO API client + opportunity scoring
│   │   │   ├── schema-factory.ts # JSON-LD structured data generator
│   │   │   ├── supabase.ts     # Supabase client (admin, server, browser)
│   │   │   ├── env.ts          # Env var validation
│   │   │   ├── api-response.ts # Standardized API response helpers
│   │   │   └── logger.ts       # Production logging utility
│   │   └── types/              # TypeScript types (database.ts, seo-gaps.ts)
│   └── wp-plugin/              # WordPress plugin (PHP 8.0+)
│       ├── workforce-seo.php   # Plugin entry, JSON-LD output, admin hooks
│       └── includes/
│           ├── class-rest-api.php      # /execute endpoint (update_post, update_meta, update_schema, batch)
│           ├── class-seo-analyzer.php  # Extract page data, headings, FAQ candidates
│           ├── class-api-client.php    # WP → Next.js communication
│           └── class-admin-page.php    # WP admin settings UI
├── packages/
│   ├── ai-agents/              # EMPTY — AI agent package (to be built)
│   │   └── src/
│   ├── seo-utils/              # EMPTY — shared SEO utilities (to be built)
│   │   └── src/
│   └── supabase/
│       └── migrations/
│           ├── 00001_initial_schema.sql     # Users, sites, pages, keywords, GSC, change_intents
│           └── 00002_opportunities_system.sql # Projects, opportunities, actions, position history
├── package.json                # Root — Turborepo scripts
├── turbo.json                  # Build pipeline config
└── pnpm-workspace.yaml         # Workspace definition
```

## What is built vs what needs building

### ✅ Built and working
- Supabase schema with 14 tables, RLS policies, triggers, helper functions
- DataForSEO integration (fetch ranked keywords, calculate opportunity scores, CTR curves)
- SEO gap detection logic (missing H1, meta title/desc length, schema, focus keyword)
- Schema factory (Article, WebPage, FAQPage JSON-LD generation + @graph combiner)
- WordPress plugin with /execute REST endpoint (update_post, update_meta, update_schema, batch operations)
- WP SEO analyzer (extract page data, headings, FAQ candidates from content)
- WP plugin supports Yoast, Rank Math, AIOSEO meta field updates simultaneously
- Audit trail logging in WP (stores last 100 updates per post)
- Server actions for opportunity CRUD, project management
- API route for opportunity sync (POST /api/opportunities/sync)
- Env validation, structured logging, API response helpers

### ⚠️ Stubbed / placeholder (needs real implementation)
- AI content generation in `seo-gaps.ts` — all `generate*` functions return simple string manipulation, not AI output. The `_agent` parameter is always null. The TODO comment says "Implement AI agent integration"
- The SEO gaps dashboard page (`app/dashboard/seo-gaps/page.tsx`) uses hardcoded EXAMPLE_PAGE data, not real WordPress site data

### ❌ Not started (needs to be built from scratch)
- `packages/ai-agents/` — completely empty, this is the AI brain of the product
- Authentication (Supabase Auth integration, login/signup pages, session management)
- Dashboard UI (site management, opportunities dashboard, SEO audit views, settings)
- GEO optimization (FAQ generation for AI citations, content restructuring for AI search)
- Onboarding flow (connect WordPress site, install plugin, verify connection)
- Billing (Stripe integration, plans, usage tracking)
- Multi-tenancy (user → sites → projects isolation)
- Internal linking suggestions
- Content performance tracking (GSC data ingestion)
- Scheduled automation (cron jobs for opportunity re-sync, auto-fix scheduling)
- `packages/seo-utils/` — empty shared utilities package

## Important patterns and conventions

### Server Actions over API Routes
The codebase uses Next.js Server Actions (`"use server"`) as the primary data layer, not API routes. Only use API routes for webhooks and external-facing endpoints. All dashboard data fetching and mutations should use Server Actions.

### Supabase client usage
- `createAdminClient()` — server-side, bypasses RLS (for system operations like cron syncs)
- `createServerClient()` — server-side, respects RLS (for user-scoped operations)
- `createBrowserClient()` — client-side only (for real-time subscriptions, client auth)
- Always use `createServerClient()` for user-facing Server Actions once auth is implemented

### WordPress plugin communication
- **Dashboard → WordPress**: POST to `{wp_site_url}/wp-json/workforce/v1/execute` with `X-Workforce-Key` header
- **WordPress → Dashboard**: POST to `{dashboard_url}/api/wordpress/*` with Bearer token
- All payloads go through the unified `/execute` endpoint with action: `update_post | update_meta | update_schema | batch`

### SEO gap detection flow
1. WordPress plugin extracts page data (`class-seo-analyzer.php`)
2. Data sent to dashboard via API
3. `detectSEOGaps()` server action identifies missing/suboptimal elements
4. `generateSEOGapFixes()` uses AI to generate optimized content (CURRENTLY STUBBED)
5. `applySEOGapFixes()` sends fixes back to WordPress via `/execute`
6. WordPress plugin applies changes with sanitization and audit logging

### DataForSEO opportunity scoring
- Fetches up to 1000 ranked keywords for a domain
- Filters for positions 11-20 (page 2 — high potential to move to page 1)
- Calculates traffic gain using CTR curve data
- Scores opportunities: `(search_volume × traffic_gain × ease_factor) / 1000`
- ease_factor: 1.0 for position 11, decreasing to 0.5 for position 20

### Database naming
- Tables use snake_case: `opportunity_actions`, `content_versions`
- TypeScript types use PascalCase: `OpportunityAction`, `ContentVersion`
- Supabase enums match the TypeScript types in `types/database.ts`

## Environment variables

Required env vars (see `.env.example` for full list):
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase project
- `SUPABASE_SERVICE_ROLE_KEY` — server-side Supabase admin access
- `DATABASE_URL` — Supabase pooled Postgres connection
- `OPENAI_API_KEY` — for GPT-4o-mini content generation
- `ANTHROPIC_API_KEY` — for Claude content generation (primary)
- `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD` — SEO data API
- `NEXT_PUBLIC_APP_URL` — app URL (http://localhost:3000 in dev)

## Commands

```bash
pnpm install          # Install all dependencies
pnpm dev              # Start all apps in dev mode (Turborepo)
pnpm dev:web          # Start only the web app
pnpm build            # Build all packages
pnpm build:web        # Build only the web app
pnpm lint             # Lint all packages
pnpm type-check       # TypeScript type checking
```

## Code style

- TypeScript strict mode
- Functional components with hooks (no class components)
- Server Components by default, `"use client"` only when needed (interactivity, hooks)
- Tailwind CSS for styling — no CSS modules or styled-components
- Use `@/` path alias for imports within the web app
- Error handling: use `ApiError` class for API routes, try/catch with `logger` for server actions
- Always sanitize WordPress plugin inputs (wp_kses_post for content, sanitize_text_field for strings)

## Build phases (for planning)

### Phase 1: AI agents + real content generation
Wire up `packages/ai-agents` with Claude API. Replace all stub `generate*` functions in `seo-gaps.ts` with real AI calls. Build a proper prompt engineering layer. Add GEO-specific content optimization (FAQ generation, structured answers, citation-friendly formatting).

### Phase 2: Authentication + dashboard UI
Implement Supabase Auth (email/password + Google OAuth). Build the dashboard: site overview, opportunities table with filters/sorting, SEO audit page pulling real WP data, settings page. Use shadcn/ui component library for consistency.

### Phase 3: Onboarding + WP connection flow
Build the site connection wizard: enter WP URL → install plugin instructions → verify API connection → first scan. Implement real-time sync between WP plugin and dashboard.

### Phase 4: GEO optimization
Build the GEO analysis engine: detect content structure gaps for AI citations, generate FAQ sections, optimize for featured snippets, add People Also Ask targeting. Create a GEO score alongside the SEO score.

### Phase 5: Billing + multi-tenancy
Stripe integration with tiered plans (Free/Pro/Agency). Usage metering (pages scanned, AI fixes generated). Team/agency features (multiple sites, client access).

### Phase 6: Shopify integration
Extend the platform to support Shopify stores. Build a Shopify app equivalent of the WP plugin. Add product schema, collection page optimization, Shopify-specific SEO rules.
