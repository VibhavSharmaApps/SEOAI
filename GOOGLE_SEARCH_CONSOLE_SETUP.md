# Google Search Console API Setup

## Overview

The `/api/performance/snapshot` endpoint fetches search performance data from Google Search Console and stores it in the database.

## Prerequisites

1. **Google Cloud Project** with Search Console API enabled
2. **OAuth 2.0 credentials** or **Service Account**
3. **Google Search Console** property verified for your site

## Setup Steps

### Option 1: OAuth 2.0 (Recommended for MVP)

1. **Create Google Cloud Project:**
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create a new project or select existing one

2. **Enable Search Console API:**
   - Navigate to "APIs & Services" → "Library"
   - Search for "Google Search Console API"
   - Click "Enable"

3. **Create OAuth 2.0 Credentials:**
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - Application type: "Web application"
   - Authorized redirect URIs: Add your callback URL (e.g., `https://your-app.vercel.app/api/google/callback`)
   - Save Client ID and Client Secret

4. **Get Access Token:**
   - Use Google OAuth flow to get access token
   - Or use a tool like [Google OAuth Playground](https://developers.google.com/oauthplayground/)
   - Scope needed: `https://www.googleapis.com/auth/webmasters.readonly`

5. **Set Environment Variable:**
   ```env
   GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN=your_access_token_here
   ```

### Option 2: Service Account (Better for Production/Cron)

1. **Create Service Account:**
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "Service account"
   - Create service account and download JSON key

2. **Grant Access in Search Console:**
   - Go to [Google Search Console](https://search.google.com/search-console)
   - Select your property
   - Go to "Settings" → "Users and permissions"
   - Add the service account email (from JSON key) as a user

3. **Use Service Account:**
   - Store service account JSON in environment variable or secure storage
   - Use `google-auth-library` to authenticate
   - Generate access token from service account

## Environment Variables

Add to your `.env` file:

```env
# Option 1: Direct access token (for testing)
GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN=ya29.a0AfH6SMB...

# Option 2: Service account (for production)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

**For Vercel:**
- Add these to Vercel Dashboard → Settings → Environment Variables

## API Endpoint Usage

### Manual Trigger

```bash
POST /api/performance/snapshot
Content-Type: application/json

{
  "days": 7,  // Optional, default: 7
  "site_url": "https://yourstore.com"  // Optional, defaults to shopifyStoreUrl
}
```

### Weekly Cron Setup

For Vercel, use Vercel Cron Jobs:

1. **Create `vercel.json`:**
```json
{
  "crons": [{
    "path": "/api/performance/snapshot",
    "schedule": "0 0 * * 0"
  }]
}
```

2. **Or use external cron service:**
   - [cron-job.org](https://cron-job.org)
   - [EasyCron](https://www.easycron.com)
   - Set to call your endpoint weekly

## Response Format

```json
{
  "success": true,
  "message": "Performance snapshot created successfully",
  "summary": {
    "totalGSCRecords": 1250,
    "stored": 1100,
    "skipped": 150,
    "dateRange": {
      "start": "2025-01-01T00:00:00.000Z",
      "end": "2025-01-08T00:00:00.000Z"
    }
  }
}
```

## Data Stored

The endpoint stores data in `performance_snapshots` table:

- `page_id`: Links to the page
- `keyword`: Search query
- `impressions`: Number of times shown in search
- `clicks`: Number of clicks
- `position`: Average position in search results
- `date`: Snapshot date

## URL Matching

The endpoint matches GSC URLs to your database pages by:
- Normalizing URLs (removing trailing slashes, http/https)
- Matching against `pages.url` field
- If no match found, the record is skipped

## Troubleshooting

### "Access token not configured"
- Set `GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN` environment variable
- Or implement service account authentication

### "No matching page found"
- URLs from GSC don't match your database URLs
- Check URL format in `pages` table
- GSC URLs should match your Shopify store URLs

### "403 Forbidden"
- Access token expired (OAuth tokens expire)
- Service account doesn't have Search Console access
- Re-authenticate or refresh token

### "Site not verified"
- Property must be verified in Google Search Console
- Service account must be added as user in Search Console

## Next Steps

1. Set up Google OAuth or Service Account
2. Add environment variables
3. Test endpoint manually
4. Set up weekly cron job
5. Monitor performance data in database

