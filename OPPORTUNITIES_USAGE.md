# Opportunities System — Usage Guide

The Opportunities System finds keywords ranking in positions 11-20 (page 2) and calculates the traffic potential if they moved to position 1.

## Architecture

### 1. Database Schema (`packages/supabase/migrations/00002_opportunities_system.sql`)

**Tables**:
- `projects` — WordPress sites with DataForSEO credentials
- `opportunities` — Keywords ranking #11-20 with traffic gain calculations
- `opportunity_actions` — Track actions taken on opportunities
- `opportunity_position_history` — Historical position tracking

### 2. DataForSEO Service (`apps/web/lib/dataforseo.ts`)

**Functions**:
- `fetchRankedKeywords()` — Fetch all ranked keywords from DataForSEO
- `extractOpportunities()` — Filter for positions 11-20 and calculate traffic gain
- `findOpportunities()` — Complete flow: fetch + extract
- `calculateTraffic()` — Estimate monthly traffic using CTR curves
- `calculateOpportunityScore()` — Score opportunities by value and ease

### 3. Server Actions (`apps/web/app/actions/`)

**`opportunities.ts`**:
- `syncProjectOpportunities()` — Fetch from DataForSEO and sync to database
- `getProjectOpportunities()` — Query opportunities with filters
- `updateOpportunityStatus()` — Mark as in_progress, completed, dismissed
- `recordOpportunityAction()` — Log actions taken
- `getProjectOpportunityStats()` — Get summary statistics

**`projects.ts`**:
- `createProject()` — Create a new project linked to a WordPress site
- `getSiteProjects()` — Get all projects for a site
- `updateProject()` / `deleteProject()` — Manage projects

## Setup

### 1. Apply Database Migration

Run in Supabase SQL Editor:

\`\`\`sql
-- Copy and paste the contents of:
-- packages/supabase/migrations/00002_opportunities_system.sql
\`\`\`

### 2. Configure DataForSEO Credentials

Add to `.env`:

\`\`\`env
# DataForSEO API Credentials
DATAFORSEO_LOGIN=your_login@example.com
DATAFORSEO_PASSWORD=your_password
\`\`\`

Get credentials from: https://app.dataforseo.com/api-dashboard

### 3. Create a Project

\`\`\`typescript
import { createProject } from "@/app/actions/projects";

const project = await createProject({
  siteId: "site_abc123",
  name: "My WordPress Site",
  wpUrl: "https://example.com",
  dataforseoDomain: "example.com",
  locationCode: 2840, // US
  languageCode: "en",
});
\`\`\`

### 4. Sync Opportunities

\`\`\`typescript
import { syncProjectOpportunities } from "@/app/actions/opportunities";

const result = await syncProjectOpportunities(project.id);
console.log(\`Synced \${result.opportunitiesCount} opportunities\`);
\`\`\`

## Usage Examples

### Get Top Opportunities

\`\`\`typescript
import { getProjectOpportunities } from "@/app/actions/opportunities";

// Get all high-priority opportunities
const opportunities = await getProjectOpportunities(projectId, {
  priority: "high",
  status: "pending",
  minScore: 50,
  limit: 20,
});

opportunities.forEach((opp) => {
  console.log(\`
    Keyword: \${opp.keyword}
    Position: \${opp.current_position}
    Traffic Gain: \${opp.traffic_gain}/month
    Score: \${opp.opportunity_score}
  \`);
});
\`\`\`

### Update Opportunity Status

\`\`\`typescript
import { updateOpportunityStatus } from "@/app/actions/opportunities";

// Mark as in progress
await updateOpportunityStatus(
  opportunityId,
  "in_progress",
  "Working on content optimization"
);

// Mark as completed
await updateOpportunityStatus(
  opportunityId,
  "completed",
  "Content updated, internal links added"
);
\`\`\`

### Record Actions

\`\`\`typescript
import { recordOpportunityAction } from "@/app/actions/opportunities";

// Log a content update
await recordOpportunityAction(
  opportunityId,
  "content_update",
  "Added 500 words of AEO-optimized content targeting 'best coffee beans'",
  "user_123",
  {
    wordCount: 500,
    targetKeyword: "best coffee beans",
    aeoSnippets: 3,
  }
);
\`\`\`

### Get Statistics

\`\`\`typescript
import { getProjectOpportunityStats } from "@/app/actions/opportunities";

const stats = await getProjectOpportunityStats(projectId);
console.log(\`
  Total Opportunities: \${stats.total}
  Pending: \${stats.byStatus.pending}
  In Progress: \${stats.byStatus.in_progress}
  Completed: \${stats.byStatus.completed}
  
  Critical Priority: \${stats.byPriority.critical}
  High Priority: \${stats.byPriority.high}
  
  Total Traffic Gain Potential: \${stats.totalTrafficGain}/month
  Avg Opportunity Score: \${stats.avgOpportunityScore.toFixed(1)}
\`);
\`\`\`

## Opportunity Score Calculation

**Formula**:
\`\`\`
score = (search_volume * traffic_gain * ease_factor) / 1000

ease_factor:
- Position 11: 1.0 (easiest to rank)
- Position 15: 0.8
- Position 20: 0.5 (hardest to rank)
\`\`\`

**Priority Assignment**:
- **Critical**: Score >= 100 (high volume, high gain, easy to rank)
- **High**: Score >= 50
- **Medium**: Score >= 20
- **Low**: Score < 20

## Traffic Gain Calculation

Uses industry-standard CTR curves (2024 data):

| Position | CTR   | Example (1000 searches/mo) |
|----------|-------|----------------------------|
| 1        | 39.8% | 398 visits/mo             |
| 11       | 1.3%  | 13 visits/mo              |
| 15       | 0.8%  | 8 visits/mo               |
| 20       | 0.4%  | 4 visits/mo               |

**Traffic Gain** = (Traffic at Pos 1) - (Current Traffic)

For a keyword at position 15 with 1000 searches/month:
- Current traffic: 8 visits/mo
- Potential at position 1: 398 visits/mo
- **Traffic gain: 390 visits/mo** (4,875% increase!)

## Automation

Set up a cron job to sync opportunities daily:

\`\`\`typescript
// app/api/cron/sync-opportunities/route.ts
import { getSiteProjects } from "@/app/actions/projects";
import { syncProjectOpportunities } from "@/app/actions/opportunities";

export async function GET() {
  const projects = await getSiteProjects(siteId);
  
  for (const project of projects) {
    if (!project.is_active) continue;
    await syncProjectOpportunities(project.id);
  }
  
  return Response.json({ success: true });
}
\`\`\`

Deploy with Vercel Cron:
\`\`\`json
{
  "crons": [{
    "path": "/api/cron/sync-opportunities",
    "schedule": "0 2 * * *"
  }]
}
\`\`\`

## API Route

Call via HTTP for integrations:

\`\`\`bash
curl -X POST https://your-app.com/api/opportunities/sync \\
  -H "Content-Type: application/json" \\
  -d '{"projectId": "proj_abc123"}'
\`\`\`

Response:
\`\`\`json
{
  "success": true,
  "message": "Synced 47 opportunities",
  "opportunitiesCount": 47
}
\`\`\`
