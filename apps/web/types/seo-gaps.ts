/**
 * SEO Gap Detection Types
 *
 * Identifies missing or suboptimal SEO elements on WordPress pages.
 */

export type SEOGapType =
  | "missing_h1"
  | "missing_meta_title"
  | "missing_meta_description"
  | "short_meta_title"
  | "short_meta_description"
  | "long_meta_title"
  | "long_meta_description"
  | "missing_focus_keyword"
  | "missing_schema"
  | "missing_faq"
  | "missing_alt_text";

export interface SEOGap {
  type: SEOGapType;
  severity: "critical" | "high" | "medium" | "low";
  message: string;
  currentValue?: string;
  expectedRange?: {
    min?: number;
    max?: number;
  };
}

export interface PageSEOAnalysis {
  wp_post_id: number;
  url: string;
  title: string;
  post_type: "post" | "page";
  gaps: SEOGap[];
  content_preview: string;
  current_h1?: string;
  current_meta_title?: string;
  current_meta_description?: string;
  current_focus_keyword?: string;
  current_schema?: string; // JSON string of existing schema
  author?: string;
  date_published?: string;
  date_modified?: string;
}

export interface SEOGapFix {
  gap_type: SEOGapType;
  generated_content: string;
  reasoning: string;
}

export interface SEOGapFixResult {
  wp_post_id: number;
  fixes: SEOGapFix[];
  applied: boolean;
  error?: string;
  // Per-fix outcome from the WP plugin's batch /execute response. Populated
  // when the batch call returned (even on partial failure). Empty/undefined
  // when the batch call itself failed (network, auth, plugin missing).
  results?: SEOGapFixOpResult[];
}

export interface SEOGapFixOpResult {
  gap_type: SEOGapType;
  success: boolean;
  error?: string;
}

export interface AuditLogEntry {
  operation: string;
  // Flat list of field names that changed. Always present — for pre-B3
  // entries it's the only thing the plugin wrote, and for post-B3 entries
  // it's derived from changes[].name as a fast path for UI rendering.
  fields: string[];
  // Captured before/after values, present only on post-B3 entries. Drives
  // the revert button: entries without `changes` are non-revertable and
  // the UI greys out their revert button accordingly.
  changes?: AuditLogChange[];
  timestamp: string;
  source: string;
}

export interface AuditLogChange {
  name: string;
  old: string | null;
  new: string | null;
}
