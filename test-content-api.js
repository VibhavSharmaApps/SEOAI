/**
 * Test Script for /api/content/generate
 * 
 * Run this in your browser console while logged in to your Vercel app.
 * 
 * Instructions:
 * 1. Open your Vercel app (e.g., https://your-app.vercel.app)
 * 2. Make sure you're logged in
 * 3. Open Developer Console (F12)
 * 4. Paste this entire file
 * 5. Run: runAllTests()
 */

// Auto-detect the current domain (works on Vercel)
const API_BASE = window.location.origin;
console.log('🌐 Using API base:', API_BASE);

// Helper function to make API calls
async function apiCall(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    credentials: 'include', // Include cookies for auth
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await response.json();
  return { response, data, status: response.status };
}

// Test 1: Get page IDs
async function getPages() {
  console.log('📋 Fetching pages...');
  const { data, status } = await apiCall('/api/pages/list');
  
  if (status !== 200) {
    console.error('❌ Failed to fetch pages:', data);
    return null;
  }
  
  console.log(`✅ Found ${data.pages.length} pages`);
  console.log('Summary:', data.summary);
  
  // Group by type
  const byType = {
    PRODUCT: data.pages.filter(p => p.type === 'PRODUCT'),
    COLLECTION: data.pages.filter(p => p.type === 'COLLECTION'),
    ARTICLE: data.pages.filter(p => p.type === 'ARTICLE'),
  };
  
  console.log('By type:', {
    PRODUCT: byType.PRODUCT.length,
    COLLECTION: byType.COLLECTION.length,
    ARTICLE: byType.ARTICLE.length,
  });
  
  return byType;
}

// Test 2: Generate twice - versions increment
async function testVersions(pageId, pageType) {
  console.log('\n🔄 Test 1: Generate Twice - Versions Increment');
  console.log('='.repeat(50));
  
  const keyword = 'organic coffee beans';
  
  // First generation
  console.log('Generating version 1...');
  const { data: data1, status: status1 } = await apiCall('/api/content/generate', {
    method: 'POST',
    body: JSON.stringify({
      page_id: pageId,
      primary_keyword: keyword,
      page_type: pageType,
    }),
  });
  
  if (status1 !== 200) {
    console.error('❌ First generation failed:', data1);
    return false;
  }
  
  console.log(`✅ Version ${data1.version} created`);
  console.log(`Content preview: ${data1.content.substring(0, 100)}...`);
  
  // Wait a bit to ensure different content
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Second generation
  console.log('\nGenerating version 2...');
  const { data: data2, status: status2 } = await apiCall('/api/content/generate', {
    method: 'POST',
    body: JSON.stringify({
      page_id: pageId,
      primary_keyword: keyword,
      page_type: pageType,
    }),
  });
  
  if (status2 !== 200) {
    console.error('❌ Second generation failed:', data2);
    return false;
  }
  
  console.log(`✅ Version ${data2.version} created`);
  console.log(`Content preview: ${data2.content.substring(0, 100)}...`);
  
  // Verify versions increment
  if (data1.version === 1 && data2.version === 2) {
    console.log('\n✅ PASS: Versions increment correctly (1 → 2)');
    return true;
  } else {
    console.log(`\n❌ FAIL: Expected versions 1 and 2, got ${data1.version} and ${data2.version}`);
    return false;
  }
}

// Test 3: Different page types
async function testPageTypes(pages) {
  console.log('\n📄 Test 2: Different Page Types');
  console.log('='.repeat(50));
  
  const results = {};
  
  if (pages.PRODUCT.length > 0) {
    console.log('\nTesting PRODUCT...');
    const { data, status } = await apiCall('/api/content/generate', {
      method: 'POST',
      body: JSON.stringify({
        page_id: pages.PRODUCT[0].id,
        primary_keyword: 'coffee beans',
        page_type: 'PRODUCT',
      }),
    });
    results.PRODUCT = { status, success: status === 200, version: data.version };
    console.log(status === 200 ? '✅ PRODUCT works' : '❌ PRODUCT failed', data);
  }
  
  if (pages.COLLECTION.length > 0) {
    console.log('\nTesting COLLECTION...');
    const { data, status } = await apiCall('/api/content/generate', {
      method: 'POST',
      body: JSON.stringify({
        page_id: pages.COLLECTION[0].id,
        primary_keyword: 'coffee collection',
        page_type: 'COLLECTION',
      }),
    });
    results.COLLECTION = { status, success: status === 200, version: data.version };
    console.log(status === 200 ? '✅ COLLECTION works' : '❌ COLLECTION failed', data);
  }
  
  if (pages.ARTICLE.length > 0) {
    console.log('\nTesting ARTICLE...');
    const { data, status } = await apiCall('/api/content/generate', {
      method: 'POST',
      body: JSON.stringify({
        page_id: pages.ARTICLE[0].id,
        primary_keyword: 'coffee guide',
        page_type: 'ARTICLE',
      }),
    });
    results.ARTICLE = { status, success: status === 200, version: data.version };
    console.log(status === 200 ? '✅ ARTICLE works' : '❌ ARTICLE failed', data);
  }
  
  const allPassed = Object.values(results).every(r => r.success);
  console.log(allPassed ? '\n✅ PASS: All page types work' : '\n❌ FAIL: Some page types failed');
  return results;
}

// Test 4: Product vs Article content differs
async function testContentDiffers(pages) {
  console.log('\n📝 Test 3: Product vs Article Content Differs');
  console.log('='.repeat(50));
  
  if (pages.PRODUCT.length === 0 || pages.ARTICLE.length === 0) {
    console.log('⚠️  Need both PRODUCT and ARTICLE pages to test');
    return false;
  }
  
  const keyword = 'coffee';
  
  // Generate PRODUCT content
  console.log('Generating PRODUCT content...');
  const { data: productData } = await apiCall('/api/content/generate', {
    method: 'POST',
    body: JSON.stringify({
      page_id: pages.PRODUCT[0].id,
      primary_keyword: keyword,
      page_type: 'PRODUCT',
    }),
  });
  
  // Generate ARTICLE content
  console.log('Generating ARTICLE content...');
  const { data: articleData } = await apiCall('/api/content/generate', {
    method: 'POST',
    body: JSON.stringify({
      page_id: pages.ARTICLE[0].id,
      primary_keyword: keyword,
      page_type: 'ARTICLE',
    }),
  });
  
  const productLength = productData.content.length;
  const articleLength = articleData.content.length;
  
  console.log(`PRODUCT content length: ${productLength} chars`);
  console.log(`ARTICLE content length: ${articleLength} chars`);
  console.log(`Difference: ${Math.abs(productLength - articleLength)} chars`);
  
  // Articles should be longer (800-1200 words vs 300-500 words)
  if (articleLength > productLength && articleLength > 2000) {
    console.log('\n✅ PASS: Article content is longer and different from product');
    return true;
  } else {
    console.log('\n❌ FAIL: Content lengths are too similar');
    return false;
  }
}

// Test 5: Missing keyword - fails loudly
async function testMissingKeyword(pages) {
  console.log('\n🚫 Test 4: Missing Keyword - Fails Loudly');
  console.log('='.repeat(50));
  
  if (pages.PRODUCT.length === 0) {
    console.log('⚠️  Need a PRODUCT page to test');
    return false;
  }
  
  // Test missing primary_keyword
  console.log('Testing missing primary_keyword...');
  const { data, status } = await apiCall('/api/content/generate', {
    method: 'POST',
    body: JSON.stringify({
      page_id: pages.PRODUCT[0].id,
      page_type: 'PRODUCT',
      // Missing primary_keyword
    }),
  });
  
  if (status === 400 && data.error && data.error.includes('primary_keyword')) {
    console.log('✅ PASS: Returns 400 with clear error about missing keyword');
    console.log('Error message:', data.error);
    return true;
  } else {
    console.log('❌ FAIL: Did not return expected error');
    console.log('Status:', status);
    console.log('Response:', data);
    return false;
  }
}

// Test 6: Content does not overwrite
async function testNoOverwrite(pageId, pageType) {
  console.log('\n💾 Test 5: Content Does NOT Overwrite');
  console.log('='.repeat(50));
  
  const keyword = 'coffee beans';
  const versions = [];
  
  // Generate 3 versions
  for (let i = 1; i <= 3; i++) {
    console.log(`Generating version ${i}...`);
    const { data, status } = await apiCall('/api/content/generate', {
      method: 'POST',
      body: JSON.stringify({
        page_id: pageId,
        primary_keyword: keyword,
        page_type: pageType,
      }),
    });
    
    if (status !== 200) {
      console.error(`❌ Version ${i} failed:`, data);
      return false;
    }
    
    versions.push({
      version: data.version,
      contentPreview: data.content.substring(0, 50),
      contentLength: data.content.length,
    });
    
    // Small delay between generations
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\nGenerated versions:');
  versions.forEach(v => {
    console.log(`  Version ${v.version}: ${v.contentLength} chars - "${v.contentPreview}..."`);
  });
  
  // Check all versions are different
  const allDifferent = versions.every((v, i) => {
    return versions.every((v2, i2) => {
      if (i === i2) return true;
      return v.contentPreview !== v2.contentPreview || v.contentLength !== v2.contentLength;
    });
  });
  
  const versionsCorrect = versions.map(v => v.version).join(',') === '1,2,3';
  
  if (allDifferent && versionsCorrect) {
    console.log('\n✅ PASS: All 3 versions exist and are different');
    return true;
  } else {
    console.log('\n❌ FAIL: Versions may have overwritten or are identical');
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('🧪 Starting Content Generation API Tests');
  console.log('='.repeat(50));
  
  // Get pages
  const pages = await getPages();
  if (!pages) {
    console.error('❌ Cannot proceed without pages');
    return;
  }
  
  // Find a page to use for version testing
  const testPage = pages.PRODUCT[0] || pages.COLLECTION[0] || pages.ARTICLE[0];
  if (!testPage) {
    console.error('❌ No pages available for testing');
    return;
  }
  
  const results = {
    versions: false,
    pageTypes: false,
    contentDiffers: false,
    missingKeyword: false,
    noOverwrite: false,
  };
  
  // Run tests
  results.versions = await testVersions(testPage.id, testPage.type);
  results.pageTypes = await testPageTypes(pages);
  results.contentDiffers = await testContentDiffers(pages);
  results.missingKeyword = await testMissingKeyword(pages);
  results.noOverwrite = await testNoOverwrite(testPage.id, testPage.type);
  
  // Summary
  console.log('\n📊 Test Summary');
  console.log('='.repeat(50));
  console.log('Versions increment:     ', results.versions ? '✅' : '❌');
  console.log('All page types work:   ', results.pageTypes ? '✅' : '❌');
  console.log('Content differs:       ', results.contentDiffers ? '✅' : '❌');
  console.log('Missing keyword fails: ', results.missingKeyword ? '✅' : '❌');
  console.log('No overwrite:          ', results.noOverwrite ? '✅' : '❌');
  
  const allPassed = Object.values(results).every(r => r === true);
  console.log('\n' + (allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'));
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    runAllTests,
    getPages,
    testVersions,
    testPageTypes,
    testContentDiffers,
    testMissingKeyword,
    testNoOverwrite,
  };
}

// Auto-run if in browser
if (typeof window !== 'undefined') {
  console.log('💡 Run runAllTests() to start testing');
}

