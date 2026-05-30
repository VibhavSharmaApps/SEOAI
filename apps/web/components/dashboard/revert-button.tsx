"use client";

import { useTransition } from "react";
import { Undo2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { revertPageEdit } from "@/app/actions/seo-gaps";
import { Button } from "@/components/ui/button";

interface RevertButtonProps {
  siteId: string;
  postId: number;
  // The entry's position in the PLUGIN's storage order (oldest-first).
  // The audit history card displays entries newest-first, so the parent
  // is responsible for translating its display index back to the
  // plugin-side index before passing it in. See the dashboard page for
  // the calculation.
  entryIndex: number;
  // Whether this entry has post-B3 'changes' captured. Pre-B3 entries
  // are non-revertable — rendered as a disabled button + tooltip.
  revertable: boolean;
}

/**
 * Per-entry undo button shown in the Change History card. Confirms
 * before reverting because the action modifies live WordPress content
 * (the plugin captures a fresh audit entry for the revert itself, so
 * it's traceable, but there's no auto-redo).
 */
export function RevertButton({
  siteId,
  postId,
  entryIndex,
  revertable,
}: RevertButtonProps) {
  const [pending, startTransition] = useTransition();

  if (!revertable) {
    return (
      <Button
        size="sm"
        variant="ghost"
        disabled
        title="This entry was logged before the undo refactor and can't be reverted."
      >
        <Undo2 className="mr-1 h-3 w-3" />
        Revert
      </Button>
    );
  }

  function handleClick() {
    const confirmed = window.confirm(
      "Revert this change?\n\n" +
        "This will write the previous values back to WordPress. The revert " +
        "itself is logged as a new audit entry, so you can see what happened."
    );
    if (!confirmed) return;

    startTransition(async () => {
      const result = await revertPageEdit(siteId, postId, entryIndex);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      // Partial revert: some changes (content/title/etc.) couldn't be
      // reverted because the prior value wasn't captured. Surface as a
      // warning so the user knows the entry isn't fully rolled back.
      if (result.skipped.length > 0) {
        const skippedList = result.skipped.join(", ");
        toast.warning(
          `Reverted ${result.reverted.length}. Skipped: ${skippedList}`,
          { duration: 7000 }
        );
        return;
      }

      const noun = result.reverted.length === 1 ? "change" : "changes";
      toast.success(`Reverted ${result.reverted.length} ${noun}.`);
    });
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={handleClick}
      disabled={pending}
    >
      {pending ? (
        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
      ) : (
        <Undo2 className="mr-1 h-3 w-3" />
      )}
      Revert
    </Button>
  );
}
