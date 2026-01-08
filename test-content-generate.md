# Testing /api/content/generate Endpoint

This guide helps you test all the required cases for the content generation endpoint.

## Prerequisites

1. **You must be logged in** (Clerk authentication required)
2. **You must have synced baseline data** (run `/api/store/baseline` first)
3. **You need page IDs** from your database

## Getting Page IDs

### Option 1: Use Prisma Studio
```bash
npm run db:studio
```
Then browse to the `pages` table and copy page IDs.

### Option 2: Query via API (if you have a pages list endpoint)
Or check your database directly.

## Test Cases

### Test 1: Generate Twice - Versions Increment Correctly ✅

**Goal:** Verify that generating content twice for the same page creates version 1 and version 2, not overwriting.

**Steps:**
1. Get a PRODUCT page ID (e.g., `clx123...`)
2. Generate content first time:
```bash
curl -X POST http://localhost:3000/api/content/generate \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=YOUR_SESSION_COOKIE" \
  -d '{
    "page_id": "YOUR_PAGE_ID",
    "primary_keyword": "organic coffee beans",
    "page_type": "PRODUCT"
  }'
```

**Expected Result 1:**
```json
{
  "success": true,
  "content": "<p>Generated HTML content...</p>",
  "version": 1,
  "pageId": "clx123...",
  "pageTitle": "Product Name"
}
```

3. Generate content second time (same page, same keyword):
```bash
# Same request as above
```

**Expected Result 2:**
```json
{
  "success": true,
  "content": "<p>Different generated HTML content...</p>",
  "version": 2,  // ← Should be 2, not 1!
  "pageId": "clx123...",
  "pageTitle": "Product Name"
}
```

**✅ PASS if:** version increments from 1 to 2, and both versions exist in database

**❌ FAIL if:** version stays at 1, or second generation overwrites first

---

### Test 2: Different Page Types ✅

**Goal:** Verify endpoint works for PRODUCT, COLLECTION, and ARTICLE types.

**Steps:**
1. Get one page ID of each type
2. Generate content for each:

**PRODUCT:**
```bash
curl -X POST http://localhost:3000/api/content/generate \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=YOUR_SESSION_COOKIE" \
  -d '{
    "page_id": "PRODUCT_PAGE_ID",
    "primary_keyword": "organic coffee",
    "page_type": "PRODUCT"
  }'
```

**COLLECTION:**
```bash
curl -X POST http://localhost:3000/api/content/generate \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=YOUR_SESSION_COOKIE" \
  -d '{
    "page_id": "COLLECTION_PAGE_ID",
    "primary_keyword": "coffee collection",
    "page_type": "COLLECTION"
  }'
```

**ARTICLE:**
```bash
curl -X POST http://localhost:3000/api/content/generate \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=YOUR_SESSION_COOKIE" \
  -d '{
    "page_id": "ARTICLE_PAGE_ID",
    "primary_keyword": "coffee brewing guide",
    "page_type": "ARTICLE"
  }'
```

**✅ PASS if:** All three requests return success with different content

**❌ FAIL if:** Any request fails with "Invalid page_type" or "Page type mismatch"

---

### Test 3: Product vs Blog Content Differs ✅

**Goal:** Verify PRODUCT and ARTICLE content are different in structure and style.

**Steps:**
1. Generate content for a PRODUCT page
2. Generate content for an ARTICLE page (same keyword if possible)
3. Compare the content

**Expected:**
- **PRODUCT content:** Should be product-focused, feature-oriented, conversion-focused (300-500 words)
- **ARTICLE content:** Should be article-style, informative, educational (800-1200 words), with proper article structure

**✅ PASS if:** Content styles clearly differ (product description vs blog article)

**❌ FAIL if:** Both generate identical or very similar content

---

### Test 4: Missing Keyword - Endpoint Fails Loudly ✅

**Goal:** Verify endpoint returns clear error when `primary_keyword` is missing.

**Steps:**
```bash
curl -X POST http://localhost:3000/api/content/generate \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=YOUR_SESSION_COOKIE" \
  -d '{
    "page_id": "YOUR_PAGE_ID",
    "page_type": "PRODUCT"
  }'
```

**Expected Result:**
```json
{
  "error": "Missing required fields: page_id, primary_keyword, page_type"
}
```
Status: **400 Bad Request**

**Also test missing page_id:**
```bash
curl -X POST http://localhost:3000/api/content/generate \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=YOUR_SESSION_COOKIE" \
  -d '{
    "primary_keyword": "coffee",
    "page_type": "PRODUCT"
  }'
```

**Also test missing page_type:**
```bash
curl -X POST http://localhost:3000/api/content/generate \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=YOUR_SESSION_COOKIE" \
  -d '{
    "page_id": "YOUR_PAGE_ID",
    "primary_keyword": "coffee"
  }'
```

**✅ PASS if:** All return 400 with clear error message

**❌ FAIL if:** Returns 200 success or generic 500 error

---

### Test 5: Content Does NOT Overwrite Itself ✅

**Goal:** Verify that generating content multiple times creates new versions, not overwrites.

**Steps:**
1. Generate content for a page (version 1)
2. Note the content text (copy first 100 characters)
3. Generate again (version 2)
4. Generate again (version 3)
5. Check database - all 3 versions should exist

**Verify in Database:**
```sql
SELECT id, "pageId", version, LEFT(content, 100) as content_preview, reason, "createdAt"
FROM content_versions
WHERE "pageId" = 'YOUR_PAGE_ID'
ORDER BY version;
```

**Expected:**
- 3 rows returned
- version: 1, 2, 3
- Different content for each version
- All have `reason = 'initial_creation'`

**✅ PASS if:** All 3 versions exist with different content

**❌ FAIL if:** Only 1 version exists, or versions have identical content

---

## Quick Test Script (Browser Console)

If you're testing in the browser, you can use this JavaScript:

```javascript
// Replace with your actual page IDs
const PRODUCT_PAGE_ID = 'clx...';
const COLLECTION_PAGE_ID = 'clx...';
const ARTICLE_PAGE_ID = 'clx...';

// Test 1: Generate twice
async function testVersions() {
  const pageId = PRODUCT_PAGE_ID;
  const keyword = 'organic coffee beans';
  
  console.log('=== Test 1: Generate Twice ===');
  
  // First generation
  const res1 = await fetch('/api/content/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      page_id: pageId,
      primary_keyword: keyword,
      page_type: 'PRODUCT'
    })
  });
  const data1 = await res1.json();
  console.log('First generation:', data1);
  console.log('Version:', data1.version); // Should be 1
  
  // Second generation
  const res2 = await fetch('/api/content/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      page_id: pageId,
      primary_keyword: keyword,
      page_type: 'PRODUCT'
    })
  });
  const data2 = await res2.json();
  console.log('Second generation:', data2);
  console.log('Version:', data2.version); // Should be 2
  
  if (data2.version === 2 && data1.version === 1) {
    console.log('✅ PASS: Versions increment correctly');
  } else {
    console.log('❌ FAIL: Versions did not increment');
  }
}

// Test 2: Different page types
async function testPageTypes() {
  console.log('=== Test 2: Different Page Types ===');
  
  const tests = [
    { id: PRODUCT_PAGE_ID, type: 'PRODUCT', keyword: 'coffee beans' },
    { id: COLLECTION_PAGE_ID, type: 'COLLECTION', keyword: 'coffee collection' },
    { id: ARTICLE_PAGE_ID, type: 'ARTICLE', keyword: 'coffee guide' }
  ];
  
  for (const test of tests) {
    const res = await fetch('/api/content/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        page_id: test.id,
        primary_keyword: test.keyword,
        page_type: test.type
      })
    });
    const data = await res.json();
    console.log(`${test.type}:`, data.success ? '✅' : '❌', data);
  }
}

// Test 3: Missing keyword
async function testMissingKeyword() {
  console.log('=== Test 3: Missing Keyword ===');
  
  const res = await fetch('/api/content/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      page_id: PRODUCT_PAGE_ID,
      page_type: 'PRODUCT'
      // Missing primary_keyword
    })
  });
  const data = await res.json();
  console.log('Response:', data);
  
  if (res.status === 400 && data.error && data.error.includes('primary_keyword')) {
    console.log('✅ PASS: Fails loudly with clear error');
  } else {
    console.log('❌ FAIL: Did not fail correctly');
  }
}

// Run all tests
async function runAllTests() {
  await testVersions();
  await testPageTypes();
  await testMissingKeyword();
}

// Run: runAllTests()
```

## Verification Checklist

- [ ] Test 1: Versions increment (1 → 2 → 3)
- [ ] Test 2: All page types work (PRODUCT, COLLECTION, ARTICLE)
- [ ] Test 3: Product vs Article content differs
- [ ] Test 4: Missing keyword returns 400 with clear error
- [ ] Test 5: Multiple versions exist in database (no overwrites)

