/**
 * DataForSEO API Client — Fetch ranked keywords and identify opportunities
 *
 * This service integrates with DataForSEO's "Ranked Keywords" endpoint to find
 * keywords ranking in positions 11-20 (page 2) with high traffic potential.
 */

// DataForSEO API credentials (store in env)
const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN!;
const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD!;
const DATAFORSEO_API_URL = "https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live";

/**
 * CTR (Click-Through Rate) curve by position
 * Based on industry averages (2024 data)
 * Source: Advanced Web Ranking CTR study
 */
const CTR_BY_POSITION: Record<number, number> = {
  1: 0.398,  // 39.8% CTR for position 1
  2: 0.184,  // 18.4%
  3: 0.102,  // 10.2%
  4: 0.069,  // 6.9%
  5: 0.051,  // 5.1%
  6: 0.040,  // 4.0%
  7: 0.033,  // 3.3%
  8: 0.028,  // 2.8%
  9: 0.024,  // 2.4%
  10: 0.021, // 2.1%
  11: 0.013, // 1.3%
  12: 0.011, // 1.1%
  13: 0.010, // 1.0%
  14: 0.009, // 0.9%
  15: 0.008, // 0.8%
  16: 0.007, // 0.7%
  17: 0.006, // 0.6%
  18: 0.005, // 0.5%
  19: 0.005, // 0.5%
  20: 0.004, // 0.4%
};

/**
 * DataForSEO Ranked Keywords response types
 */
interface DataForSEORankedKeywordsItem {
  keyword_data: {
    keyword: string;
    keyword_info: {
      search_volume: number;
      cpc?: number;
      competition?: number;
      monthly_searches?: Array<{ month: number; year: number; search_volume: number }>;
    };
  };
  ranked_serp_element: {
    serp_item: {
      rank_group: number;        // Position (1-100)
      rank_absolute: number;     // Absolute position
      position: string;          // Position as string
      url: string;               // Ranking URL
      title?: string;            // Page title
      description?: string;      // Meta description
    };
  };
  keyword_properties?: {
    keyword_difficulty?: number; // 0-100
  };
}

interface DataForSEOResponse {
  status_code: number;
  status_message: string;
  tasks: Array<{
    status_code: number;
    status_message: string;
    result: Array<{
      items: DataForSEORankedKeywordsItem[];
      items_count: number;
    }>;
  }>;
}

/**
 * Opportunity data structure
 */
export interface OpportunityData {
  keyword: string;
  current_position: number;
  target_url: string;
  search_volume: number;
  current_traffic: number;
  potential_traffic_pos_1: number;
  traffic_gain: number;
  traffic_gain_percentage: number;
  cpc?: number;
  competition?: number;
  keyword_difficulty?: number;
  ranking_page_title?: string;
  ranking_page_description?: string;
  opportunity_score: number;
}

/**
 * Fetch ranked keywords from DataForSEO
 *
 * @param domain - Domain to check (e.g., "example.com")
 * @param locationCode - DataForSEO location code (2840 = US)
 * @param languageCode - Language code (e.g., "en")
 * @returns Array of all ranked keywords
 */
export async function fetchRankedKeywords(
  domain: string,
  locationCode: number = 2840,
  languageCode: string = "en"
): Promise<DataForSEORankedKeywordsItem[]> {
  if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) {
    throw new Error("DataForSEO credentials not configured");
  }

  const auth = Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString("base64");

  const response = await fetch(DATAFORSEO_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      {
        target: domain,
        location_code: locationCode,
        language_code: languageCode,
        limit: 1000, // Get up to 1000 keywords
        filters: [
          // Filter for keywords with search volume > 0
          ["keyword_data.keyword_info.search_volume", ">", 0],
        ],
        order_by: ["ranked_serp_element.serp_item.rank_group,asc"], // Order by position
      },
    ]),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DataForSEO API error: ${response.status} - ${error}`);
  }

  const data: DataForSEOResponse = await response.json();

  if (data.status_code !== 20000) {
    throw new Error(`DataForSEO error: ${data.status_message}`);
  }

  const task = data.tasks[0];
  if (task.status_code !== 20000 || !task.result || task.result.length === 0) {
    throw new Error(`DataForSEO task error: ${task.status_message}`);
  }

  return task.result[0].items || [];
}

/**
 * Calculate estimated monthly traffic for a keyword at a given position
 *
 * @param searchVolume - Monthly search volume
 * @param position - SERP position (1-20)
 * @returns Estimated monthly traffic
 */
export function calculateTraffic(searchVolume: number, position: number): number {
  const ctr = CTR_BY_POSITION[position] || 0.001; // Default to 0.1% for positions beyond 20
  return searchVolume * ctr;
}

/**
 * Calculate opportunity score
 * Score = (search_volume * traffic_gain * ease_factor) / 1000
 * ease_factor = 1.0 for position 11, decreasing to 0.5 for position 20
 *
 * @param searchVolume - Monthly search volume
 * @param trafficGain - Traffic gain if moved to position 1
 * @param currentPosition - Current ranking position
 * @returns Opportunity score (higher is better)
 */
export function calculateOpportunityScore(
  searchVolume: number,
  trafficGain: number,
  currentPosition: number
): number {
  // Easier to move from position 11 than position 20
  const easeFactor = 1.0 - (currentPosition - 11) * 0.05;
  return (searchVolume * trafficGain * easeFactor) / 1000.0;
}

/**
 * Filter and process opportunities from ranked keywords
 *
 * Finds keywords ranking in positions 11-20 and calculates their traffic potential.
 *
 * @param rankedKeywords - All ranked keywords from DataForSEO
 * @returns Array of opportunity data, sorted by opportunity score
 */
export function extractOpportunities(
  rankedKeywords: DataForSEORankedKeywordsItem[]
): OpportunityData[] {
  const opportunities: OpportunityData[] = [];

  for (const item of rankedKeywords) {
    const position = item.ranked_serp_element.serp_item.rank_group;

    // Filter for positions 11-20 only
    if (position < 11 || position > 20) {
      continue;
    }

    const searchVolume = item.keyword_data.keyword_info.search_volume;

    // Skip keywords with no search volume
    if (searchVolume === 0) {
      continue;
    }

    const keyword = item.keyword_data.keyword;
    const currentTraffic = calculateTraffic(searchVolume, position);
    const potentialTrafficPos1 = calculateTraffic(searchVolume, 1);
    const trafficGain = potentialTrafficPos1 - currentTraffic;
    const trafficGainPercentage = (trafficGain / currentTraffic) * 100;
    const opportunityScore = calculateOpportunityScore(searchVolume, trafficGain, position);

    opportunities.push({
      keyword,
      current_position: position,
      target_url: item.ranked_serp_element.serp_item.url,
      search_volume: searchVolume,
      current_traffic: Math.round(currentTraffic),
      potential_traffic_pos_1: Math.round(potentialTrafficPos1),
      traffic_gain: Math.round(trafficGain),
      traffic_gain_percentage: Math.round(trafficGainPercentage * 10) / 10,
      cpc: item.keyword_data.keyword_info.cpc,
      competition: item.keyword_data.keyword_info.competition,
      keyword_difficulty: item.keyword_properties?.keyword_difficulty,
      ranking_page_title: item.ranked_serp_element.serp_item.title,
      ranking_page_description: item.ranked_serp_element.serp_item.description,
      opportunity_score: Math.round(opportunityScore * 10) / 10,
    });
  }

  // Sort by opportunity score (highest first)
  return opportunities.sort((a, b) => b.opportunity_score - a.opportunity_score);
}

/**
 * Complete flow: Fetch keywords and extract opportunities
 *
 * @param domain - Domain to analyze
 * @param locationCode - DataForSEO location code
 * @param languageCode - Language code
 * @returns Array of opportunities, ready to insert into database
 */
export async function findOpportunities(
  domain: string,
  locationCode: number = 2840,
  languageCode: string = "en"
): Promise<OpportunityData[]> {
  console.log(`[DataForSEO] Fetching ranked keywords for ${domain}...`);

  const rankedKeywords = await fetchRankedKeywords(domain, locationCode, languageCode);

  console.log(`[DataForSEO] Found ${rankedKeywords.length} total ranked keywords`);

  const opportunities = extractOpportunities(rankedKeywords);

  console.log(`[DataForSEO] Identified ${opportunities.length} opportunities (positions 11-20)`);

  return opportunities;
}
