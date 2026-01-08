/**
 * OpenAI API client for generating keywords
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'

/**
 * Generates keyword phrases using OpenAI
 * @param pageTitle - The page title
 * @param description - Optional product/collection description
 * @returns Array of 3-5 keyword phrases
 */
export async function generateKeywords(
  pageTitle: string,
  description?: string
): Promise<string[]> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required')
  }

  const prompt = `Generate exactly 2 SEO keyword phrases for an e-commerce page. 
Only return the keywords, one per line, no numbering, no explanations.

Page Title: ${pageTitle}
${description ? `Description: ${description.substring(0, 500)}` : ''}

Generate exactly 2 relevant, searchable keyword phrases that customers might use to find this product or collection. Focus on:
- Product/collection name variations
- Use cases and benefits
- Target audience terms
- Related search terms

Return exactly 2 keywords, one per line:`

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Using cost-effective model
        messages: [
          {
            role: 'system',
            content: 'You are an SEO expert. Generate only keyword phrases, one per line, no explanations.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 200,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${error}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content || ''

    console.log(`[OpenAI] Raw response:`, content.substring(0, 200))

    // Parse keywords from response (one per line)
    let keywords = content
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => {
        // Remove empty lines
        if (line.length === 0) return false
        // Remove numbered lists (1., 2., etc.)
        if (line.match(/^\d+[\.\)]\s*/)) return false
        // Remove markdown formatting
        if (line.startsWith('-') || line.startsWith('*')) {
          return line.substring(1).trim().length > 0
        }
        return true
      })
      .map((line: string) => {
        // Remove markdown list markers
        if (line.startsWith('-') || line.startsWith('*')) {
          return line.substring(1).trim()
        }
        return line
      })
      .filter((line: string) => line.length > 0)
      .slice(0, 2) // Limit to 2 keywords per page

    console.log(`[OpenAI] Parsed ${keywords.length} keywords:`, keywords)

    if (keywords.length === 0) {
      console.warn(`[OpenAI] No keywords parsed, using fallback for: ${pageTitle}`)
      // Fallback: generate simple keywords from title
      const words = pageTitle.toLowerCase().split(/\s+/).filter(w => w.length > 0)
      const fallback = [
        pageTitle.toLowerCase(),
        words.slice(0, 3).join(' '),
      ].filter(Boolean).filter((k, i, arr) => arr.indexOf(k) === i).slice(0, 2) // Max 2 keywords
      console.log(`[OpenAI] Fallback keywords:`, fallback)
      return fallback
    }

    return keywords
  } catch (error) {
    console.error('[OpenAI] Error generating keywords:', error)
    // Fallback: generate simple keywords from title
    const words = pageTitle.toLowerCase().split(/\s+/)
    return [
      pageTitle.toLowerCase(),
      words.slice(0, 3).join(' '),
    ].filter(Boolean).slice(0, 2) // Max 2 keywords
  }
}

/**
 * Generates SEO-optimized content for a page based on type and search intent
 * @param pageType - Type of page (PRODUCT, COLLECTION, ARTICLE)
 * @param pageTitle - The page title
 * @param primaryKeyword - The primary keyword to optimize for
 * @param description - Optional existing description/content
 * @returns Generated content (HTML format)
 */
export async function generateContent(
  pageType: 'PRODUCT' | 'COLLECTION' | 'ARTICLE',
  pageTitle: string,
  primaryKeyword: string,
  description?: string
): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required')
  }

  // Determine search intent and content structure based on page type
  let contentGuidance = ''
  let contentType = ''

  switch (pageType) {
    case 'PRODUCT':
      contentType = 'product description'
      contentGuidance = `Create a compelling product description that:
- Naturally incorporates the primary keyword "${primaryKeyword}" multiple times
- Highlights key features, benefits, and use cases
- Includes specifications and details customers care about
- Uses persuasive, conversion-focused language
- Is 300-500 words long
- Uses proper HTML formatting (paragraphs, lists, headings)
- Optimized for SEO while remaining engaging and readable`
      break
    case 'COLLECTION':
      contentType = 'collection landing page content'
      contentGuidance = `Create engaging collection page content that:
- Naturally incorporates the primary keyword "${primaryKeyword}" multiple times
- Introduces the collection theme and what makes it special
- Highlights key products or categories within the collection
- Uses descriptive, inspiring language
- Is 200-400 words long
- Uses proper HTML formatting (paragraphs, lists, headings)
- Optimized for SEO while remaining engaging and readable`
      break
    case 'ARTICLE':
      contentType = 'blog article'
      contentGuidance = `Create a comprehensive blog article that:
- Naturally incorporates the primary keyword "${primaryKeyword}" throughout
- Provides valuable, informative content related to the topic
- Uses proper article structure (introduction, body, conclusion)
- Includes engaging subheadings
- Is 800-1200 words long
- Uses proper HTML formatting (paragraphs, lists, headings, strong/em tags)
- Optimized for SEO while providing genuine value to readers`
      break
  }

  const prompt = `You are an expert SEO content writer. Generate ${contentType} for an e-commerce website.

Page Title: ${pageTitle}
Primary Keyword: ${primaryKeyword}
${description ? `Existing Description/Context: ${description.substring(0, 500)}` : ''}

${contentGuidance}

Return the content in clean HTML format. Use:
- <p> tags for paragraphs
- <h2> and <h3> tags for subheadings
- <ul> and <li> tags for lists
- <strong> and <em> tags for emphasis
- Do NOT include a title (h1) - that's already provided
- Ensure the primary keyword appears naturally throughout the content
- Make it engaging, informative, and optimized for search engines

Return only the HTML content, no explanations:`

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert SEO content writer specializing in e-commerce. Generate high-quality, SEO-optimized content that naturally incorporates keywords while remaining engaging and valuable to readers. Always return clean, well-formatted HTML.`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.8,
        max_tokens: 2000,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${error}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content || ''

    console.log(`[OpenAI] Generated content for ${pageType} "${pageTitle}": ${content.length} characters`)

    if (!content || content.trim().length === 0) {
      throw new Error('Generated content is empty')
    }

    return content.trim()
  } catch (error) {
    console.error('[OpenAI] Error generating content:', error)
    throw error
  }
}

