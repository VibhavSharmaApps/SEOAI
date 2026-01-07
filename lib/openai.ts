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

  const prompt = `Generate 3-5 SEO keyword phrases for an e-commerce page. 
Only return the keywords, one per line, no numbering, no explanations.

Page Title: ${pageTitle}
${description ? `Description: ${description.substring(0, 500)}` : ''}

Generate relevant, searchable keyword phrases that customers might use to find this product or collection. Focus on:
- Product/collection name variations
- Use cases and benefits
- Target audience terms
- Related search terms

Return only the keywords, one per line:`

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

    // Parse keywords from response (one per line)
    const keywords = content
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0 && !line.match(/^\d+[\.\)]/)) // Remove numbering
      .slice(0, 5) // Limit to 5 keywords

    if (keywords.length === 0) {
      // Fallback: generate simple keywords from title
      const words = pageTitle.toLowerCase().split(/\s+/)
      return [
        pageTitle.toLowerCase(),
        words.slice(0, 3).join(' '),
        words.slice(-2).join(' '),
      ].filter(Boolean)
    }

    return keywords
  } catch (error) {
    console.error('[OpenAI] Error generating keywords:', error)
    // Fallback: generate simple keywords from title
    const words = pageTitle.toLowerCase().split(/\s+/)
    return [
      pageTitle.toLowerCase(),
      words.slice(0, 3).join(' '),
      words.slice(-2).join(' '),
    ].filter(Boolean).slice(0, 5)
  }
}

