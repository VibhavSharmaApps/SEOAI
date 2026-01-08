import { decryptToken } from './shopify-oauth'

const API_VERSION = '2024-10'

/**
 * Updates a product's description in Shopify
 */
export async function updateProductDescription(
  shop: string,
  accessToken: string,
  productId: string,
  description: string
): Promise<void> {
  const url = `https://${shop}/admin/api/${API_VERSION}/products/${productId}.json`

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      product: {
        id: productId,
        body_html: description,
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Shopify API error: ${response.status} - ${errorText}`)
  }

  console.log(`[Shopify Publish] Updated product ${productId} description`)
}

/**
 * Updates an article's body in Shopify
 * Note: Requires blog_id to update article
 */
export async function updateArticleBody(
  shop: string,
  accessToken: string,
  blogId: string,
  articleId: string,
  body: string
): Promise<void> {
  const url = `https://${shop}/admin/api/${API_VERSION}/blogs/${blogId}/articles/${articleId}.json`

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      article: {
        id: articleId,
        body_html: body,
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Shopify API error: ${response.status} - ${errorText}`)
  }

  console.log(`[Shopify Publish] Updated article ${articleId} body`)
}

/**
 * Gets the blog ID for an article
 * We need this because article updates require the blog ID
 */
export async function getBlogIdForArticle(
  shop: string,
  accessToken: string,
  articleId: string
): Promise<string | null> {
  // Fetch all blogs and their articles to find which blog contains this article
  const url = `https://${shop}/admin/api/${API_VERSION}/blogs.json?fields=id,handle`

  const response = await fetch(url, {
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch blogs: ${response.status}`)
  }

  const data = await response.json()
  const blogs = data.blogs || []

  // Search through each blog's articles
  for (const blog of blogs) {
    const articlesUrl = `https://${shop}/admin/api/${API_VERSION}/blogs/${blog.id}/articles.json?fields=id&limit=250`
    const articlesResponse = await fetch(articlesUrl, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    })

    if (articlesResponse.ok) {
      const articlesData = await articlesResponse.json()
      const articles = articlesData.articles || []
      
      // Check if this article is in this blog
      if (articles.some((a: any) => String(a.id) === String(articleId))) {
        return String(blog.id)
      }
    }
  }

  return null
}

