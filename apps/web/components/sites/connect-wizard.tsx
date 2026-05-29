"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { toast } from "sonner";
import { createSite, verifySiteConnection, type ActionResult } from "@/app/actions/sites";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ApiKeyDisplay } from "./api-key-display";
import type { Site } from "@/types/database";

function CreateSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creating…" : "Create site"}
    </Button>
  );
}

export function ConnectWizard() {
  const router = useRouter();
  const [site, setSite] = useState<Site | null>(null);
  const [verifying, startVerify] = useTransition();
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const [createState, createAction] = useFormState<ActionResult<Site> | null, FormData>(
    async (_prev, formData) => {
      const result = await createSite(_prev, formData);
      if (result.ok) setSite(result.data);
      return result;
    },
    null
  );

  function handleVerify() {
    if (!site) return;
    setVerifyError(null);
    startVerify(async () => {
      const result = await verifySiteConnection(site.id);
      if (result.ok) {
        toast.success(`Connected to ${result.data.site_name}`);
        router.push("/dashboard");
        router.refresh();
      } else {
        setVerifyError(result.error);
      }
    });
  }

  if (!site) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Connect a WordPress site</CardTitle>
          <CardDescription>
            Tell us about your site. We&apos;ll generate an API key and walk you through
            installing the plugin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Site name</Label>
              <Input id="name" name="name" placeholder="My Coffee Blog" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wp_site_url">WordPress URL</Label>
              <Input
                id="wp_site_url"
                name="wp_site_url"
                type="url"
                placeholder="https://example.com"
                required
              />
            </div>
            {createState && !createState.ok ? (
              <p className="text-sm text-destructive">{createState.error}</p>
            ) : null}
            <CreateSubmitButton />
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Install the plugin and verify</CardTitle>
        <CardDescription>
          Site <strong>{site.name}</strong> is saved. Now connect it to WordPress.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Your API key</Label>
          <ApiKeyDisplay apiKey={site.api_key ?? ""} />
          <p className="text-xs text-muted-foreground">
            This key is shown only once here. You can copy it again from the dashboard.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Steps</p>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Install and activate the Workforce SEO plugin on your WordPress site.</li>
            <li>
              In WP admin → Workforce SEO → Settings, paste this API key and click Save.
            </li>
            <li>Come back here and click Verify connection.</li>
          </ol>
        </div>

        {verifyError ? (
          <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            {verifyError}
          </div>
        ) : null}

        <div className="flex gap-2">
          <Button type="button" onClick={handleVerify} disabled={verifying}>
            {verifying ? "Verifying…" : "Verify connection"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push("/dashboard")}>
            Finish later
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
