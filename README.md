# SEOAI - Next.js 14 Project

A Next.js 14 project with TypeScript, Tailwind CSS, shadcn/ui, and Clerk authentication.

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Create a `.env` file in the root directory with your Clerk keys and Supabase connection string:

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Supabase Database
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres?pgbouncer=true&connection_limit=1"
```

**To get your keys:**
- **Clerk:** Go to [Clerk Dashboard](https://dashboard.clerk.com) → API Keys
- **Supabase:** Go to [Supabase Dashboard](https://app.supabase.com) → Settings → Database → Connection string

See `ENV_SETUP.md` for detailed instructions.

### 3. Set Up Prisma Database

After adding your `DATABASE_URL` to `.env`, run:

```bash
# Generate Prisma Client
npm run db:generate

# Create and run the initial migration
npm run db:migrate
```

This will:
- Generate the Prisma Client
- Create the initial migration based on your schema
- Apply the migration to your Supabase database

### 5. Start the Development Server

```bash
npm run dev
```

### 6. Open Your Browser

Navigate to [http://localhost:3000](http://localhost:3000)

**Note:** The home page will automatically redirect:
- Logged-in users → `/dashboard`
- Logged-out users → `/login`

## Project Structure

```
/app
  /login          - Login page with Clerk SignIn component
  /dashboard      - Protected dashboard route (requires authentication)
  layout.tsx      - Root layout with ClerkProvider
  page.tsx        - Home page (redirects based on auth state)
  globals.css     - Global styles with Tailwind
/lib
  utils.ts        - Utility functions (cn helper for shadcn/ui)
  prisma.ts       - Prisma client instance
/components       - Component directory (ready for shadcn/ui components)
/prisma
  schema.prisma   - Prisma database schema
middleware.ts     - Clerk middleware for route protection
```

## Authentication Flow

- **Protected Routes:** `/dashboard` is protected and requires authentication
- **Login Page:** `/login` - Uses Clerk's SignIn component (email + password)
- **Redirects:**
  - Logged-in users visiting `/` → redirected to `/dashboard`
  - Logged-out users visiting `/` → redirected to `/login`
  - Logged-out users trying to access `/dashboard` → redirected to `/login`
  - Logged-in users visiting `/login` → redirected to `/dashboard`

## Adding shadcn/ui Components

To add shadcn/ui components, use the CLI:

```bash
npx shadcn-ui@latest add [component-name]
```

For example:
```bash
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## Database Scripts

- `npm run db:generate` - Generate Prisma Client
- `npm run db:push` - Push schema changes to database (dev only)
- `npm run db:migrate` - Create and run a new migration
- `npm run db:studio` - Open Prisma Studio (database GUI)

