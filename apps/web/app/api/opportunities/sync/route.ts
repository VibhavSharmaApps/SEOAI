/**
 * API Route: Sync opportunities for a project
 *
 * This can be called manually or via cron job to keep opportunities fresh.
 *
 * POST /api/opportunities/sync
 * Body: { projectId: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { syncProjectOpportunities } from "@/app/actions/opportunities";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    const result = await syncProjectOpportunities(projectId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${result.opportunitiesCount} opportunities`,
      opportunitiesCount: result.opportunitiesCount,
    });
  } catch (error) {
    console.error("[API] Sync opportunities error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
