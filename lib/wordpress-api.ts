/**
 * WordPress API Client
 * Supports authentication via Application Password
 * 
 * WordPress REST API documentation:
 * https://developer.wordpress.org/rest-api/
 * 
 * Application Password authentication:
 * https://wordpress.org/support/article/application-passwords/
 */

/**
 * WordPress API client configuration
 */
export interface WordPressConfig {
  siteUrl: string // WordPress site URL (e.g., "https://example.com")
  username: string // WordPress username
  applicationPassword: string // WordPress Application Password
}

/**
 * WordPress Post (simplified structure)
 */
export interface WordPressPost {
  id: number
  date: string
  date_gmt: string
  modified: string
  modified_gmt: string
  slug: string
  status: string
  type: string
  link: string
  title: {
    rendered: string
  }
  content: {
    rendered: string
    protected: boolean
  }
  excerpt: {
    rendered: string
    protected: boolean
  }
  author: number
  featured_media: number
  comment_status: string
  ping_status: string
  sticky: boolean
  template: string
  format: string
  meta: Record<string, any>
  categories: number[]
  tags: number[]
  _links: Record<string, any>
}

/**
 * WordPress API response wrapper
 */
export interface WordPressApiResponse<T> {
  data: T
  headers: Headers
  status: number
}

/**
 * WordPress API Error
 */
export class WordPressApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response?: any
  ) {
    super(message)
    this.name = 'WordPressApiError'
    Object.setPrototypeOf(this, WordPressApiError.prototype)
  }
}

/**
 * WordPress API Client
 * Handles authentication and API requests to WordPress REST API
 */
export class WordPressApiClient {
  private baseUrl: string
  private authHeader: string

  constructor(config: WordPressConfig) {
    // Normalize site URL (remove trailing slash)
    this.baseUrl = config.siteUrl.replace(/\/$/, '')
    
    // Create Basic Auth header with Application Password
    // Format: base64(username:application_password)
    const credentials = `${config.username}:${config.applicationPassword}`
    const encodedCredentials = Buffer.from(credentials).toString('base64')
    this.authHeader = `Basic ${encodedCredentials}`
  }

  /**
   * Makes an authenticated request to WordPress REST API
   * 
   * @param endpoint - API endpoint (e.g., "/wp-json/wp/v2/posts")
   * @param options - Fetch options (method, body, etc.)
   * @returns Response with parsed JSON data and headers
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<WordPressApiResponse<T>> {
    // Ensure endpoint starts with /
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    const url = `${this.baseUrl}${normalizedEndpoint}`

    // Merge headers with authentication
    const headers = new Headers(options.headers)
    headers.set('Authorization', this.authHeader)
    headers.set('Content-Type', 'application/json')

    console.log(`[WordPress API] ${options.method || 'GET'} ${url}`)

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      })

      // Parse response body
      let data: T
      const contentType = response.headers.get('content-type')
      
      if (contentType?.includes('application/json')) {
        data = await response.json()
      } else {
        const text = await response.text()
        data = text as unknown as T
      }

      if (!response.ok) {
        const errorMessage = typeof data === 'object' && data !== null
          ? (data as any).message || (data as any).code || 'Unknown error'
          : String(data)
        
        throw new WordPressApiError(
          `WordPress API error: ${response.status} - ${errorMessage}`,
          response.status,
          data
        )
      }

      return {
        data,
        headers: response.headers,
        status: response.status,
      }
    } catch (error) {
      if (error instanceof WordPressApiError) {
        throw error
      }
      
      // Handle network errors or other fetch errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new WordPressApiError(
        `WordPress API request failed: ${errorMessage}`,
        0,
        error
      )
    }
  }

  /**
   * Fetches posts from WordPress
   * 
   * @param params - Query parameters (page, per_page, search, etc.)
   * @returns Array of WordPress posts
   */
  async getPosts(params?: {
    page?: number
    per_page?: number
    search?: string
    status?: string
    orderby?: string
    order?: 'asc' | 'desc'
  }): Promise<WordPressPost[]> {
    // Build query string
    const queryParams = new URLSearchParams()
    
    if (params?.page) {
      queryParams.append('page', String(params.page))
    }
    
    if (params?.per_page) {
      queryParams.append('per_page', String(params.per_page))
    }
    
    if (params?.search) {
      queryParams.append('search', params.search)
    }
    
    if (params?.status) {
      queryParams.append('status', params.status)
    }
    
    if (params?.orderby) {
      queryParams.append('orderby', params.orderby)
    }
    
    if (params?.order) {
      queryParams.append('order', params.order)
    }

    const queryString = queryParams.toString()
    const endpoint = `/wp-json/wp/v2/posts${queryString ? `?${queryString}` : ''}`

    const response = await this.request<WordPressPost[]>(endpoint, {
      method: 'GET',
    })

    return response.data
  }

  /**
   * Fetches a single post by ID
   * 
   * @param postId - WordPress post ID
   * @returns WordPress post
   */
  async getPost(postId: number): Promise<WordPressPost> {
    const response = await this.request<WordPressPost>(
      `/wp-json/wp/v2/posts/${postId}`,
      {
        method: 'GET',
      }
    )

    return response.data
  }

  /**
   * Fetches a single page by ID
   * 
   * @param pageId - WordPress page ID
   * @returns WordPress post (pages use same structure)
   */
  async getPage(pageId: number): Promise<WordPressPost> {
    const response = await this.request<WordPressPost>(
      `/wp-json/wp/v2/pages/${pageId}`,
      {
        method: 'GET',
      }
    )

    return response.data
  }

  /**
   * Updates a post in WordPress
   * 
   * @param postId - WordPress post ID
   * @param updateData - Data to update
   * @returns Updated WordPress post
   */
  async updatePost(
    postId: number,
    updateData: {
      title?: string
      content?: string
      excerpt?: string
      meta?: Record<string, any>
      [key: string]: any
    }
  ): Promise<WordPressPost> {
    const endpoint = `/wp-json/wp/v2/posts/${postId}`
    
    const response = await this.request<WordPressPost>(endpoint, {
      method: 'POST', // WordPress REST API uses POST for updates
      body: JSON.stringify(updateData),
    })

    return response.data
  }

  /**
   * Updates a page in WordPress
   * 
   * @param pageId - WordPress page ID
   * @param updateData - Data to update
   * @returns Updated WordPress post (pages use same structure)
   */
  async updatePage(
    pageId: number,
    updateData: {
      title?: string
      content?: string
      excerpt?: string
      meta?: Record<string, any>
      [key: string]: any
    }
  ): Promise<WordPressPost> {
    const endpoint = `/wp-json/wp/v2/pages/${pageId}`
    
    const response = await this.request<WordPressPost>(endpoint, {
      method: 'POST', // WordPress REST API uses POST for updates
      body: JSON.stringify(updateData),
    })

    return response.data
  }

  /**
   * Test connection to WordPress API
   * Fetches a single post to verify authentication works
   * 
   * @returns Test result with post count or error
   */
  async testConnection(): Promise<{
    success: boolean
    message: string
    postCount?: number
    error?: string
  }> {
    try {
      // Try to fetch a small number of posts to test the connection
      const posts = await this.getPosts({ per_page: 1 })
      
      return {
        success: true,
        message: 'Successfully connected to WordPress API',
        postCount: posts.length,
      }
    } catch (error) {
      const errorMessage = error instanceof WordPressApiError
        ? error.message
        : error instanceof Error
        ? error.message
        : 'Unknown error'
      
      return {
        success: false,
        message: 'Failed to connect to WordPress API',
        error: errorMessage,
      }
    }
  }
}

/**
 * Convenience function to create a WordPress API client and test the connection
 * 
 * @param config - WordPress configuration
 * @returns Test result
 */
export async function testWordPressConnection(
  config: WordPressConfig
): Promise<{
  success: boolean
  message: string
  postCount?: number
  error?: string
}> {
  const client = new WordPressApiClient(config)
  return client.testConnection()
}

/**
 * Convenience function to fetch posts from WordPress
 * 
 * @param config - WordPress configuration
 * @param params - Query parameters
 * @returns Array of WordPress posts
 */
export async function fetchWordPressPosts(
  config: WordPressConfig,
  params?: {
    page?: number
    per_page?: number
    search?: string
    status?: string
    orderby?: string
    order?: 'asc' | 'desc'
  }
): Promise<WordPressPost[]> {
  const client = new WordPressApiClient(config)
  return client.getPosts(params)
}


