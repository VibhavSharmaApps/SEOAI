"use client";

import { useState } from "react";
import { ApplyFixesButton } from "./apply-fixes-button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { SEOGapFix } from "@/types/seo-gaps";

interface FixesListProps {
  fixes: SEOGapFix[];
  // siteId/postId/canApply are only meaningful when we're viewing a real
  // connected page (source === "live" in the parent). In demo mode they're
  // omitted/false and we still render the fixes but hide the apply button.
  siteId?: string;
  postId?: number;
  canApply: boolean;
}

/**
 * Client-side wrapper around the AI-generated fixes list. Holds per-fix
 * selection state (default = all selected) so the user can untick fixes
 * they don't want before clicking Apply. The selected gap_types are passed
 * to ApplyFixesButton, which forwards them to the server action as a
 * filter — only selected fixes get generated and applied.
 *
 * Unchecking a fix dims its card to make the visual state obvious.
 *
 * NOTE: re-generating only the selected fixes server-side is wasteful
 * (we already generated all of them at page render). Threading the
 * already-generated content through to apply would eliminate the re-gen
 * cost but requires shipping fix content through a server action — parked
 * as a follow-up optimization.
 */
export function FixesList({ fixes, siteId, postId, canApply }: FixesListProps) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(fixes.map((f) => f.gap_type))
  );

  function toggle(gapType: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(gapType)) next.delete(gapType);
      else next.add(gapType);
      return next;
    });
  }

  const selectedCount = selected.size;
  const selectedTypes = Array.from(selected);

  return (
    <div className="bg-card border rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4 gap-4">
        <h2 className="text-2xl font-semibold">
          AI-Generated Fixes ({fixes.length})
          {selectedCount < fixes.length && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              — {selectedCount} selected
            </span>
          )}
        </h2>
        {canApply && siteId && postId !== undefined ? (
          <ApplyFixesButton
            siteId={siteId}
            postId={postId}
            selectedGapTypes={selectedTypes}
            fixCount={selectedCount}
          />
        ) : null}
      </div>

      <div className="space-y-4">
        {fixes.map((fix, idx) => {
          const checked = selected.has(fix.gap_type);
          const id = `fix-${idx}`;
          return (
            <div
              key={idx}
              className={cn(
                "border rounded p-4 transition-opacity",
                !checked && "opacity-50"
              )}
            >
              <div className="flex items-start gap-3">
                <div className="pt-1">
                  <Checkbox
                    id={id}
                    checked={checked}
                    onCheckedChange={() => toggle(fix.gap_type)}
                    aria-label={`Toggle ${fix.gap_type.replace(/_/g, " ")}`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <label htmlFor={id} className="font-semibold text-lg cursor-pointer">
                      {fix.gap_type.replace(/_/g, " ").toUpperCase()}
                    </label>
                    <code className="text-xs bg-green-100 dark:bg-green-900 px-2 py-1 rounded shrink-0">
                      AI Generated
                    </code>
                  </div>
                  <div className="bg-muted p-3 rounded mb-2 font-mono text-sm overflow-x-auto">
                    <pre className="whitespace-pre-wrap break-words">
                      {fix.generated_content}
                    </pre>
                  </div>
                  <p className="text-sm text-muted-foreground italic">{fix.reasoning}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
