# Workforce SEO Platform

AI-powered SEO automation platform for WordPress sites with comprehensive SEO gap analysis and opportunity tracking.

## 🚀 Quick Start

### Prerequisites

- Node.js 18.17.0 or higher
- pnpm 9.0.0 or higher
- Supabase account
- OpenAI API key
- DataForSEO account (optional)

### Installation

```bash
# Install pnpm if you don't have it
npm install -g pnpm

# Install dependencies
pnpm install

# Set up environment variables
cp apps/web/.env.example apps/web/.env.local
# Edit apps/web/.env.local with your actual values

# Run database migrations
cd packages/supabase
supabase db push

# Start development server
pnpm dev:web
```

Visit `http://localhost:3000` to see your application.

## 📁 Project Structure

```
workforce-seo/
├── apps/
│   ├── web/                    # Next.js web application
│   │   ├── app/               # App Router pages
│   │   │   ├── actions/       # Server actions
│   │   │   ├── api/           # API routes
│   │   │   └── dashboard/     # Dashboard pages
│   │   ├── lib/               # Shared utilities
│   │   └── types/             # TypeScript types
│   └── wp-plugin/             # WordPress plugin
├── packages/
│   └── supabase/              # Database schema & migrations
├── turbo.json                 # Turborepo configuration
├── pnpm-workspace.yaml        # pnpm workspace configuration
└── vercel.json                # Vercel deployment configuration
```

## 🏗️ Architecture

### Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL (via Supabase)
- **Authentication**: Supabase Auth
- **Styling**: Tailwind CSS
- **Monorepo**: Turborepo + pnpm
- **Deployment**: Vercel
- **AI**: OpenAI GPT-4
- **SEO Data**: DataForSEO API

### Key Features

- ✅ SEO Gap Analysis
- ✅ Keyword Opportunity Tracking
- ✅ AI-Powered Content Recommendations
- ✅ WordPress Integration
- ✅ Real-time Performance Monitoring
- ✅ Multi-project Management

## 🔧 Development

### Available Scripts

```bash
# Development
pnpm dev              # Start all apps in development mode
pnpm dev:web          # Start only web app

# Building
pnpm build            # Build all apps
pnpm build:web        # Build only web app

# Code Quality
pnpm lint             # Lint all apps
pnpm type-check       # Type check all apps
pnpm clean            # Clean all build artifacts
```

### Environment Variables

Copy `apps/web/.env.example` to `apps/web/.env.local` and fill in your values:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Database
DATABASE_URL=

# AI
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# SEO Data
DATAFORSEO_LOGIN=
DATAFORSEO_PASSWORD=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

## 🚢 Deployment

### Deploy to Vercel

1. **Install Vercel CLI** (optional):
   ```bash
   npm i -g vercel
   ```

2. **Connect GitHub Repository**:
   - Go to [vercel.com/new](https://vercel.com/new)
   - Import your Git repository
   - Vercel will auto-detect the Turborepo configuration

3. **Configure Environment Variables**:
   - Add all variables from `.env.example` in Vercel Dashboard
   - Mark sensitive variables as "Sensitive"
   - Configure for Production, Preview, and Development environments

4. **Deploy**:
   ```bash
   # Via Git (recommended)
   git push origin main
   
   # Via CLI
   vercel --prod
   ```

### Deployment Configuration

The project is configured with:
- **Build Command**: `pnpm build --filter=@workforce/web`
- **Output Directory**: `apps/web/.next`
- **Install Command**: `pnpm install`
- **Node Version**: 18.17.0 (specified in `.nvmrc`)

See [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) for complete deployment guide.

## 📖 Documentation

- [Deployment Guide](./VERCEL_DEPLOYMENT_GUIDE.md) - Complete Vercel deployment instructions
- [Deployment Checklist](./DEPLOYMENT_CHECKLIST.md) - Pre-deployment checklist
- [Security Guide](./SECURITY.md) - Security best practices
- [Optimization Tips](./OPTIMIZATION_TIPS.md) - Performance optimization strategies
- [SEO Gaps Usage](./SEO_GAPS_USAGE.md) - SEO gaps feature documentation
- [Opportunities Usage](./OPPORTUNITIES_USAGE.md) - Opportunities tracking guide

## 🔒 Security

**IMPORTANT**: Never commit sensitive information:

- ❌ `.env` or `.env.local` files
- ❌ API keys or secrets
- ❌ Database credentials
- ❌ Private keys or certificates

See [SECURITY.md](./SECURITY.md) for complete security guidelines.

## 🧪 Testing

```bash
# Run tests (when implemented)
pnpm test

# Run tests in watch mode
pnpm test:watch

# Generate coverage report
pnpm test:coverage
```

## 📊 Monitoring

### Vercel Analytics

```bash
# Install Vercel packages
pnpm add @vercel/analytics @vercel/speed-insights
```

Add to your app layout:

```typescript
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
```

## 🐛 Troubleshooting

### Common Issues

**Build fails with TypeScript errors:**
```bash
pnpm type-check
# Fix any type errors shown
```

**Database connection issues:**
```bash
# Verify DATABASE_URL is correct
# Check if Supabase project is active
# Ensure IP is whitelisted (or allow all IPs)
```

**Environment variables not loading:**
```bash
# Restart dev server after changing .env.local
# Verify variable names match exactly
# Check if using NEXT_PUBLIC_ prefix for client-side vars
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 Code Style

- Use TypeScript for all new files
- Follow Next.js App Router conventions
- Use Tailwind CSS for styling
- Write meaningful commit messages
- Add JSDoc comments for complex functions

## 🔄 Workflow

1. **Development**: Create feature branch
2. **Preview**: Push to branch → Vercel creates preview URL
3. **Review**: Test preview deployment
4. **Production**: Merge to main → Auto-deploy to production

## 📦 Package Management

This project uses **pnpm workspaces** with **Turborepo**:

```bash
# Add dependency to specific package
pnpm add <package> --filter=@workforce/web

# Add dev dependency
pnpm add -D <package> --filter=@workforce/web

# Update all dependencies
pnpm update --recursive

# Remove unused dependencies
pnpm prune
```

## 🎯 Performance Targets

| Metric | Target |
|--------|--------|
| First Contentful Paint | < 1.8s |
| Largest Contentful Paint | < 2.5s |
| Time to Interactive | < 3.8s |
| Cumulative Layout Shift | < 0.1 |

See [OPTIMIZATION_TIPS.md](./OPTIMIZATION_TIPS.md) for optimization strategies.

## 📄 License

This project is proprietary and confidential.

## 🙏 Acknowledgments

- Next.js team for the amazing framework
- Vercel for hosting and deployment
- Supabase for database and authentication
- OpenAI for AI capabilities
- DataForSEO for SEO data

## 📞 Support

For issues or questions:
- Create an issue in the repository
- Contact the development team
- Check documentation files in the project root

---

**Built with ❤️ using Next.js, TypeScript, and Supabase**
