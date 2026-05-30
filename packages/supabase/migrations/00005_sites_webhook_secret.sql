-- Migration 00005: add webhook_secret to sites.
--
-- Used by the WP→dashboard webhook sync (Wave B B2). The WordPress plugin
-- signs each outbound webhook with HMAC-SHA256 using this secret; the
-- dashboard's /api/webhooks/wordpress/[siteId] route verifies the
-- signature before trusting the payload.
--
-- Backfills existing rows so previously-connected sites can opt into
-- webhooks by pasting the secret into their plugin settings.

ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS webhook_secret TEXT;

-- Generate a fresh 32-byte (64 hex char) secret for any existing site
-- that doesn't have one. New sites get theirs assigned in the createSite
-- server action.
UPDATE sites
  SET webhook_secret = encode(gen_random_bytes(32), 'hex')
  WHERE webhook_secret IS NULL;

-- Left nullable on purpose — admin-inserted rows (e.g. via SQL import)
-- can opt in later. Webhook delivery for sites with NULL secret is a
-- silent no-op on the dashboard side.
