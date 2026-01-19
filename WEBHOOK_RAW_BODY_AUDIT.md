# Shopify Webhook Raw Body Access Audit

## Audit Date
Current implementation review

## Framework
**Next.js 14 App Router** (not Express.js)

## Current Configuration Status
✅ **CORRECTLY CONFIGURED** - No changes needed

## How Next.js App Router Handles Raw Body

### Automatic Behavior
- Next.js App Router provides request body as a **stream**
- Body is **NOT automatically parsed** unless you call `request.json()`
- Using `request.arrayBuffer()` reads raw bytes directly from the stream
- This happens **before** any JSON parsing can occur

### Implementation Pattern
All webhook routes follow this secure pattern:

```typescript
// STEP 1: Read raw body FIRST (before any processing)
const rawBody = await request.arrayBuffer()
const bodyBuffer = Buffer.from(rawBody)

// STEP 2: Verify HMAC using raw body
verifyShopifyWebhook(bodyBuffer, hmacHeader)

// STEP 3: Only then parse JSON (after verification)
const payload = JSON.parse(bodyBuffer.toString('utf-8'))
```

## Verification Results

### ✅ Webhook Routes Audited
1. `/webhooks/customers/data_request` - ✅ Correct
2. `/webhooks/customers/redact` - ✅ Correct
3. `/webhooks/shop/redact` - ✅ Correct

### ✅ Configuration Files
- `next.config.js` - ✅ No body parser config needed (documented)
- `middleware.ts` - ✅ Does not interfere with body parsing
- Route segment configs - ✅ All use `runtime = 'nodejs'` and `dynamic = 'force-dynamic'`

### ✅ Security Guarantees
- Raw body is read before JSON parsing
- HMAC verification uses exact raw payload bytes
- Invalid requests are rejected before any processing
- No body parser middleware interferes

## Comparison with Other Frameworks

### Express.js
```javascript
// Would require:
app.use('/webhooks', bodyParser.raw({ type: 'application/json' }))
```
**Status**: Not applicable - using Next.js App Router

### Next.js Pages Router (Legacy)
```javascript
// Would require:
export const config = {
  api: {
    bodyParser: false
  }
}
```
**Status**: Not applicable - using App Router

### Next.js App Router (Current)
```typescript
// No configuration needed - use request.arrayBuffer() directly
const rawBody = await request.arrayBuffer()
```
**Status**: ✅ Already implemented correctly

## Key Points

1. **No Body Parser Needed**: Next.js App Router doesn't require explicit body parser configuration
2. **Stream-Based**: Request body is a stream, not pre-parsed
3. **First Read Wins**: Calling `arrayBuffer()` first prevents JSON parsing
4. **HMAC Accuracy**: Raw bytes match Shopify's HMAC calculation exactly

## Recommendations

✅ **No changes required** - Current implementation is correct and secure

### Best Practices Followed
- ✅ Raw body read before any processing
- ✅ HMAC verification before JSON parsing
- ✅ Invalid requests rejected immediately
- ✅ Clear documentation in code comments

## Testing Verification

To verify raw body access is working:

1. **Check HMAC Verification**: Invalid signatures should be rejected with 401
2. **Check Logs**: Webhook logs should show "HMAC verified" before payload parsing
3. **Test with Invalid HMAC**: Should reject immediately without processing

## Conclusion

The server configuration is **correctly set up** for raw request body access in Shopify webhook routes. No additional configuration is needed. The implementation follows Next.js App Router best practices and ensures accurate HMAC verification using the exact raw payload bytes.

