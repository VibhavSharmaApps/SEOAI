"use client";

import { useTransition } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { applyPageFixes } from "@/app/actions/seo-gaps";
import { Button } from "@/components/ui/button";

interface ApplyFixesButtonProps {
  siteId: string;
  postId: number;
  fixCount: number;
  // When provided, restricts the apply to only these gap types. Used by
  // FixesList to filter out user-deselected fixes. When omitted/empty,
  // every detected gap gets applied (back-compat with callers that don't
  // surface per-fix selection).
  selectedGapTypes?: string[];
}

/**
 * Button that runs the analyze → generate → apply pipeline against the
 * connected WordPress site for a specific post. Lives inside the SEO Gaps
 * dashboard's "Generated Fixes" card.
 *
 * Marked destructive because it modifies the user's published content.
 * A confirm() dialog gates the action — the WP plugin's audit log handles
 * traceability, but there's no auto-undo, so a deliberate click is the
 * right friction.
 *
 * After a successful apply, the server action calls revalidatePath() on
 * the dashboard route, so the gap count automatically drops on next render.
 */
export function ApplyFixesButton({
  siteId,
  postId,
  fixCount,
  selectedGapTypes,
}: ApplyFixesButtonProps) {
  const [pending, startTransition] = useTransition();

  function handleApply() {
    if (fixCount === 0) {
      // Defensive — the button is also disabled in this state, but a quick
      // toast tells the user why nothing happened if they get here anyway.
      toast.info("No fixes selected — tick at least one to apply.");
      return;
    }

    const noun = fixCount === 1 ? "fix" : "fixes";
    const confirmed = window.confirm(
      `Apply ${fixCount} ${noun} to this WordPress page?\n\n` +
        "This will modify the post's meta tags, H1, focus keyword, and/or schema. " +
        "Each change is logged to the post's audit trail in WordPress."
    );
    if (!confirmed) return;

    startTransition(async () => {
      const result = await applyPageFixes(siteId, postId, selectedGapTypes);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      // Partial failure — surface the per-fix outcome so the user can see
      // which specific fixes landed and which need attention (e.g. the WP
      // post may have been deleted between analyse and apply).
      const failed = result.results.filter((r) => !r.success);
      if (failed.length > 0) {
        const failedList = failed.map((r) => r.gap_type).join(", ");
        const appliedNoun = result.applied === 1 ? "fix" : "fixes";
        toast.warning(
          `Applied ${result.applied} ${appliedNoun}. ${failed.length} failed: ${failedList}`,
          { duration: 8000 }
        );
        return;
      }

      // Full success path.
      if (result.applied === 0) {
        toast.success("Nothing to apply — page is already optimised.");
      } else {
        const appliedNoun = result.applied === 1 ? "fix" : "fixes";
        toast.success(`Applied ${result.applied} ${appliedNoun} to WordPress.`);
      }
    });
  }

  return (
    <Button onClick={handleApply} disabled={pending || fixCount === 0} size="sm">
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Applying…
        </>
      ) : (
        <>
          <Sparkles className="mr-2 h-4 w-4" />
          Apply {fixCount} {fixCount === 1 ? "fix" : "fixes"}
        </>
      )}
    </Button>
  );
}
