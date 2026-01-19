# Shopify Webhook Registration for Customer Privacy Compliance

## Required Webhooks

These three webhooks are **mandatory** for all Shopify apps that handle customer data (GDPR/CCPA compliance).

## Production Domain

**IMPORTANT**: Replace `YOUR_PRODUCTION_DOMAIN` with your actual production domain from `NEXT_PUBLIC_APP_URL`.

Example production domains:
- Vercel: `https://your-app.vercel.app`
- Custom domain: `https://yourdomain.com`

---

## Webhook 1: Customer Data Request

**Topic**: `customers/data_request`

**Callback URL**: 
```
https://YOUR_PRODUCTION_DOMAIN/webhooks/customers/data_request
```

**Example (Vercel)**:
```
https://your-app.vercel.app/webhooks/customers/data_request
```

**Purpose**: Triggered when a customer requests access to their data (GDPR/CCPA right to access).

**HTTP Method**: `POST`

**Format**: JSON

---

## Webhook 2: Customer Data Deletion

**Topic**: `customers/redact`

**Callback URL**: 
```
https://YOUR_PRODUCTION_DOMAIN/webhooks/customers/redact
```

**Example (Vercel)**:
```
https://your-app.vercel.app/webhooks/customers/redact
```

**Purpose**: Triggered when a customer requests deletion of their data (GDPR/CCPA right to deletion).

**HTTP Method**: `POST`

**Format**: JSON

---

## Webhook 3: Shop Data Deletion

**Topic**: `shop/redact`

**Callback URL**: 
```
https://YOUR_PRODUCTION_DOMAIN/webhooks/shop/redact
```

**Example (Vercel)**:
```
https://your-app.vercel.app/webhooks/shop/redact
```

**Purpose**: Triggered when a shop requests deletion of their data (e.g., app uninstall, shop closure).

**HTTP Method**: `POST`

**Format**: JSON

---

## How to Register in Shopify Partners Dashboard

1. Go to [Shopify Partners Dashboard](https://partners.shopify.com/)
2. Select your app
3. Navigate to **App Setup** → **Webhooks**
4. Click **Add webhook** for each of the three webhooks above
5. Enter the exact topic and callback URL for each webhook
6. **Verify the URLs match your production domain exactly** (no trailing slashes, correct protocol)

---

## URL Format Requirements

✅ **Correct**:
- `https://your-app.vercel.app/webhooks/customers/data_request`
- `https://yourdomain.com/webhooks/shop/redact`

❌ **Incorrect**:
- `https://your-app.vercel.app/webhooks/customers/data_request/` (trailing slash)
- `http://your-app.vercel.app/webhooks/customers/data_request` (HTTP instead of HTTPS)
- `https://your-app.vercel.app/api/webhooks/customers/data_request` (extra `/api` path)

---

## Verification Checklist

Before submitting your app for review, verify:

- [ ] All three webhooks are registered in Shopify Partners Dashboard
- [ ] Callback URLs use HTTPS (not HTTP)
- [ ] URLs match your production domain exactly (from `NEXT_PUBLIC_APP_URL`)
- [ ] No trailing slashes in URLs
- [ ] Webhook topics match exactly: `customers/data_request`, `customers/redact`, `shop/redact`
- [ ] All webhooks are set to POST method
- [ ] Webhook endpoints return 200 OK for valid requests
- [ ] Webhook endpoints return 401 for invalid HMAC signatures

---

## Testing

After registering webhooks, you can test them:

1. **Test Customer Data Request**: 
   - In Shopify Admin → Settings → Privacy → Customer data requests
   - Request customer data export
   - Check your server logs for webhook delivery

2. **Test Customer Data Deletion**:
   - In Shopify Admin → Settings → Privacy → Customer data requests
   - Request customer data deletion
   - Check your server logs for webhook delivery

3. **Test Shop Data Deletion**:
   - Uninstall your app from a test store
   - Check your server logs for webhook delivery

---

## Current Implementation

All three webhook endpoints are implemented at:
- `app/webhooks/customers/data_request/route.ts`
- `app/webhooks/customers/redact/route.ts`
- `app/webhooks/shop/redact/route.ts`

Each endpoint:
- ✅ Verifies HMAC signature before processing
- ✅ Returns 200 OK for valid requests
- ✅ Returns 401 for invalid signatures
- ✅ Logs webhook payload for compliance tracking

---

## Environment Variable

Ensure `NEXT_PUBLIC_APP_URL` is set to your production domain:

```env
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

**Note**: Do not include a trailing slash in the environment variable.

