"use client";

import { useTransition } from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { refreshSitePages } from "@/app/actions/pages";
import { Button } from "@/components/ui/button";

interface RefreshPagesButtonProps {
  siteId: string;
}

/**
 * Triggers a fresh sync of the site's pages from WordPress into the
 * Supabase cache. Lives next to the page count on the pages browser
 * header so the user can pull updates after editing posts in WP admin
 * (until Wave B's webhook sync makes this automatic).
 *
 * The server action calls revalidatePath on success so the table
 * re-renders with the new data without a manual reload.
 */
export function RefreshPagesButton({ siteId }: RefreshPagesButtonProps) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await refreshSitePages(siteId);
      if (result.ok) {
        const noun = result.synced === 1 ? "page" : "pages";
        toast.success(`Synced ${result.synced} ${noun} from WordPress.`);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Button onClick={handleClick} disabled={pending} variant="outline" size="sm">
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Syncing…
        </>
      ) : (
        <>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh from WP
        </>
      )}
    </Button>
  );
}
