import { decryptToken } from './shopify-oauth'

/**
 * Makes an authenticated request to Shopify Admin API
 * Returns both the JSON data and response headers for pagination
 */
async function shopifyRequest(
  shop: string,
  accessToken: string,
  endpoint: string
): Promise<{ data: any; headers: Headers }> {
  // Use latest stable API version (2024-10 as of early 2025)
  const apiVersion = '2024-10'
  const url = `https://${shop}/admin/api/${apiVersion}/${endpoint}`
  
  console.log(`[Shopify API] Requesting: ${url}`)
  
  const response = await fetch(url, {
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`[Shopify API] Error ${response.status} for ${url}:`, errorText)
    throw new Error(`Shopify API error: ${response.status} - ${errorText}`)
  }

  return { data: await response.json(), headers: response.headers }
}

/**
 * Fetches all products from Shopify
 * Returns: Array of { id, title, handle, updated_at }
 */
export async function fetchShopifyProducts(
  shop: string,
  accessToken: string
): Promise<Array<{ id: string; title: string; handle: string; updated_at: string }>> {
  const products: any[] = []
  let pageInfo: string | null = null

  do {
    const params = new URLSearchParams({
      limit: '250', // Max per page
      fields: 'id,title,handle,updated_at',
    })

    if (pageInfo) {
      params.append('page_info', pageInfo)
    }

    const { data, headers } = await shopifyRequest(shop, accessToken, `products.json?${params.toString()}`)
    
    if (data.products) {
      products.push(...data.products)
    }

    // Check for pagination using Link header
    const linkHeader = headers.get('link') || ''
    const nextPageMatch = linkHeader.match(/<[^>]+page_info=([^&>]+)[^>]*>; rel="next"/)
    pageInfo = nextPageMatch ? decodeURIComponent(nextPageMatch[1]) : null
  } while (pageInfo)

  return products.map((p) => ({
    id: String(p.id),
    title: p.title,
    handle: p.handle,
    updated_at: p.updated_at,
  }))
}

/**
 * Fetches all collections from Shopify
 * Returns: Array of { id, title, handle }
 * Note: Fetches both custom_collections and smart_collections
 */
export async function fetchShopifyCollections(
  shop: string,
  accessToken: string
): Promise<Array<{ id: string; title: string; handle: string }>> {
  const collections: any[] = []

  // Fetch custom collections
  let pageInfo: string | null = null
  do {
    const params = new URLSearchParams({
      limit: '250',
      fields: 'id,title,handle',
    })

    if (pageInfo) {
      params.append('page_info', pageInfo)
    }

    const { data, headers } = await shopifyRequest(shop, accessToken, `custom_collections.json?${params.toString()}`)
    
    if (data.custom_collections) {
      collections.push(...data.custom_collections)
    }

    // Check for pagination using Link header
    const linkHeader = headers.get('link') || ''
    const nextPageMatch = linkHeader.match(/<[^>]+page_info=([^&>]+)[^>]*>; rel="next"/)
    pageInfo = nextPageMatch ? decodeURIComponent(nextPageMatch[1]) : null
  } while (pageInfo)

  // Fetch smart collections
  pageInfo = null
  do {
    const params = new URLSearchParams({
      limit: '250',
      fields: 'id,title,handle',
    })

    if (pageInfo) {
      params.append('page_info', pageInfo)
    }

    const { data, headers } = await shopifyRequest(shop, accessToken, `smart_collections.json?${params.toString()}`)
    
    if (data.smart_collections) {
      collections.push(...data.smart_collections)
    }

    // Check for pagination using Link header
    const linkHeader = headers.get('link') || ''
    const nextPageMatch = linkHeader.match(/<[^>]+page_info=([^&>]+)[^>]*>; rel="next"/)
    pageInfo = nextPageMatch ? decodeURIComponent(nextPageMatch[1]) : null
  } while (pageInfo)

  return collections.map((c) => ({
    id: String(c.id),
    title: c.title,
    handle: c.handle,
  }))
}

/**
 * Fetches all blog articles from Shopify
 * Returns: Array of { id, title, handle, published_at, blog_handle }
 */
export async function fetchShopifyArticles(
  shop: string,
  accessToken: string
): Promise<Array<{ id: string; title: string; handle: string; published_at: string | null; blog_handle: string }>> {
  // First, get all blogs with their handles
  const { data: blogsData } = await shopifyRequest(shop, accessToken, 'blogs.json?fields=id,handle')
  const blogs = blogsData.blogs || []

  const articles: any[] = []

  // Fetch articles from each blog
  for (const blog of blogs) {
    let pageInfo: string | null = null

    do {
      const params = new URLSearchParams({
        limit: '250',
        fields: 'id,title,handle,published_at',
      })

      if (pageInfo) {
        params.append('page_info', pageInfo)
      }

      const { data, headers } = await shopifyRequest(
        shop,
        accessToken,
        `blogs/${blog.id}/articles.json?${params.toString()}`
      )

      if (data.articles) {
        // Add blog handle to each article
        articles.push(...data.articles.map((a: any) => ({ ...a, blog_handle: blog.handle })))
      }

      // Check for pagination using Link header
      const linkHeader = headers.get('link') || ''
      const nextPageMatch = linkHeader.match(/<[^>]+page_info=([^&>]+)[^>]*>; rel="next"/)
      pageInfo = nextPageMatch ? decodeURIComponent(nextPageMatch[1]) : null
    } while (pageInfo)
  }

  return articles.map((a) => ({
    id: String(a.id),
    title: a.title,
    handle: a.handle,
    published_at: a.published_at,
    blog_handle: a.blog_handle,
  }))
}

