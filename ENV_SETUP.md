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

## Shopify OAuth Variables

Add Shopify API credentials to your `.env` file:

```env
SHOPIFY_API_KEY=your_shopify_api_key
SHOPIFY_API_SECRET=your_shopify_api_secret
SHOPIFY_ENCRYPTION_KEY=your_64_character_hex_encryption_key
```

**Note:** `SHOPIFY_API_KEY` is the same as "Client ID" in Shopify's interface. `SHOPIFY_API_SECRET` is the "Client Secret".

### How to Get Your Shopify API Credentials

1. Go to [Shopify Partners Dashboard](https://partners.shopify.com)
2. Create a new app or select an existing app
3. Go to **App setup** → **Client credentials**
4. Copy the **Client ID** (this is your `SHOPIFY_API_KEY`) and **Client secret** (this is your `SHOPIFY_API_SECRET`)
5. Paste them into your `.env` file

**Important:** 
- **Client ID** = `SHOPIFY_API_KEY` (they're the same thing)
- **Client Secret** = `SHOPIFY_API_SECRET` (they're the same thing)

### Generate Encryption Key

The encryption key is used to securely store Shopify access tokens. Generate a secure key:

**Using OpenSSL (recommended):**
```bash
openssl rand -hex 32
```

**Using Node.js:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the generated key and add it to your `.env` file as `SHOPIFY_ENCRYPTION_KEY`.

### App URL Configuration

The app automatically detects the URL in different environments:

- **Vercel (Production):** Automatically uses `VERCEL_URL` - no configuration needed! ✅
- **Custom Domain:** Set `NEXT_PUBLIC_APP_URL=https://yourdomain.com` if you have a custom domain
- **Local Development:** Falls back to `http://localhost:3000` automatically

**For Vercel deployments:** You don't need to set `NEXT_PUBLIC_APP_URL` - it will automatically use your Vercel URL!

**Optional:** If you want to override the automatic detection, you can set:
```env
NEXT_PUBLIC_APP_URL=https://your-custom-domain.com
```

This URL is used for OAuth redirects. Make sure it matches your app's URL exactly.

### Shopify App Configuration

In your Shopify app settings, configure:

1. **Allowed redirection URL(s):**
   - **Development:** `http://localhost:3000/api/shopify/callback`
   - **Vercel Production:** `https://your-app.vercel.app/api/shopify/callback`
   - **Custom Domain:** `https://yourdomain.com/api/shopify/callback`
   
   **Important:** Add ALL URLs you'll use (localhost for testing + Vercel URL + custom domain if applicable)

2. **Required Scopes:**
   - `read_content` - Read blog posts
   - `write_content` - Create/update blog posts
   - `read_products` - Read product information (if needed)

### Important Notes

- **Never commit your Shopify API secret or encryption key to version control**
- The encryption key must be exactly 64 characters (32 bytes in hex)
- Keep the encryption key secure - if it's lost, you'll need to re-authenticate all stores
- The `NEXT_PUBLIC_APP_URL` must match your app's actual URL for OAuth to work

