/**
 * Feature Flags
 * Temporary feature flags for controlling UI access to features
 */

/**
 * Feature flag to disable UI access to content generation and publishing flows
 * When enabled, the Content Generation UI is hidden and the primary CTA
 * triggers the SEO run endpoint instead
 * 
 * Set NEXT_PUBLIC_DISABLE_CONTENT_GENERATION_UI=true to enable this flag
 */
export const DISABLE_CONTENT_GENERATION_UI =
  process.env.NEXT_PUBLIC_DISABLE_CONTENT_GENERATION_UI === 'true'

