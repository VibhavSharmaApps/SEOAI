# API Endpoint: /api/store/baseline

## Overview

The `/api/store/baseline` endpoint fetches baseline data from a connected Shopify store and stores it in the database. It's idempotent and safe to run multiple times.

## Endpoint

**POST** `/api/store/baseline`

## Authentication

- Requires Clerk authentication (user must be logged in)
- Uses the authenticated user's connected Shopify store

## What It Does

1. **Fetches from Shopify:**
   - All products (id, title, handle, updated_at)
   - All collections (id, title, handle)
   - All blog articles (id, title, handle, published_at)

2. **Stores in Database:**
   - Creates/updates records in the `pages` table
   - Uses upsert logic (idempotent - safe to re-run)

3. **Returns:**
   - JSON summary with counts per page type

## Database Schema

The endpoint stores data in the `pages` table:

```prisma
model Page {
  id          String   @id @default(cuid())
  siteId      String
  shopifyId   String   // Shopify resource ID
  type        PageType // PRODUCT, COLLECTION, or ARTICLE
  title       String
  url         String   // Full URL to the page
  lastUpdated DateTime
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  site Site @relation(fields: [siteId], references: [id], onDelete: Cascade)

  @@unique([siteId, shopifyId, type])
  @@index([siteId, type])
  @@map("pages")
}
```

## Request

**Method:** POST  
**Headers:** 
- Cookie with Clerk session (automatic)

**Body:** None required

## Response

### Success (200)

```json
{
  "success": true,
  "message": "Baseline data synced successfully",
  "synced": {
    "products": 150,
    "collections": 25,
    "articles": 45
  },
  "stored": {
    "PRODUCT": 150,
    "COLLECTION": 25,
    "ARTICLE": 45
  },
  "total": 220
}
```

### Error Responses

**401 Unauthorized:**
```json
{
  "error": "Unauthorized"
}
```

**400 Bad Request:**
```json
{
  "error": "No Shopify store connected"
}
```
or
```json
{
  "error": "Shopify access token not found"
}
```

**404 Not Found:**
```json
{
  "error": "User not found"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Failed to sync baseline data",
  "message": "Error details..."
}
```

## Idempotency

The endpoint is **idempotent** - safe to call multiple times:

- Uses `upsert` operations with unique constraint on `[siteId, shopifyId, type]`
- If a page already exists, it updates the title, URL, and lastUpdated
- If a page doesn't exist, it creates a new record
- No duplicate records are created

## URL Construction

Pages are stored with full URLs:

- **Products:** `https://{shop}/products/{handle}`
- **Collections:** `https://{shop}/collections/{handle}`
- **Articles:** `https://{shop}/blogs/{blog_handle}/{article_handle}`

## Shopify API Calls

The endpoint makes the following Shopify Admin API calls:

1. `GET /admin/api/2024-01/products.json` (paginated)
2. `GET /admin/api/2024-01/collections.json` (paginated)
3. `GET /admin/api/2024-01/blogs.json` (to get blog handles)
4. `GET /admin/api/2024-01/blogs/{blog_id}/articles.json` (paginated, for each blog)

All requests use:
- Shopify Admin API version: `2024-01`
- Authentication: `X-Shopify-Access-Token` header
- Pagination: Handles cursor-based pagination automatically

## Usage Example

```bash
# Using curl
curl -X POST https://your-app.com/api/store/baseline \
  -H "Cookie: __session=your-clerk-session"

# Using fetch in JavaScript
const response = await fetch('/api/store/baseline', {
  method: 'POST',
  credentials: 'include',
})

const data = await response.json()
console.log(data)
```

## Migration Required

After adding the `Page` model to the schema, run:

```bash
npm run db:migrate
```

Name the migration: `add_pages_table`

## Performance Notes

- Fetches all data in parallel (Promise.all)
- Handles pagination automatically
- Processes up to 250 items per API call
- Large stores may take 30-60 seconds to sync

## Error Handling

- Validates user authentication
- Checks for connected Shopify store
- Verifies access token exists
- Handles Shopify API errors gracefully
- Returns detailed error messages


