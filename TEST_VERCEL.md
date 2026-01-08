# Testing on Vercel

## Quick Start

1. **Open your Vercel app** (e.g., `https://your-app.vercel.app`)
2. **Log in** to your account
3. **Open Developer Console** (F12 or Right-click → Inspect → Console)
4. **Copy and paste** the entire `test-content-api.js` file into the console
5. **Press Enter** to load the functions
6. **Run:** `runAllTests()`

## Step-by-Step

### 1. Get Your Page IDs

First, let's see what pages you have:

```javascript
// In browser console, run:
fetch('/api/pages/list', { credentials: 'include' })
  .then(r => r.json())
  .then(data => {
    console.log('Pages:', data.pages);
    console.log('Summary:', data.summary);
  });
```

This will show you all your pages with their IDs.

### 2. Run All Tests

```javascript
runAllTests()
```

This will automatically:
- ✅ Test version incrementing (generate twice)
- ✅ Test all page types (PRODUCT, COLLECTION, ARTICLE)
- ✅ Test that product vs article content differs
- ✅ Test missing keyword error handling
- ✅ Test that content doesn't overwrite (multiple versions)

### 3. Individual Tests

If you want to test one thing at a time:

```javascript
// Get pages first
const pages = await getPages();

// Test 1: Versions increment
await testVersions(pages.PRODUCT[0].id, 'PRODUCT');

// Test 2: Different page types
await testPageTypes(pages);

// Test 3: Content differs
await testContentDiffers(pages);

// Test 4: Missing keyword
await testMissingKeyword(pages);

// Test 5: No overwrite
await testNoOverwrite(pages.PRODUCT[0].id, 'PRODUCT');
```

## Manual Testing with curl

If you prefer curl, you'll need your session cookie:

1. **Get your session cookie:**
   - Open DevTools → Application/Storage → Cookies
   - Find `__session` cookie
   - Copy its value

2. **Get a page ID:**
```bash
curl https://your-app.vercel.app/api/pages/list \
  -H "Cookie: __session=YOUR_SESSION_COOKIE"
```

3. **Test content generation:**
```bash
curl -X POST https://your-app.vercel.app/api/content/generate \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=YOUR_SESSION_COOKIE" \
  -d '{
    "page_id": "YOUR_PAGE_ID",
    "primary_keyword": "coffee beans",
    "page_type": "PRODUCT"
  }'
```

## Expected Results

### ✅ Test 1: Versions Increment
- First call: `version: 1`
- Second call: `version: 2`
- Both versions exist in database

### ✅ Test 2: All Page Types Work
- PRODUCT: Returns success
- COLLECTION: Returns success  
- ARTICLE: Returns success

### ✅ Test 3: Content Differs
- PRODUCT content: ~300-500 words, product-focused
- ARTICLE content: ~800-1200 words, article-style

### ✅ Test 4: Missing Keyword
- Returns `400 Bad Request`
- Error message: "Missing required fields: page_id, primary_keyword, page_type"

### ✅ Test 5: No Overwrite
- Generate 3 times → 3 versions in database
- All versions have different content
- Versions: 1, 2, 3

## Troubleshooting

### "Unauthorized" error
- Make sure you're logged in
- Check that cookies are enabled
- Try refreshing the page and logging in again

### "No pages found"
- Run `/api/store/baseline` first to sync pages from Shopify
- Check that your Shopify store is connected

### "Page not found"
- Verify the page_id exists in your database
- Make sure the page belongs to your site

### API calls fail
- Check browser console for CORS errors
- Verify your Vercel URL is correct
- Make sure environment variables are set in Vercel

## View Results in Database

To verify versions are stored correctly, you can query your database:

```sql
SELECT 
  cv.id,
  cv.version,
  cv.reason,
  LEFT(cv.content, 100) as content_preview,
  cv."createdAt",
  p.title as page_title,
  p.type as page_type
FROM content_versions cv
JOIN pages p ON cv."pageId" = p.id
ORDER BY cv."pageId", cv.version;
```

Or use Prisma Studio:
```bash
npm run db:studio
```

Then browse to `content_versions` table.

