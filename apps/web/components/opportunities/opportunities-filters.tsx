"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Site } from "@/types/database";
import type { OpportunityStatus, OpportunityPriority } from "@/types/database";

const STATUSES: { value: OpportunityStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "dismissed", label: "Dismissed" },
];

const PRIORITIES: { value: OpportunityPriority | "all"; label: string }[] = [
  { value: "all", label: "All priorities" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

interface OpportunitiesFiltersProps {
  sites: Site[];
  currentSiteId: string;
}

export function OpportunitiesFilters({ sites, currentSiteId }: OpportunitiesFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const status = searchParams.get("status") ?? "all";
  const priority = searchParams.get("priority") ?? "all";
  const keyword = searchParams.get("q") ?? "";

  const updateParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams);
      if (value && value !== "all" && value !== "") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.replace(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  function clearAll() {
    const params = new URLSearchParams();
    if (currentSiteId) params.set("site", currentSiteId);
    router.replace(`${pathname}?${params.toString()}`);
  }

  const hasFilters =
    status !== "all" || priority !== "all" || keyword !== "" || searchParams.get("sort");

  return (
    <div className="flex flex-wrap items-end gap-3">
      {sites.length > 1 ? (
        <div className="w-48">
          <Select value={currentSiteId} onValueChange={(v) => updateParam("site", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Site" />
            </SelectTrigger>
            <SelectContent>
              {sites.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name ?? s.domain}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="w-44">
        <Select value={status} onValueChange={(v) => updateParam("status", v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="w-44">
        <Select value={priority} onValueChange={(v) => updateParam("priority", v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRIORITIES.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="w-56">
        <Input
          placeholder="Search keyword…"
          defaultValue={keyword}
          onBlur={(e) => updateParam("q", e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") updateParam("q", (e.target as HTMLInputElement).value);
          }}
        />
      </div>

      {hasFilters ? (
        <Button variant="ghost" size="sm" onClick={clearAll}>
          Clear filters
        </Button>
      ) : null}
    </div>
  );
}
