"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { setOpportunityStatus } from "@/app/actions/opportunities";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Opportunity, OpportunityStatus, OpportunityPriority } from "@/types/database";
import type { OpportunitySortField } from "@/app/actions/opportunities";

const SORTABLE: { field: OpportunitySortField; label: string; align?: "right" }[] = [
  { field: "keyword", label: "Keyword" },
  { field: "current_position", label: "Position", align: "right" },
  { field: "search_volume", label: "Volume", align: "right" },
  { field: "opportunity_score", label: "Score", align: "right" },
  { field: "traffic_gain", label: "Traffic gain", align: "right" },
];

function statusVariant(s: OpportunityStatus) {
  switch (s) {
    case "pending":
      return "outline" as const;
    case "in_progress":
      return "default" as const;
    case "completed":
      return "secondary" as const;
    case "dismissed":
      return "muted" as const;
  }
}

function priorityVariant(p: OpportunityPriority) {
  switch (p) {
    case "critical":
      return "destructive" as const;
    case "high":
      return "default" as const;
    case "medium":
      return "secondary" as const;
    case "low":
      return "outline" as const;
  }
}

const STATUS_LABEL: Record<OpportunityStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  completed: "Completed",
  dismissed: "Dismissed",
};

export function OpportunitiesTable({ opportunities }: { opportunities: Opportunity[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const currentSort = (searchParams.get("sort") ?? "opportunity_score") as OpportunitySortField;
  const currentDir = (searchParams.get("dir") ?? "desc") as "asc" | "desc";

  function toggleSort(field: OpportunitySortField) {
    const params = new URLSearchParams(searchParams);
    if (field === currentSort) {
      params.set("dir", currentDir === "asc" ? "desc" : "asc");
    } else {
      params.set("sort", field);
      params.set("dir", "desc");
    }
    router.replace(`${pathname}?${params.toString()}`);
  }

  function updateStatus(opportunityId: string, status: OpportunityStatus) {
    startTransition(async () => {
      const result = await setOpportunityStatus(opportunityId, status);
      if (result.ok) {
        toast.success(`Marked as ${STATUS_LABEL[status].toLowerCase()}`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function sortIcon(field: OpportunitySortField) {
    if (field !== currentSort) return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-50" />;
    return currentDir === "asc" ? (
      <ArrowUp className="ml-1 inline h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 inline h-3 w-3" />
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {SORTABLE.map((col) => (
              <TableHead
                key={col.field}
                className={cn("cursor-pointer select-none", col.align === "right" && "text-right")}
                onClick={() => toggleSort(col.field)}
              >
                {col.label}
                {sortIcon(col.field)}
              </TableHead>
            ))}
            <TableHead>Priority</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-8" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {opportunities.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="h-24 text-center text-muted-foreground text-sm">
                No opportunities match the current filters.
              </TableCell>
            </TableRow>
          ) : (
            opportunities.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-medium max-w-xs truncate" title={o.keyword}>
                  {o.keyword}
                </TableCell>
                <TableCell className="text-right tabular-nums">{o.current_position}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {o.search_volume.toLocaleString()}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {o.opportunity_score.toFixed(1)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  +{o.traffic_gain.toFixed(0)}
                  <span className="text-xs text-muted-foreground"> /mo</span>
                </TableCell>
                <TableCell>
                  <Badge variant={priorityVariant(o.priority)}>{o.priority}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(o.status)}>{STATUS_LABEL[o.status]}</Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" disabled={pending}>
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Status</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => updateStatus(o.id, "pending")}>
                        Mark as pending
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updateStatus(o.id, "in_progress")}>
                        Mark as in progress
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updateStatus(o.id, "completed")}>
                        Mark as completed
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updateStatus(o.id, "dismissed")}>
                        Dismiss
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
