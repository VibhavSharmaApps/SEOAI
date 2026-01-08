# API Endpoint: /api/keywords/seed

## Overview

The `/api/keywords/seed` endpoint generates SEO keywords for all product and collection pages using an LLM, then stores them in the database.

## Endpoint

**POST** `/api/keywords/seed`

## Authentication

- Requires Clerk authentication (user must be logged in)
- Uses the authenticated user's connected Shopify store

## What It Does

1. **Fetches Pages:**
   - Gets all PRODUCT and COLLECTION pages from the database
   - Skips ARTICLE pages

2. **Fetches Product Descriptions:**
   - For products, fetches the product description from Shopify API
   - Collections don't have descriptions (only title is used)

3. **Generates Keywords:**
   - Uses OpenAI GPT-4o-mini to generate 3-5 keyword phrases per page
   - Uses page title + description (if available) as input
   - Generates relevant, searchable keyword phrases

4. **Stores Keywords:**
   - Stores in `keywords` table with:
     - `keyword`: The keyword phrase
     - `source`: Format `product:123` or `collection:456`
     - `siteId`: Links to the site
   - Idempotent: Skips if keyword already exists (unique constraint)

5. **Returns:**
   - Number of pages processed
   - Number of keywords created

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
  "message": "Keywords seeded successfully",
  "pagesProcessed": 25,
  "keywordsCreated": 87
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

**500 Internal Server Error:**
```json
{
  "error": "Failed to seed keywords",
  "message": "Error details..."
}
```

## Environment Variables Required

Add to your `.env` file:

```env
OPENAI_API_KEY=sk-...
```

Get your API key from: [OpenAI Platform](https://platform.openai.com/api-keys)

**Also add to Vercel** if deployed:
- Vercel Dashboard → Settings → Environment Variables
- Add `OPENAI_API_KEY`

## Database Migration Required

After adding the `source` field to the Keyword model, run:

```bash
npm run db:migrate
```

Name the migration: `add_source_to_keywords`

## Usage Example

```bash
# Using curl
curl -X POST https://your-app.com/api/keywords/seed \
  -H "Cookie: __session=your-clerk-session"

# Using fetch in JavaScript
const response = await fetch('/api/keywords/seed', {
  method: 'POST',
  credentials: 'include',
})

const data = await response.json()
console.log(data)
```

## How Keywords Are Generated

1. **Input to LLM:**
   - Page title (required)
   - Product description (if product, fetched from Shopify)

2. **LLM Prompt:**
   - Asks for 3-5 SEO keyword phrases
   - Focuses on product/collection name variations
   - Includes use cases, benefits, target audience terms
   - Returns only keywords, one per line

3. **Output:**
   - Parses keywords from LLM response
   - Cleans and validates
   - Stores in database with source tracking

## Source Format

Keywords are stored with a `source` field indicating where they came from:
- Products: `product:123` (where 123 is the Shopify product ID)
- Collections: `collection:456` (where 456 is the Shopify collection ID)

## Rate Limiting

- Processes pages sequentially with 100ms delay between pages
- Handles errors gracefully (continues with next page if one fails)
- Respects OpenAI API rate limits

## Performance Notes

- Processes all pages in sequence (may take time for large stores)
- Each page requires:
  - 1 Shopify API call (for products with descriptions)
  - 1 OpenAI API call (for keyword generation)
- Large stores (100+ pages) may take 5-10 minutes

## Error Handling

- If OpenAI API fails, falls back to simple keyword extraction from title
- If product description fetch fails, continues with title only
- If keyword already exists, skips (idempotent)
- Logs errors but continues processing remaining pages


