# Fix: Database Connection Error - "Tenant or user not found"

## Problem

Error when running Prisma migrations:
```
FATAL: Tenant or user not found
```

This means Prisma can't connect to your Supabase database.

## Common Causes

### 1. Missing or Incorrect DATABASE_URL

**Check:**
- Is `DATABASE_URL` in your `.env` file?
- Is the connection string correct?

**Fix:**
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Settings** → **Database**
4. Under **Connection string**, select **URI** tab
5. Copy the connection string
6. Make sure it includes your password

### 2. Wrong Connection String Format

**For Development (Direct Connection):**
```env
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
```

**For Production (Connection Pooling):**
```env
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
```

**Important:**
- Replace `[YOUR-PASSWORD]` with your actual database password
- Replace `[PROJECT-REF]` with your project reference (found in Supabase dashboard URL)
- Use quotes around the connection string if it contains special characters

### 3. Wrong Password

**Check:**
- Did you reset your database password?
- Is the password in the connection string correct?

**Fix:**
1. Go to Supabase Dashboard → **Settings** → **Database**
2. Click **Reset database password** if needed
3. Update your `.env` file with the new password

### 4. Using Pooler for Migrations

**Problem:** Connection poolers (port 6543) don't work well with Prisma migrations.

**Fix:** Use direct connection (port 5432) for migrations:

```env
# For migrations - use direct connection
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
```

Then switch back to pooler for production:
```env
# For production - use connection pooling
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
```

### 5. Project Reference Mismatch

**Check:**
- Is the project reference in the URL correct?
- Did you copy the connection string from the right project?

**Fix:**
- Verify your project reference in Supabase dashboard URL
- Make sure it matches the connection string

## Step-by-Step Fix

### Step 1: Verify Your Connection String

1. **Go to Supabase Dashboard:**
   - Visit [app.supabase.com](https://app.supabase.com)
   - Select your project

2. **Get Connection String:**
   - Go to **Settings** → **Database**
   - Scroll to **Connection string**
   - Select **URI** tab (not Session mode)
   - Copy the connection string

3. **Format Should Look Like:**
   ```
   postgresql://postgres:[PASSWORD]@db.abcdefghijklmnop.supabase.co:5432/postgres
   ```

### Step 2: Update Your .env File

1. **Open `.env` file** in your project root

2. **Add or update DATABASE_URL:**
   ```env
   DATABASE_URL="postgresql://postgres:YOUR_ACTUAL_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres"
   ```

3. **Important:**
   - Replace `YOUR_ACTUAL_PASSWORD` with your real password
   - Replace `YOUR_PROJECT_REF` with your project reference
   - Keep the quotes around the connection string
   - No spaces around the `=` sign

### Step 3: Test Connection

```bash
# Test if Prisma can connect
npx prisma db pull --dry-run
```

If this works, try the migration again:
```bash
npx prisma migrate dev --name add_google_oauth_tokens
```

### Step 4: Alternative - Use Prisma Studio to Test

```bash
npm run db:studio
```

If Prisma Studio opens and shows your database, the connection is working.

## Quick Checklist

- [ ] `DATABASE_URL` exists in `.env` file
- [ ] Connection string is in quotes
- [ ] Password is correct (no typos)
- [ ] Project reference matches your Supabase project
- [ ] Using direct connection (port 5432) for migrations
- [ ] No extra spaces or characters in connection string

## Still Not Working?

### Option 1: Reset Database Password

1. Supabase Dashboard → **Settings** → **Database**
2. Click **Reset database password**
3. Copy new password
4. Update `.env` file

### Option 2: Create New Connection String

1. Supabase Dashboard → **Settings** → **Database**
2. Under **Connection string**, click **Reset**
3. Copy the new connection string
4. Update `.env` file

### Option 3: Check Supabase Project Status

- Make sure your Supabase project is active
- Check if project is paused (free tier projects pause after inactivity)
- Resume project if needed

## Example .env File

```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Database (Direct connection for migrations)
DATABASE_URL="postgresql://postgres:your_password_here@db.abcdefghijklmnop.supabase.co:5432/postgres"

# Shopify
SHOPIFY_API_KEY=your_key
SHOPIFY_API_SECRET=your_secret
SHOPIFY_ENCRYPTION_KEY=your_64_char_hex_key

# App URL
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

## After Fixing

Once the connection works, run the migration:

```bash
npx prisma migrate dev --name add_google_oauth_tokens
```

This will add the `googleOAuthToken` and `googleOAuthRefreshToken` fields to your `sites` table.

