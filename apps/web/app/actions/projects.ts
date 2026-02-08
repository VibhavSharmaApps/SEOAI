"use server";

/**
 * Server Actions for Projects Management
 */

import { createAdminClient } from "@/lib/supabase";

/**
 * Create a new project
 *
 * @param siteId - Site ID to link the project to
 * @param name - Project name
 * @param wpUrl - WordPress site URL
 * @param dataforseoDomain - Domain for DataForSEO (usually same as wp_url without protocol)
 * @param locationCode - DataForSEO location code (default: 2840 = US)
 * @param languageCode - Language code (default: "en")
 */
export async function createProject(data: {
  siteId: string;
  name: string;
  wpUrl: string;
  dataforseoDomain: string;
  locationCode?: number;
  languageCode?: string;
}) {
  const supabase = createAdminClient();

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      site_id: data.siteId,
      name: data.name,
      wp_url: data.wpUrl,
      dataforseo_domain: data.dataforseoDomain,
      dataforseo_location_code: data.locationCode || 2840,
      dataforseo_language_code: data.languageCode || "en",
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create project: ${error.message}`);
  }

  return project;
}

/**
 * Get all projects for a site
 */
export async function getSiteProjects(siteId: string) {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("site_id", siteId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch projects: ${error.message}`);
  }

  return data;
}

/**
 * Update a project
 */
export async function updateProject(
  projectId: string,
  updates: {
    name?: string;
    wpUrl?: string;
    dataforseoDomain?: string;
    locationCode?: number;
    languageCode?: string;
    isActive?: boolean;
  }
) {
  const supabase = createAdminClient();

  const payload: Record<string, any> = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.wpUrl !== undefined) payload.wp_url = updates.wpUrl;
  if (updates.dataforseoDomain !== undefined)
    payload.dataforseo_domain = updates.dataforseoDomain;
  if (updates.locationCode !== undefined)
    payload.dataforseo_location_code = updates.locationCode;
  if (updates.languageCode !== undefined)
    payload.dataforseo_language_code = updates.languageCode;
  if (updates.isActive !== undefined) payload.is_active = updates.isActive;

  const { error } = await supabase
    .from("projects")
    .update(payload)
    .eq("id", projectId);

  if (error) {
    throw new Error(`Failed to update project: ${error.message}`);
  }

  return { success: true };
}

/**
 * Delete a project
 */
export async function deleteProject(projectId: string) {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId);

  if (error) {
    throw new Error(`Failed to delete project: ${error.message}`);
  }

  return { success: true };
}
