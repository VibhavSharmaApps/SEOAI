-- Migration 00004: enable the pages-table cache.
--
-- The pages table from 00001 had RLS enabled but no policies, which meant
-- the cache layer (which reads/writes from authenticated server actions)
-- couldn't see any rows. This migration adds the missing policies AND a
-- `status` column needed by the dashboard's status filter on the pages
-- browser.
--
-- Safe to apply on top of existing data: ADD COLUMN with a default and the
-- policies use IF NOT EXISTS where Postgres allows it.

-- Status column — stores the WordPress post_status string ('publish',
-- 'draft', etc.) so the cache layer can filter without a round-trip to
-- the customer's WP site.
ALTER TABLE pages
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'publish';

-- Compound index for the most common dashboard query: pages on a site,
-- optionally filtered by status, sorted by last_updated DESC. This
-- covers the default sort order shown in the pages browser.
CREATE INDEX IF NOT EXISTS idx_pages_site_status_updated
  ON pages(site_id, status, last_updated DESC);

-- RLS policies — mirror the sites table pattern: a page row is visible
-- when its parent site belongs to the authenticated user. The sub-select
-- is the standard chained-RLS shape used elsewhere in 00001.
--
-- Postgres doesn't support CREATE POLICY IF NOT EXISTS in older versions,
-- so we DROP first to make the migration idempotent on dev databases.
DROP POLICY IF EXISTS "Users can view own site pages" ON pages;
CREATE POLICY "Users can view own site pages"
  ON pages FOR SELECT
  USING (
    site_id IN (
      SELECT id FROM sites WHERE user_id IN (
        SELECT id FROM users WHERE auth_id = auth.uid()::text
      )
    )
  );

DROP POLICY IF EXISTS "Users can insert own site pages" ON pages;
CREATE POLICY "Users can insert own site pages"
  ON pages FOR INSERT
  WITH CHECK (
    site_id IN (
      SELECT id FROM sites WHERE user_id IN (
        SELECT id FROM users WHERE auth_id = auth.uid()::text
      )
    )
  );

DROP POLICY IF EXISTS "Users can update own site pages" ON pages;
CREATE POLICY "Users can update own site pages"
  ON pages FOR UPDATE
  USING (
    site_id IN (
      SELECT id FROM sites WHERE user_id IN (
        SELECT id FROM users WHERE auth_id = auth.uid()::text
      )
    )
  );

DROP POLICY IF EXISTS "Users can delete own site pages" ON pages;
CREATE POLICY "Users can delete own site pages"
  ON pages FOR DELETE
  USING (
    site_id IN (
      SELECT id FROM sites WHERE user_id IN (
        SELECT id FROM users WHERE auth_id = auth.uid()::text
      )
    )
  );
