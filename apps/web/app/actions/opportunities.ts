"use server";

/**
 * Server Actions for Opportunities System
 *
 * Syncs ranked keywords from DataForSEO and manages opportunities.
 */

import { createAdminClient } from "@/lib/supabase";
import { findOpportunities, type OpportunityData } from "@/lib/dataforseo";

/**
 * Sync opportunities for a project
 *
 * Fetches ranked keywords from DataForSEO, identifies positions 11-20,
 * and inserts/updates opportunities in the database.
 *
 * @param projectId - Project ID to sync
 * @returns Number of opportunities synced
 */
export async function syncProjectOpportunities(projectId: string): Promise<{
  success: boolean;
  opportunitiesCount?: number;
  error?: string;
}> {
  try {
    const supabase = createAdminClient();

    // Get project details
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("dataforseo_domain, dataforseo_location_code, dataforseo_language_code")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return { success: false, error: "Project not found" };
    }

    // Fetch opportunities from DataForSEO
    const opportunities = await findOpportunities(
      project.dataforseo_domain,
      project.dataforseo_location_code || 2840,
      project.dataforseo_language_code || "en"
    );

    if (opportunities.length === 0) {
      return { success: true, opportunitiesCount: 0 };
    }

    // Prepare opportunity records for upsert
    const records = opportunities.map((opp) => ({
      project_id: projectId,
      keyword: opp.keyword,
      current_position: opp.current_position,
      target_url: opp.target_url,
      search_volume: opp.search_volume,
      current_traffic: opp.current_traffic,
      potential_traffic_pos_1: opp.potential_traffic_pos_1,
      traffic_gain: opp.traffic_gain,
      traffic_gain_percentage: opp.traffic_gain_percentage,
      cpc: opp.cpc,
      competition: opp.competition,
      keyword_difficulty: opp.keyword_difficulty,
      ranking_page_title: opp.ranking_page_title,
      ranking_page_description: opp.ranking_page_description,
      opportunity_score: opp.opportunity_score,
      priority: assignPriorityFromScore(opp.opportunity_score),
      last_checked_at: new Date().toISOString(),
    }));

    // Upsert opportunities (insert or update if keyword already exists)
    const { error: upsertError } = await supabase
      .from("opportunities")
      .upsert(records, {
        onConflict: "project_id,keyword",
        ignoreDuplicates: false,
      });

    if (upsertError) {
      console.error("[Opportunities] Upsert error:", upsertError);
      return { success: false, error: upsertError.message };
    }

    // Update project last_synced_at
    await supabase
      .from("projects")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", projectId);

    return {
      success: true,
      opportunitiesCount: opportunities.length,
    };
  } catch (error) {
    console.error("[Opportunities] Sync error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get opportunities for a project
 *
 * @param projectId - Project ID
 * @param filters - Optional filters (status, priority, minScore)
 * @returns Array of opportunities
 */
export async function getProjectOpportunities(
  projectId: string,
  filters?: {
    status?: string;
    priority?: string;
    minScore?: number;
    limit?: number;
  }
) {
  const supabase = createAdminClient();

  let query = supabase
    .from("opportunities")
    .select("*")
    .eq("project_id", projectId)
    .order("opportunity_score", { ascending: false });

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  if (filters?.priority) {
    query = query.eq("priority", filters.priority);
  }

  if (filters?.minScore) {
    query = query.gte("opportunity_score", filters.minScore);
  }

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch opportunities: ${error.message}`);
  }

  return data;
}

/**
 * Update opportunity status
 *
 * @param opportunityId - Opportunity ID
 * @param status - New status
 * @param notes - Optional notes
 */
export async function updateOpportunityStatus(
  opportunityId: string,
  status: "pending" | "in_progress" | "completed" | "dismissed",
  notes?: string
) {
  const supabase = createAdminClient();

  const updates: Record<string, any> = {
    status,
    ...(notes && { notes }),
    ...(status === "completed" && { completed_at: new Date().toISOString() }),
  };

  const { error } = await supabase
    .from("opportunities")
    .update(updates)
    .eq("id", opportunityId);

  if (error) {
    throw new Error(`Failed to update opportunity: ${error.message}`);
  }

  return { success: true };
}

/**
 * Record an action taken on an opportunity
 *
 * @param opportunityId - Opportunity ID
 * @param actionType - Type of action taken
 * @param description - Action description
 * @param executedBy - User or system
 * @param metadata - Additional data
 */
export async function recordOpportunityAction(
  opportunityId: string,
  actionType: "content_update" | "meta_optimization" | "schema_added" | "internal_links" | "backlinks" | "other",
  description: string,
  executedBy: string = "system",
  metadata?: Record<string, any>
) {
  const supabase = createAdminClient();

  const { error } = await supabase.from("opportunity_actions").insert({
    opportunity_id: opportunityId,
    action_type: actionType,
    description,
    executed_by: executedBy,
    metadata: metadata || null,
  });

  if (error) {
    throw new Error(`Failed to record action: ${error.message}`);
  }

  return { success: true };
}

/**
 * Helper: Assign priority based on opportunity score
 */
function assignPriorityFromScore(score: number): "low" | "medium" | "high" | "critical" {
  if (score >= 100) return "critical";
  if (score >= 50) return "high";
  if (score >= 20) return "medium";
  return "low";
}

/**
 * Get opportunity statistics for a project
 */
export async function getProjectOpportunityStats(projectId: string) {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("opportunities")
    .select("status, priority, traffic_gain, opportunity_score")
    .eq("project_id", projectId);

  if (error) {
    throw new Error(`Failed to fetch stats: ${error.message}`);
  }

  const stats = {
    total: data.length,
    byStatus: {
      pending: data.filter((o) => o.status === "pending").length,
      in_progress: data.filter((o) => o.status === "in_progress").length,
      completed: data.filter((o) => o.status === "completed").length,
      dismissed: data.filter((o) => o.status === "dismissed").length,
    },
    byPriority: {
      critical: data.filter((o) => o.priority === "critical").length,
      high: data.filter((o) => o.priority === "high").length,
      medium: data.filter((o) => o.priority === "medium").length,
      low: data.filter((o) => o.priority === "low").length,
    },
    totalTrafficGain: data.reduce((sum, o) => sum + (o.traffic_gain || 0), 0),
    avgOpportunityScore: data.length > 0
      ? data.reduce((sum, o) => sum + (o.opportunity_score || 0), 0) / data.length
      : 0,
  };

  return stats;
}
