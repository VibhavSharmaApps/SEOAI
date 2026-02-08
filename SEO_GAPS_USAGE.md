# SEO Gap Detection & Auto-Fixing

Automatically detect SEO gaps (missing H1, meta tags, etc.) and use AI to generate and apply fixes directly to WordPress.

## Architecture Flow

```
WordPress Page (has gaps)
        ↓
   [Analyze SEO Gaps]
        ↓
   [AI Generates Fixes] (GPT-4o-mini)
        ↓
   [POST /wp-json/workforce/v1/execute]
        ↓
   WordPress (updated instantly!)
```

## 1. Detect SEO Gaps

```typescript
import { detectSEOGaps } from "@/app/actions/seo-gaps";

const pageData = {
  title: "Best Coffee Beans for Cold Brew",
  content: "<p>Content here...</p>",
  meta_title: "",  // MISSING!
  meta_description: "",  // MISSING!
  h1: "",  // MISSING!
  focus_keyword: "",  // MISSING!
};

const gaps = detectSEOGaps(pageData);
// Returns:
// [
//   { type: "missing_h1", severity: "critical", message: "..." },
//   { type: "missing_meta_title", severity: "critical", message: "..." },
//   { type: "missing_meta_description", severity: "critical", message: "..." },
//   { type: "missing_focus_keyword", severity: "high", message: "..." }
// ]
```

## 2. Generate AI Fixes

```typescript
import { generateSEOGapFixes } from "@/app/actions/seo-gaps";
import type { PageSEOAnalysis } from "@/types/seo-gaps";

const analysis: PageSEOAnalysis = {
  wp_post_id: 123,
  url: "https://example.com/best-coffee-beans",
  title: "Best Coffee Beans for Cold Brew",
  post_type: "post",
  content_preview: "If you're looking for the perfect cold brew...",
  gaps: gaps,  // From step 1
};

const fixes = await generateSEOGapFixes(analysis);
// Returns:
// [
//   {
//     gap_type: "missing_h1",
//     generated_content: "Best Coffee Beans for Cold Brew: Top 10 Picks",
//     reasoning: "Generated AEO-optimized H1..."
//   },
//   {
//     gap_type: "missing_meta_title",
//     generated_content: "Best Coffee Beans for Cold Brew | 2026 Guide",
//     reasoning: "Generated meta title (52 chars...)"
//   },
//   {
//     gap_type: "missing_meta_description",
//     generated_content: "Discover the best coffee beans for cold brew...",
//     reasoning: "Generated meta description (155 chars...)"
//   },
//   {
//     gap_type: "missing_focus_keyword",
//     generated_content: "cold brew coffee beans",
//     reasoning: "Generated focus keyword..."
//   }
// ]
```

## 3. Apply Fixes to WordPress

```typescript
import { applySEOGapFixes } from "@/app/actions/seo-gaps";

const result = await applySEOGapFixes(
  123,  // WordPress post ID
  fixes,  // Generated fixes from step 2
  "https://example.com",  // WordPress site URL
  "your_api_key"  // WordPress plugin API key
);

// Returns:
// {
//   wp_post_id: 123,
//   fixes: [...],
//   applied: true,
//   error: undefined
// }
```

## Complete Flow (One Function!)

```typescript
import { fixSEOGaps } from "@/app/actions/seo-gaps";

// Analyze → Generate → Apply (all in one)
const result = await fixSEOGaps(
  analysis,  // PageSEOAnalysis with detected gaps
  "https://example.com",
  "your_api_key"
);

console.log(`Fixed ${result.fixes.length} SEO gaps for post ${result.wp_post_id}`);
```

## WordPress Plugin Side

The plugin handles these updates safely:

### H1 Injection

```php
// If H1 exists → Replace it
// If H1 missing → Prepend to content

POST /wp-json/workforce/v1/execute
{
  "action": "update_post",
  "post_id": 123,
  "payload": {
    "prepend_h1": "Best Coffee Beans for Cold Brew: Top 10 Picks"
  }
}
```

**PHP Implementation**:
- Checks if H1 exists in content using regex
- If exists: Replaces with new H1
- If missing: Prepends `<h1>...</h1>` to content
- Sanitizes with `esc_html()` to prevent XSS

### Meta Updates

```php
POST /wp-json/workforce/v1/execute
{
  "action": "update_meta",
  "post_id": 123,
  "payload": {
    "meta_title": "Best Coffee Beans for Cold Brew | 2026 Guide",
    "meta_description": "Discover the best coffee beans...",
    "focus_keyword": "cold brew coffee beans"
  }
}
```

**PHP Safety Features**:
- `sanitize_text_field()` on all inputs
- Length validation (meta title: max 70 chars, meta description: max 170)
- Auto-truncation with ellipsis if too long
- Updates Yoast SEO, Rank Math, and AIOSEO meta fields
- Audit trail logging (`_workforce_seo_log` post meta)

### Batch Operations

Fix multiple gaps in one request:

```php
POST /wp-json/workforce/v1/execute
{
  "action": "batch",
  "payload": {
    "operations": [
      {
        "action": "update_post",
        "post_id": 123,
        "payload": { "prepend_h1": "..." }
      },
      {
        "action": "update_meta",
        "post_id": 123,
        "payload": {
          "meta_title": "...",
          "meta_description": "...",
          "focus_keyword": "..."
        }
      }
    ]
  }
}
```

## Security Features

### Input Sanitization
- `sanitize_text_field()` — Single-line text (titles, keywords)
- `sanitize_textarea_field()` — Multi-line text (descriptions)
- `wp_kses_post()` — HTML content (allows safe tags only)
- `esc_html()` — HTML output escaping
- `absint()` — Integer sanitization

### API Key Verification
- `hash_equals()` — Constant-time comparison (prevents timing attacks)
- Header: `X-Workforce-Key`

### Length Validation
- Meta title: Auto-truncate at 70 chars (optimal: 50-60)
- Meta description: Auto-truncate at 170 chars (optimal: 150-160)
- Focus keyword: Max 100 chars

### Custom Meta Security
- Only allows `workforce_` prefixed custom fields
- Prevents overwriting arbitrary post meta

### Audit Trail
- Every update logged to `_workforce_seo_log` post meta
- Tracks: operation, fields changed, timestamp, source
- Keeps last 100 entries

## Example: Complete Integration

```typescript
// app/api/wordpress/fix-gaps/route.ts
import { fixSEOGaps, detectSEOGaps } from "@/app/actions/seo-gaps";
import { createAdminClient } from "@/lib/supabase";

export async function POST(request: Request) {
  const { projectId } = await request.json();

  // Get project details
  const supabase = createAdminClient();
  const { data: project } = await supabase
    .from("projects")
    .select("wp_url, site:sites(api_key)")
    .eq("id", projectId)
    .single();

  // Get WordPress pages with gaps
  const pages = await fetchPagesFromWordPress(project.wp_url);

  // Fix all pages with gaps
  const results = [];
  for (const page of pages) {
    const gaps = detectSEOGaps(page);
    
    if (gaps.length > 0) {
      const result = await fixSEOGaps(
        { ...page, gaps },
        project.wp_url,
        project.site.api_key
      );
      results.push(result);
    }
  }

  return Response.json({
    success: true,
    fixed: results.filter(r => r.applied).length,
    failed: results.filter(r => !r.applied).length,
    results,
  });
}
```

## Supported Gap Types

| Gap Type | Severity | AI Generates |
|----------|----------|--------------|
| `missing_h1` | Critical | 40-70 char AEO-optimized H1 |
| `missing_meta_title` | Critical | 50-60 char meta title with keyword |
| `missing_meta_description` | Critical | 150-160 char compelling meta description |
| `short_meta_title` | High | Expanded meta title (optimal length) |
| `short_meta_description` | High | Expanded meta description |
| `long_meta_title` | Medium | Condensed meta title |
| `long_meta_description` | Medium | Condensed meta description |
| `missing_focus_keyword` | High | Primary keyword from content analysis |

## Response Format

### Success Response
```json
{
  "success": true,
  "post_id": 123,
  "updated": ["meta_title", "meta_description", "focus_keyword", "h1_prepended"],
  "timestamp": "2026-02-07 12:00:00"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Post not found",
  "status": 404
}
```

### Batch Response
```json
{
  "success": true,
  "total": 2,
  "succeeded": 2,
  "failed": 0,
  "results": [
    { "index": 0, "success": true, "post_id": 123, "data": {...} },
    { "index": 1, "success": true, "post_id": 123, "data": {...} }
  ]
}
```

## Testing

### Test SEO Gap Detection
```typescript
const gaps = detectSEOGaps({
  title: "Test Page",
  content: "<p>Content without H1</p>",
  meta_title: "Short",  // Too short!
  meta_description: "",  // Missing!
});

console.log(gaps);
// Outputs all detected issues
```

### Test in WordPress
```bash
curl -X POST https://yoursite.com/wp-json/workforce/v1/execute \
  -H "X-Workforce-Key: test_key_123" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "update_meta",
    "post_id": 123,
    "payload": {
      "meta_title": "AI-Generated Title | Guide",
      "meta_description": "This is an AI-generated description that is exactly 155 characters long and includes the target keyword naturally for optimal SEO.",
      "focus_keyword": "target keyword"
    }
  }'
```

## Next Steps

1. **Apply the migration**: Run `00002_opportunities_system.sql` (if not done)
2. **Set DataForSEO credentials** in `.env`
3. **Configure WordPress plugin** with API URL and key
4. **Test the flow**:
   ```typescript
   const result = await fixSEOGaps(pageAnalysis, wpUrl, apiKey);
   ```
