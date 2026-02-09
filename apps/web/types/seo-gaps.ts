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
}
