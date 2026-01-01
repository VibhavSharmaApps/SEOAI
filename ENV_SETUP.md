# Environment Variables Setup

## Clerk Authentication Variables

Create a `.env.local` file in the root of your project with the following variables:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

### How to Get Your Clerk Keys

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Create a new application or select an existing one
3. Navigate to **API Keys** in the sidebar
4. Copy the **Publishable Key** and **Secret Key**
5. Paste them into your `.env.local` file

### Optional Configuration

You can customize the authentication flow URLs:

```env
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
```

### Important Notes

- The `.env.local` file is already in `.gitignore` and will not be committed to version control
- Never commit your secret keys to version control
- Use test keys for development and production keys for production
- Restart your development server after adding environment variables

