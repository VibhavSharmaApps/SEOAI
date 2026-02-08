import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Workforce SEO - AI-Powered SEO Automation',
  description: 'AI-powered SEO automation platform for WordPress sites',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
