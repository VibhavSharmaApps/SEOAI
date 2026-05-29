import Link from "next/link";
import { Plus } from "lucide-react";
import { requireCurrentUser } from "@/lib/auth";
import { listSites } from "@/app/actions/sites";
import {
  listOpportunitiesForCurrentUser,
  type OpportunitySortField,
} from "@/app/actions/opportunities";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OpportunitiesFilters } from "@/components/opportunities/opportunities-filters";
import { OpportunitiesTable } from "@/components/opportunities/opportunities-table";
import { SyncButton } from "@/components/opportunities/sync-button";
import type { OpportunityStatus, OpportunityPriority } from "@/types/database";

export const metadata = {
  title: "Opportunities — Workforce SEO",
};

const SORT_FIELDS = new Set<OpportunitySortField>([
  "opportunity_score",
  "search_volume",
  "current_position",
  "traffic_gain",
  "keyword",
]);
const STATUSES = new Set<OpportunityStatus>(["pending", "in_progress", "completed", "dismissed"]);
const PRIORITIES = new Set<OpportunityPriority>(["low", "medium", "high", "critical"]);

interface SearchParams {
  site?: string;
  status?: string;
  priority?: string;
  q?: string;
  sort?: string;
  dir?: string;
}

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireCurrentUser();
  const sites = await listSites();

  if (sites.length === 0) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Opportunities</h1>
          <p className="text-sm text-muted-foreground">
            Keywords ranking on page 2 that could move to page 1.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>No site connected</CardTitle>
            <CardDescription>
              Connect a WordPress site first — we&apos;ll pull ranked keywords and surface the
              ones close to page 1.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/dashboard/sites/new">
                <Plus className="mr-2 h-4 w-4" />
                Connect WordPress site
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const requestedSiteId = searchParams.site;
  const currentSite = sites.find((s) => s.id === requestedSiteId) ?? sites[0];

  const status = searchParams.status && STATUSES.has(searchParams.status as OpportunityStatus)
    ? (searchParams.status as OpportunityStatus)
    : undefined;
  const priority =
    searchParams.priority && PRIORITIES.has(searchParams.priority as OpportunityPriority)
      ? (searchParams.priority as OpportunityPriority)
      : undefined;
  const keyword = searchParams.q?.trim() || undefined;
  const sortField =
    searchParams.sort && SORT_FIELDS.has(searchParams.sort as OpportunitySortField)
      ? (searchParams.sort as OpportunitySortField)
      : "opportunity_score";
  const direction = searchParams.dir === "asc" ? "asc" : "desc";

  const opportunities = await listOpportunitiesForCurrentUser({
    siteId: currentSite.id,
    filters: { status, priority, keyword },
    sort: { field: sortField, direction },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Opportunities</h1>
          <p className="text-sm text-muted-foreground">
            {opportunities.length === 0
              ? `No opportunities yet for ${currentSite.name ?? currentSite.domain}. Run a sync to pull from DataForSEO.`
              : `${opportunities.length} opportunit${opportunities.length === 1 ? "y" : "ies"} for ${currentSite.name ?? currentSite.domain}.`}
          </p>
        </div>
        <SyncButton siteId={currentSite.id} />
      </div>

      <OpportunitiesFilters sites={sites} currentSiteId={currentSite.id} />
      <OpportunitiesTable opportunities={opportunities} />
    </div>
  );
}
