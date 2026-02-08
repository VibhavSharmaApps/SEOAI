/**
 * Database types for Workforce SEO
 *
 * These types match the Supabase schema.
 * Generate actual types with: supabase gen types typescript
 */

export type SiteType = "WORDPRESS";

export type ContentStatus = "DRAFT" | "PUBLISHED" | "SCHEDULED";

export type AutopilotRunStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export type PageType = "POST" | "PAGE";

export type ChangeIntentType = "UPDATE_META" | "ADD_INTERNAL_LINK" | "INJECT_SCHEMA";

export type ChangeIntentStatus = "PENDING" | "APPLIED" | "FAILED" | "ROLLED_BACK";

export type OpportunityStatus = "pending" | "in_progress" | "completed" | "dismissed";

export type OpportunityPriority = "low" | "medium" | "high" | "critical";

export type OpportunityActionType =
  | "content_update"
  | "meta_optimization"
  | "schema_added"
  | "internal_links"
  | "backlinks"
  | "other";

// Core Tables

export interface User {
  id: string;
  auth_id: string;
  email: string;
  name: string | null;
  created_at: string;
  updated_at: string;
}

export interface Site {
  id: string;
  user_id: string | null;
  type: SiteType;
  domain: string;
  wp_site_url: string;
  wp_rest_url: string | null;
  api_key: string | null;
  google_oauth_token: string | null;
  google_oauth_refresh_token: string | null;
  name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  site_id: string;
  name: string;
  wp_url: string;
  dataforseo_domain: string;
  dataforseo_location_code: number;
  dataforseo_language_code: string;
  is_active: boolean;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Opportunity {
  id: string;
  project_id: string;
  keyword: string;
  current_position: number;
  target_url: string;
  search_volume: number;
  current_traffic: number;
  potential_traffic_pos_1: number;
  traffic_gain: number;
  traffic_gain_percentage: number;
  cpc: number | null;
  competition: number | null;
  keyword_difficulty: number | null;
  ranking_page_title: string | null;
  ranking_page_description: string | null;
  opportunity_score: number;
  priority: OpportunityPriority;
  status: OpportunityStatus;
  notes: string | null;
  discovered_at: string;
  last_checked_at: string;
  completed_at: string | null;
}

export interface OpportunityAction {
  id: string;
  opportunity_id: string;
  action_type: OpportunityActionType;
  description: string;
  executed_at: string;
  executed_by: string | null;
  metadata: Record<string, any> | null;
}

export interface OpportunityPositionHistory {
  id: string;
  opportunity_id: string;
  position: number;
  search_volume: number;
  traffic: number;
  checked_at: string;
}

export interface Page {
  id: string;
  site_id: string;
  wp_post_id: number;
  type: PageType;
  title: string;
  url: string;
  last_updated: string;
  tracking_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Keyword {
  id: string;
  site_id: string;
  keyword: string;
  target_url: string | null;
  current_ranking: number | null;
  source: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContentVersion {
  id: string;
  page_id: string;
  version: number;
  content: string;
  reason: string;
  published_at: string | null;
  created_at: string;
}

export interface ChangeIntent {
  id: string;
  site_id: string;
  page_id: string;
  intent_type: ChangeIntentType;
  payload: Record<string, any>;
  status: ChangeIntentStatus;
  created_at: string;
  applied_at: string | null;
}
