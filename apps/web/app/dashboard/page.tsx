import Link from "next/link";
import { Plus } from "lucide-react";
import { requireCurrentUser } from "@/lib/auth";
import { listSites } from "@/app/actions/sites";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SiteCard } from "@/components/dashboard/site-card";

export const metadata = {
  title: "Dashboard — Workforce SEO",
};

export default async function DashboardOverview() {
  const user = await requireCurrentUser();
  const sites = await listSites();
  const displayName = user.profile?.name ?? user.email;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome, {displayName}</h1>
          <p className="text-sm text-muted-foreground">
            {sites.length === 0
              ? "Connect your first WordPress site to start finding SEO opportunities."
              : `Managing ${sites.length} site${sites.length === 1 ? "" : "s"}.`}
          </p>
        </div>
        {sites.length > 0 ? (
          <Button asChild>
            <Link href="/dashboard/sites/new">
              <Plus className="mr-2 h-4 w-4" />
              Add site
            </Link>
          </Button>
        ) : null}
      </div>

      {sites.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No sites connected yet</CardTitle>
            <CardDescription>
              Connect a WordPress site to scan for SEO gaps and track ranking opportunities.
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
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sites.map((site) => (
            <SiteCard key={site.id} site={site} />
          ))}
        </div>
      )}
    </div>
  );
}
