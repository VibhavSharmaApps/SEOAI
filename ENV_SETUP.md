# Environment Variables Setup

## Clerk Authentication Variables

Create a `.env` file in the root of your project with the following variables:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

### How to Get Your Clerk Keys

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Create a new application or select an existing one
3. Navigate to **API Keys** in the sidebar
4. Copy the **Publishable Key** and **Secret Key**
5. Paste them into your `.env` file

### Optional Configuration

You can customize the authentication flow URLs:

```env
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
```

### Important Notes

- The `.env` file is already in `.gitignore` and will not be committed to version control
- Never commit your secret keys to version control
- Use test keys for development and production keys for production
- Restart your development server after adding environment variables
- **Note:** Next.js reads both `.env` and `.env.local`, but Prisma only reads `.env` by default

## Supabase Database Variables

Add the Supabase connection string to your `.env` file:

```env
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres?pgbouncer=true&connection_limit=1"
```

### How to Get Your Supabase Connection String

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Create a new project or select an existing one
3. Go to **Settings** → **Database**
4. Under **Connection string**, select **URI** or **Connection pooling**
5. Copy the connection string
6. Replace `[YOUR-PASSWORD]` with your database password
7. Replace `[YOUR-PROJECT-REF]` with your project reference
8. Paste it into your `.env` file

### Connection String Format

For **Direct connection** (development):
```
postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

For **Connection pooling** (recommended for production):
```
postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
```

### Important Notes

- Use connection pooling for production environments
- Never commit your database password to version control
- The connection string includes your database password - keep it secure
- **Prisma reads from `.env` by default** - this works perfectly with Next.js which also reads `.env`
- Make sure your `DATABASE_URL` is in quotes if it contains special characters

