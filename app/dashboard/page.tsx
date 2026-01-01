import { auth } from "@clerk/nextjs/server"
import { UserButton } from "@clerk/nextjs"
import { redirect } from "next/navigation"

export default async function DashboardPage() {
  const { userId } = await auth()

  // Redirect to login if not authenticated
  // This is a backup check since middleware should handle it
  if (!userId) {
    redirect("/login")
  }

  return (
    <main className="flex min-h-screen flex-col p-24">
      <div className="z-10 max-w-7xl w-full">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <UserButton afterSignOutUrl="/login" />
        </div>
        <div className="bg-card p-8 rounded-lg border">
          <p className="text-muted-foreground mb-4">
            Welcome to your dashboard! You are successfully authenticated.
          </p>
          <p className="text-sm text-muted-foreground">
            User ID: {userId}
          </p>
        </div>
      </div>
    </main>
  )
}

