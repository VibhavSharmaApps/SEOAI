/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  /**
   * Webhook Raw Body Configuration
   * 
   * Next.js App Router automatically handles raw body access when using
   * request.arrayBuffer() in API routes. No additional configuration needed.
   * 
   * Webhook routes at /webhooks/* use request.arrayBuffer() to read raw body
   * before any JSON parsing, ensuring accurate HMAC verification.
   * 
   * Note: Unlike Express.js (which requires bodyParser.raw()), Next.js App Router
   * provides raw body access natively via the Request API.
   */
}

module.exports = nextConfig


