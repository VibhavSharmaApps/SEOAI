# Prisma with Supabase Setup Guide

## Initial Setup

After adding your `DATABASE_URL` to `.env.local`, follow these steps:

### 1. Generate Prisma Client

```bash
npm run db:generate
```

This reads your `prisma/schema.prisma` file and generates the Prisma Client in `node_modules/.prisma/client`.

### 2. Create Initial Migration

```bash
npm run db:migrate
```

When prompted, enter a migration name (e.g., `init` or `create_user_table`).

This will:
- Create a new migration in `prisma/migrations/`
- Generate the SQL to create tables based on your schema
- Apply the migration to your Supabase database
- Regenerate the Prisma Client

### 3. Verify Migration

After running the migration, you should see:
- A new folder in `prisma/migrations/` with a timestamp and your migration name
- The `users` table created in your Supabase database

## Using Prisma Client

Import and use Prisma Client in your application:

```typescript
import { prisma } from '@/lib/prisma'

// Example: Create a user
const user = await prisma.user.create({
  data: {
    clerkId: 'user_xxx',
    email: 'user@example.com',
    name: 'John Doe',
  },
})

// Example: Find a user
const user = await prisma.user.findUnique({
  where: { email: 'user@example.com' },
})
```

## Database Scripts

- `npm run db:generate` - Generate Prisma Client (run after schema changes)
- `npm run db:push` - Push schema changes directly to database (dev only, no migration)
- `npm run db:migrate` - Create and apply a new migration
- `npm run db:studio` - Open Prisma Studio to view/edit data in browser

## Schema Changes

When you modify `prisma/schema.prisma`:

1. Generate Prisma Client: `npm run db:generate`
2. Create migration: `npm run db:migrate`
3. Or use `npm run db:push` for quick dev changes (not recommended for production)

## Migration Files Location

Migrations are stored in `prisma/migrations/` and should be committed to version control. Each migration contains:
- `migration.sql` - SQL statements to apply
- `migration_lock.toml` - Lock file (auto-generated)

