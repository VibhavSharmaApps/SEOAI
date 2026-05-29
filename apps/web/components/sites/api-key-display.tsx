"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ApiKeyDisplay({ apiKey }: { apiKey: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable (insecure context). Silently fail; the
      // value is still visible in the input for manual copy.
    }
  }

  return (
    <div className="flex gap-2">
      <Input value={apiKey} readOnly className="font-mono text-xs" onFocus={(e) => e.target.select()} />
      <Button type="button" variant="outline" size="icon" onClick={handleCopy} aria-label="Copy API key">
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
}
