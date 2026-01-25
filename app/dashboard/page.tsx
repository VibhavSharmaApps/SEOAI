import { WordPressDashboard } from "@/components/wordpress-dashboard"

export default async function DashboardPage() {
  return (
    <main className="flex min-h-screen flex-col p-24">
      <div className="z-10 max-w-7xl w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Dashboard</h1>
        </div>

        {/* WordPress MVP Testing Console */}
        <WordPressDashboard />
      </div>
    </main>
  )
}

