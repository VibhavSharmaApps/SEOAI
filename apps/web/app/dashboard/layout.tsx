import { requireCurrentUser } from "@/lib/auth";
import { Sidebar } from "@/components/dashboard/sidebar";
import { UserMenu } from "@/components/dashboard/user-menu";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireCurrentUser();

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex h-14 items-center justify-between border-b px-4 sm:px-6">
          <div className="md:hidden text-sm font-semibold">Workforce SEO</div>
          <div className="flex-1" />
          <UserMenu email={user.email} name={user.profile?.name ?? null} />
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
