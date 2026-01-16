/**
 * Google Search Console API integration
 * 
 * Note: This requires Google OAuth setup and GSC API access
 * For MVP, we'll use a service account or OAuth token
 */

import { GSCApiError } from './gsc-errors'

const GSC_API_BASE = 'https://www.googleapis.com/webmasters/v3'

export interface GSCQueryData {
  query: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface GSCPageData {
  page: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

/**
 * Fetches search analytics data from Google Search Console
 * Returns query-level data for the last 7 days
 */
export async function fetchGSCSearchAnalytics(
  siteUrl: string,
  accessToken: string,
  startDate: Date,
  endDate: Date
): Promise<GSCQueryData[]> {
  const url = `${GSC_API_BASE}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`

  const requestBody = {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
    dimensions: ['query'],
    rowLimit: 10000, // Max allowed by GSC API
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new GSCApiError(
      `Google Search Console API error: ${response.status} - ${errorText}`,
      response.status,
      errorText
    )
  }

  const data = await response.json()
  const rows = data.rows || []

  return rows.map((row: any) => ({
    query: row.keys[0], // First dimension is 'query'
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    ctr: row.ctr || 0,
    position: row.position || 0,
  }))
}

/**
 * Fetches page-level search analytics data
 * Returns page URL and performance metrics
 */
export async function fetchGSCPageAnalytics(
  siteUrl: string,
  accessToken: string,
  startDate: Date,
  endDate: Date
): Promise<GSCPageData[]> {
  const url = `${GSC_API_BASE}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`

  const requestBody = {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
    dimensions: ['page'],
    rowLimit: 10000,
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new GSCApiError(
      `Google Search Console API error: ${response.status} - ${errorText}`,
      response.status,
      errorText
    )
  }

  const data = await response.json()
  const rows = data.rows || []

  return rows.map((row: any) => ({
    page: row.keys[0], // First dimension is 'page'
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    ctr: row.ctr || 0,
    position: row.position || 0,
  }))
}

/**
 * Fetches query + page combination data
 * This allows us to map specific queries to specific pages
 */
export async function fetchGSCQueryPageData(
  siteUrl: string,
  accessToken: string,
  startDate: Date,
  endDate: Date
): Promise<Array<{ query: string; page: string; clicks: number; impressions: number; position: number }>> {
  const url = `${GSC_API_BASE}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`

  const requestBody = {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
    dimensions: ['query', 'page'], // Both query and page
    rowLimit: 10000,
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new GSCApiError(
      `Google Search Console API error: ${response.status} - ${errorText}`,
      response.status,
      errorText
    )
  }

  const data = await response.json()
  const rows = data.rows || []

  return rows.map((row: any) => ({
    query: row.keys[0], // First dimension is 'query'
    page: row.keys[1],  // Second dimension is 'page'
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    position: row.position || 0,
  }))
}

/**
 * Fetches query-level search analytics data (aggregated, not by page)
 * Returns query-level data for date range, grouped by query only
 */
export async function fetchGSCQueryData(
  siteUrl: string,
  accessToken: string,
  startDate: Date,
  endDate: Date
): Promise<GSCQueryData[]> {
  const url = `${GSC_API_BASE}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`

  const requestBody = {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
    dimensions: ['query'], // Only query dimension
    rowLimit: 10000,
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new GSCApiError(
      `Google Search Console API error: ${response.status} - ${errorText}`,
      response.status,
      errorText
    )
  }

  const data = await response.json()
  const rows = data.rows || []

  return rows.map((row: any) => ({
    query: row.keys[0], // First dimension is 'query'
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    ctr: row.ctr || 0,
    position: row.position || 0,
  }))
}

/**
 * Formats date as YYYY-MM-DD for GSC API
 */
function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

