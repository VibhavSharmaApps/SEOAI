import { requireCurrentUser } from "@/lib/auth";
import { ConnectWizard } from "@/components/sites/connect-wizard";

export const metadata = {
  title: "Connect a site — Workforce SEO",
};

export default async function NewSitePage() {
  await requireCurrentUser();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Connect a WordPress site</h1>
        <p className="text-sm text-muted-foreground">
          Two-step setup: add the site here, then paste the API key into your WordPress admin.
        </p>
      </div>
      <ConnectWizard />
    </div>
  );
}
