"use client";

import Link from "next/link";
import { useTransition } from "react";
import {
  MoreHorizontal,
  ExternalLink,
  ShieldCheck,
  Trash2,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { verifySiteConnection, deleteSite } from "@/app/actions/sites";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Site } from "@/types/database";

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        active
          ? "bg-primary/10 text-primary"
          : "bg-muted text-muted-foreground"
      )}
    >
      {active ? "Active" : "Not verified"}
    </span>
  );
}

export function SiteCard({ site }: { site: Site }) {
  const [pending, startTransition] = useTransition();

  function handleVerify() {
    startTransition(async () => {
      const result = await verifySiteConnection(site.id);
      if (result.ok) {
        toast.success(`Verified — running WordPress ${result.data.wp_version}`);
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleDelete() {
    if (!confirm(`Delete ${site.name ?? site.domain}? This cannot be undone.`)) {
      return;
    }
    startTransition(async () => {
      const result = await deleteSite(site.id);
      if (result.ok) {
        toast.success("Site removed");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="space-y-1 min-w-0">
          <CardTitle className="text-base truncate">{site.name ?? site.domain}</CardTitle>
          <a
            href={site.wp_site_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground truncate max-w-full"
          >
            {site.domain}
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2" disabled={pending}>
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Site actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              {/* Browse pages is a navigation item, not a state-changing action,
                  so it goes at the top of the menu where it's most discoverable.
                  Always rendered — if the site isn't verified yet, the target
                  page surfaces the relevant error. */}
              <Link href={`/dashboard/sites/${site.id}/pages`}>
                <FileText className="mr-2 h-4 w-4" />
                Browse pages
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleVerify}>
              <ShieldCheck className="mr-2 h-4 w-4" />
              Verify connection
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete site
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="flex items-center justify-between pt-0">
        <StatusBadge active={site.is_active} />
        <span className="text-xs text-muted-foreground">
          Added {new Date(site.created_at).toLocaleDateString()}
        </span>
      </CardContent>
    </Card>
  );
}
