import { requireCurrentUser } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = {
  title: "Settings — Workforce SEO",
};

export default async function SettingsPage() {
  const user = await requireCurrentUser();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your profile and integration settings.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your account details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>
            <span className="text-muted-foreground">Email:</span> {user.email}
          </div>
          {user.profile?.name ? (
            <div>
              <span className="text-muted-foreground">Name:</span> {user.profile.name}
            </div>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Coming next</CardTitle>
          <CardDescription>
            Editable profile, API keys, integration settings, and Google OAuth land in
            slice 4.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
