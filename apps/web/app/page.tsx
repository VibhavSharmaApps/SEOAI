export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <main className="max-w-4xl mx-auto text-center">
        <h1 className="text-4xl font-bold mb-4">
          Workforce SEO
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
          AI-Powered SEO Automation Platform
        </p>
        <div className="flex gap-4 justify-center">
          <a
            href="/dashboard/seo-gaps"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            SEO Gaps Dashboard
          </a>
        </div>
      </main>
    </div>
  );
}
