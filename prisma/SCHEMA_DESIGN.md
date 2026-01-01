# Prisma Schema Design - MVP

## Overview

This schema is designed for an MVP SEO automation platform focused on Shopify stores. The design prioritizes simplicity and immediate needs over future-proofing.

## Table Explanations

### 1. User
**Purpose:** Links Clerk authentication to application data

**Why it exists:**
- Clerk handles authentication, but we need our own user records to:
  - Store application-specific user data
  - Link users to their sites and content
  - Track user activity and preferences
- `clerkId` provides the bridge between Clerk's auth system and our database

**Key Fields:**
- `clerkId`: Unique identifier from Clerk (used for auth lookups)
- `email`: User's email for display and communication
- `sites`: One-to-many relationship - users can own multiple Shopify stores

---

### 2. Site
**Purpose:** Represents a Shopify store connected to the platform

**Why it exists:**
- Central organizing entity for all SEO work
- Each Shopify store is a separate "site" with its own:
  - Keywords to track
  - Blog posts to manage
  - AI prompts to use
  - Automated job runs
- Stores Shopify API credentials securely
- Allows users to manage multiple stores from one account

**Key Fields:**
- `domain`: Store's primary domain
- `shopifyStoreUrl`: Full Shopify store URL
- `shopifyAccessToken`: Encrypted token for Shopify API access
- `isActive`: Allows disabling sites without deleting data

**Relationships:**
- Belongs to one User
- Has many Keywords, Content, Prompts, and AutopilotRuns

---

### 3. Keyword
**Purpose:** Tracks SEO keywords targeted for each site

**Why it exists:**
- Core SEO entity - the foundation of SEO work
- Tracks which keywords we're trying to rank for
- Monitors current ranking positions
- Links keywords to target URLs (which page should rank)
- Allows tracking progress over time

**Key Fields:**
- `keyword`: The actual search term (e.g., "organic coffee beans")
- `targetUrl`: Which page/blog post should rank for this keyword
- `currentRanking`: Current Google ranking (1-100, null if not ranked)
- `notes`: For research, competition analysis, etc.

**Design Decisions:**
- Unique constraint on `[siteId, keyword]` prevents duplicates per site
- `currentRanking` is nullable because new keywords may not rank yet

---

### 4. Content
**Purpose:** Tracks Shopify blog posts created/updated by the platform

**Why it exists:**
- Tracks blog posts we create for SEO purposes
- Syncs with Shopify's API using `shopifyArticleId`
- Manages content lifecycle (draft → scheduled → published)
- Links content to the site that owns it

**Key Fields:**
- `shopifyArticleId`: ID from Shopify's API (for syncing)
- `title`: Blog post title
- `url`: Full URL to the published post
- `status`: Draft, Published, or Scheduled
- `publishedAt`: When it was/will be published

**Design Decisions:**
- `shopifyArticleId` is unique to prevent duplicate imports
- Status enum ensures data integrity
- URL is nullable because drafts may not have URLs yet

---

### 5. Prompt
**Purpose:** Tracks AI prompts used for content generation

**Why it exists:**
- Audit trail: See what prompts were used and when
- Optimization: Track which prompts produce better results
- Versioning: Allows A/B testing and iterative improvement
- Site-specific: Different sites may need different prompt styles

**Key Fields:**
- `name`: Human-readable name (e.g., "Blog Intro Generator")
- `promptText`: The actual prompt template
- `version`: For tracking iterations (start at 1)
- `isActive`: Allows disabling old prompts without deleting

**Design Decisions:**
- Unique constraint on `[siteId, name, version]` allows multiple versions
- Versioning enables A/B testing and gradual rollouts
- `isActive` flag allows soft-deleting prompts

---

### 6. AutopilotRun
**Purpose:** Logs weekly automated job executions

**Why it exists:**
- Tracks when autopilot jobs run (weekly schedule)
- Monitors job status (pending, running, completed, failed)
- Stores error messages for debugging
- Flexible result storage in JSON format
- Provides audit trail for automated operations

**Key Fields:**
- `scheduledFor`: When the job was scheduled to run
- `startedAt`: Actual start time (may differ from scheduled)
- `completedAt`: When it finished (null if still running/failed)
- `status`: Current state (enum for data integrity)
- `errorMessage`: If failed, what went wrong
- `resultSummary`: JSON object for flexible result storage

**Design Decisions:**
- Index on `[siteId, scheduledFor]` for efficient querying
- Status enum ensures only valid states
- JSON field (Prisma `Json` type) for results allows flexibility without schema changes
- Separate timestamps for scheduled vs actual times

---

## Design Principles Applied

### 1. Minimal Schema
- Only essential fields for MVP
- No premature optimization
- Can add fields later as needs emerge

### 2. No Premature Generalization
- `SiteType` enum only has `SHOPIFY` (can add more later)
- No abstract "Platform" table - Shopify-specific for now
- Content is specifically blog posts, not generic "content types"

### 3. Enums Where Appropriate
- `SiteType`: Currently only SHOPIFY, but enum allows easy expansion
- `ContentStatus`: Ensures data integrity (only valid states)
- `AutopilotRunStatus`: Prevents invalid status values

### 4. Cascade Deletes
- When a Site is deleted, all related data (Keywords, Content, etc.) is deleted
- Prevents orphaned records
- User deletion cascades to Sites, which cascades to everything

### 5. Indexes for Performance
- `AutopilotRun` has index on `[siteId, scheduledFor]` for efficient queries
- Unique constraints also act as indexes

---

## Future Considerations (Not in MVP)

These were intentionally left out to keep the MVP minimal:

- **Content-Keyword relationships**: Can add many-to-many later if needed
- **Prompt usage tracking**: Can add a join table later to track which prompts created which content
- **AutopilotRun-Content relationships**: Can link runs to generated content later
- **User roles/permissions**: MVP assumes single owner per site
- **Site settings/config**: Can add JSON field or separate table later
- **Analytics/metrics**: Can add separate tables when needed

---

## Migration Notes

After updating this schema, run:

```bash
npm run db:migrate
```

This will create the new tables and relationships in your Supabase database.

