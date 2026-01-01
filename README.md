# SEOAI - Next.js 14 Project

A Next.js 14 project with TypeScript, Tailwind CSS, shadcn/ui, and Clerk authentication.

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Clerk Authentication

Create a `.env.local` file in the root directory with your Clerk keys:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

**To get your Clerk keys:**
1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Create a new application or select an existing one
3. Navigate to **API Keys** section
4. Copy the **Publishable Key** and **Secret Key**
5. Paste them into your `.env.local` file

See `ENV_SETUP.md` for detailed instructions.

### 3. Start the Development Server

```bash
npm run dev
```

### 4. Open Your Browser

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
/components       - Component directory (ready for shadcn/ui components)
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

