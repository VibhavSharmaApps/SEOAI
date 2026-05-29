# PROJECT INPUTS — Workforce SEO

## Product context

Workforce SEO is a SaaS tool for small business owners who don't know SEO. It connects to their WordPress site, finds what's broken or missing (SEO gaps), generates AI-powered fixes, and applies them automatically. It also optimizes content to be cited by AI search engines like ChatGPT and Perplexity (GEO — Generative Engine Optimization).

**Target user**: SMB owner or marketing manager with no technical SEO knowledge. They want to "set it and forget it."

**Business model**: SaaS with tiered pricing. Free tier (1 site, basic scans), Pro ($49/mo — AI fixes, opportunities, GEO), Agency ($149/mo — multiple sites, white-label).

**Platform**: WordPress-first (MVP). Shopify planned for v2.

## Key terminology

- **SEO gap**: A missing or suboptimal on-page SEO element (no H1, short meta description, missing schema, etc.)
- **GEO**: Generative Engine Optimization — optimizing content to be cited by AI chatbots (ChatGPT, Perplexity, Google AI Overviews)
- **Opportunity**: A keyword ranking positions 11-20 (page 2 of Google) that could potentially move to page 1 with optimization
- **Opportunity score**: Weighted metric combining search volume, traffic gain potential, and ranking ease (easier to move from #11 than #20)
- **Change intent**: A planned SEO modification stored in the database before being applied to WordPress
- **Schema / JSON-LD**: Structured data markup that helps search engines understand page content (Article, FAQPage, etc.)
- **FAQ schema**: FAQPage JSON-LD that can trigger rich results in Google and improve chances of AI citation
- **CTR curve**: Click-through rate by SERP position (position 1 = ~40%, position 10 = ~2%, position 20 = ~0.4%)

## Architecture decisions already made

1. **Turborepo monorepo** with pnpm workspaces — apps/web, apps/wp-plugin, packages/*
2. **Next.js 14 App Router** with Server Components and Server Actions (not Pages Router)
3. **Supabase** for database, auth, and real-time — not Prisma or raw SQL
4. **DataForSEO** for keyword ranking data — not Ahrefs API or SEMrush API
5. **WordPress plugin** communicates via custom REST endpoint `/wp-json/workforce/v1/execute`
6. **Unified /execute endpoint** handles all WP mutations (post updates, meta, schema, batch) with a single API key auth
7. **Claude as primary AI**, GPT-4o-mini as secondary/fallback for cost-sensitive operations
8. **Tailwind CSS** for styling, no CSS-in-JS
9. **Vercel** for deployment

## Current database schema summary

### Core tables (migration 00001)
- `users` — authenticated users (linked to Supabase Auth via auth_id)
- `sites` — WordPress sites (domain, wp_site_url, api_key, Google OAuth tokens)
- `keywords` — tracked SEO keywords per site
- `gsc_keyword_daily` — Google Search Console daily keyword data
- `gsc_properties` — connected GSC properties
- `content` — blog posts/pages managed by platform
- `prompts` — AI prompt templates with versioning
- `autopilot_runs` — scheduled automation job logs
- `pages` — synced WordPress posts/pages
- `content_versions` — generated content with version history
- `performance_snapshots` — per-page GSC performance data
- `change_intents` — planned SEO modifications (PENDING → APPLIED → ROLLED_BACK)

### Opportunities tables (migration 00002)
- `projects` — WordPress sites with DataForSEO config
- `opportunities` — keywords ranking #11-20 with traffic potential scores
- `opportunity_actions` — actions taken on opportunities (content_update, meta_optimization, etc.)
- `opportunity_position_history` — ranking changes over time

All tables have RLS policies, updated_at triggers, and proper foreign key cascades.

## WordPress plugin capabilities

The WP plugin (`apps/wp-plugin`) exposes these capabilities:

**REST endpoints** (authenticated via X-Workforce-Key header):
- `POST /wp-json/workforce/v1/execute` — unified action endpoint
  - `action: "update_post"` — update title, content, excerpt, status, prepend/replace H1
  - `action: "update_meta"` — update meta title, description, focus keyword, OG tags
  - `action: "update_schema"` — inject JSON-LD schema into post meta
  - `action: "batch"` — execute multiple operations in one request
- `GET /wp-json/workforce/v1/status` — health check

**Data extraction** (class-seo-analyzer.php):
- Extract page data: wp_post_id, title, URL, content, headings, word count
- Get meta title/description from Yoast, Rank Math, or AIOSEO
- Extract H1 from content HTML
- Extract FAQ candidates (H2/H3 ending with "?" followed by a paragraph)
- Bulk scan all pages (up to 500)

**Schema output**:
- Stores JSON-LD in `_workforce_schema` post meta
- Outputs to `<head>` via `wp_head` hook on singular posts/pages
- Validates JSON before output

## AI agent requirements (to be built)

The `packages/ai-agents` package needs to:

1. **Content generation**: Generate SEO-optimized H1s, meta titles (50-60 chars), meta descriptions (150-160 chars), focus keywords based on page content analysis
2. **GEO optimization**: Generate FAQ sections from page content, structure answers for AI citation, create "People Also Ask" style Q&A blocks
3. **Schema generation**: Use the existing schema-factory but with AI-driven inputs (better descriptions, keyword-enriched fields)
4. **Internal linking**: Analyze site content and suggest relevant internal links between pages
5. **Content rewriting**: Rewrite thin content to be more comprehensive and authoritative
6. **Prompt management**: Use versioned prompts from the `prompts` table, A/B test different prompt strategies

The agents should work with both Claude (Anthropic) and GPT-4o-mini (OpenAI) APIs, with a provider abstraction layer.

## Design preferences

- Clean, modern SaaS dashboard aesthetic
- Use shadcn/ui component library (built on Radix UI + Tailwind)
- Dark mode support
- Mobile-responsive (many SMB owners check on mobile)
- Minimal cognitive load — the user shouldn't need to understand SEO terminology
- Use color-coded severity for SEO gaps: red = critical, orange = high, yellow = medium
- Progress indicators and scores (SEO health score, GEO readiness score)

## Important constraints

- The user is a beginner developer — code should be well-commented and changes should be explained
- Always run `pnpm type-check` after making TypeScript changes
- The WordPress plugin is PHP 8.0+ — use typed properties, match expressions, named arguments
- Never commit `.env.local` or any file with real API keys
- Supabase migrations should be numbered sequentially (00003_*, 00004_*, etc.)
- The WP plugin must remain compatible with WordPress 6.0+ and PHP 8.0+
- All AI-generated content must pass through the existing sanitization in the WP plugin (wp_kses_post, sanitize_text_field)
