# Manual Disconnect - If Button Doesn't Work

If the disconnect button doesn't work, you can manually disconnect by clearing the database.

## Option 1: Use the Disconnect Button

1. Go to `/dashboard`
2. Scroll to "Disconnect Store" section
3. Click "Disconnect Shopify Store"
4. Confirm
5. Page will redirect automatically

## Option 2: Manual Database Update

If the button doesn't work, you can manually update the database:

### Using Prisma Studio

1. Run Prisma Studio:
   ```bash
   npm run db:studio
   ```

2. Open the `sites` table
3. Find your site record
4. Edit it:
   - Set `shopifyAccessToken` to `null` (empty)
   - Set `isActive` to `false`
5. Save

### Using SQL (Supabase)

1. Go to Supabase Dashboard → SQL Editor
2. Run this query (replace `YOUR_USER_ID` with your actual user ID):

```sql
UPDATE sites 
SET "shopifyAccessToken" = NULL, "isActive" = false
WHERE "userId" = (
  SELECT id FROM users WHERE "clerkId" = 'YOUR_CLERK_USER_ID'
);
```

### Using Terminal/Prisma CLI

```bash
# Connect to your database and run:
npx prisma db execute --stdin
```

Then paste:
```sql
UPDATE sites 
SET "shopifyAccessToken" = NULL, "isActive" = false
WHERE "shopifyAccessToken" IS NOT NULL;
```

## Option 3: Delete the Site Record

If you want to completely remove the site:

```sql
DELETE FROM sites 
WHERE "userId" = (
  SELECT id FROM users WHERE "clerkId" = 'YOUR_CLERK_USER_ID'
);
```

**Note:** This will also delete all related data (keywords, content, etc.)

## Verify Disconnect

After disconnecting, refresh your dashboard. You should see:
- "Connect Shopify Store" button instead of "Connected"
- No domain or store URL displayed

## Then Connect New App

After disconnecting:
1. Go to `/dashboard/connect-shopify`
2. Enter your new store domain
3. Complete OAuth with your new Shopify app

