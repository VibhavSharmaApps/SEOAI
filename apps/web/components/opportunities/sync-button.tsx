"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { syncOpportunitiesForSite } from "@/app/actions/opportunities";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SyncButton({ siteId }: { siteId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      const result = await syncOpportunitiesForSite(siteId);
      if (result.ok) {
        toast.success(`Synced — found ${result.opportunitiesCount} opportunities`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Button onClick={handleClick} disabled={pending}>
      <RefreshCw className={cn("mr-2 h-4 w-4", pending && "animate-spin")} />
      {pending ? "Syncing…" : "Sync opportunities"}
    </Button>
  );
}
