import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = {
  title: "SEO Audit — Workforce SEO",
};

export default function AuditPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">SEO Audit</h1>
        <p className="text-sm text-muted-foreground">
          Detect missing meta tags, headings, and schema, then let AI fix them.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Coming next</CardTitle>
          <CardDescription>
            The real audit page (pulling live data from your WordPress site) lands once
            site-connection is wired up. In the meantime you can poke at the existing
            sandbox demo to see the SEO-gap flow.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/dashboard/seo-gaps"
            className="text-sm font-medium text-primary hover:underline"
          >
            View SEO gaps sandbox →
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
