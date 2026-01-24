/**
 * WordPress API Client Usage Example
 * 
 * This file demonstrates how to use the WordPress API client.
 * It is NOT integrated into any existing flows.
 * 
 * To use:
 * 1. Replace the placeholder values with your WordPress site credentials
 * 2. Run: npx tsx lib/wordpress-api-example.ts
 */

import { WordPressApiClient, testWordPressConnection, fetchWordPressPosts } from './wordpress-api'

/**
 * Example: Test WordPress connection
 */
async function exampleTestConnection() {
  const config = {
    siteUrl: 'https://your-wordpress-site.com',
    username: 'your-username',
    applicationPassword: 'your-application-password',
  }

  console.log('Testing WordPress connection...')
  const result = await testWordPressConnection(config)
  
  if (result.success) {
    console.log('✅ Connection successful!')
    console.log(`Post count: ${result.postCount}`)
  } else {
    console.error('❌ Connection failed:', result.error)
  }
}

/**
 * Example: Fetch posts using the client class
 */
async function exampleFetchPostsWithClient() {
  const client = new WordPressApiClient({
    siteUrl: 'https://your-wordpress-site.com',
    username: 'your-username',
    applicationPassword: 'your-application-password',
  })

  try {
    // Fetch first 10 posts
    const posts = await client.getPosts({ per_page: 10 })
    console.log(`Fetched ${posts.length} posts`)
    
    // Display post titles
    posts.forEach((post) => {
      console.log(`- ${post.title.rendered} (ID: ${post.id})`)
    })
  } catch (error) {
    console.error('Error fetching posts:', error)
  }
}

/**
 * Example: Fetch posts using convenience function
 */
async function exampleFetchPostsWithFunction() {
  const config = {
    siteUrl: 'https://your-wordpress-site.com',
    username: 'your-username',
    applicationPassword: 'your-application-password',
  }

  try {
    // Fetch published posts, ordered by date
    const posts = await fetchWordPressPosts(config, {
      per_page: 5,
      status: 'publish',
      orderby: 'date',
      order: 'desc',
    })
    
    console.log(`Fetched ${posts.length} published posts`)
    posts.forEach((post) => {
      console.log(`- ${post.title.rendered}`)
    })
  } catch (error) {
    console.error('Error fetching posts:', error)
  }
}

/**
 * Example: Fetch a single post by ID
 */
async function exampleFetchSinglePost() {
  const client = new WordPressApiClient({
    siteUrl: 'https://your-wordpress-site.com',
    username: 'your-username',
    applicationPassword: 'your-application-password',
  })

  try {
    const post = await client.getPost(1) // Replace 1 with actual post ID
    console.log(`Post: ${post.title.rendered}`)
    console.log(`Content: ${post.content.rendered.substring(0, 100)}...`)
  } catch (error) {
    console.error('Error fetching post:', error)
  }
}

// Uncomment to run examples:
// exampleTestConnection()
// exampleFetchPostsWithClient()
// exampleFetchPostsWithFunction()
// exampleFetchSinglePost()

