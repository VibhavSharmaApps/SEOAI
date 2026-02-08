import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md mx-auto text-center">
        <h2 className="text-2xl font-bold mb-4">Page Not Found</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Could not find the requested resource
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}
