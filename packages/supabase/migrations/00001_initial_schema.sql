-- ============================================================================
-- Workforce SEO — Initial Database Schema
-- Converted from Prisma schema, adapted for WordPress-first + Supabase
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE site_type AS ENUM ('WORDPRESS');

CREATE TYPE content_status AS ENUM ('DRAFT', 'PUBLISHED', 'SCHEDULED');

CREATE TYPE autopilot_run_status AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

CREATE TYPE page_type AS ENUM ('POST', 'PAGE');

CREATE TYPE change_intent_type AS ENUM ('UPDATE_META', 'ADD_INTERNAL_LINK', 'INJECT_SCHEMA');

CREATE TYPE change_intent_status AS ENUM ('PENDING', 'APPLIED', 'FAILED', 'ROLLED_BACK');

-- ============================================================================
-- TABLES
-- ============================================================================

-- Users: Application users (authenticated via Supabase Auth)
CREATE TABLE users (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  auth_id     TEXT UNIQUE NOT NULL,    -- Supabase Auth user ID
  email       TEXT UNIQUE NOT NULL,
  name        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sites: WordPress sites connected to the platform
CREATE TABLE sites (
  id                          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id                     TEXT REFERENCES users(id) ON DELETE SET NULL,
  type                        site_type NOT NULL DEFAULT 'WORDPRESS',
  domain                      TEXT UNIQUE NOT NULL,
  wp_site_url                 TEXT NOT NULL,          -- WordPress site URL
  wp_rest_url                 TEXT,                    -- WordPress REST API URL
  api_key                     TEXT,                    -- Encrypted API key for WP plugin auth
  google_oauth_token          TEXT,                    -- Encrypted Google OAuth access token
  google_oauth_refresh_token  TEXT,                    -- Encrypted Google OAuth refresh token
  name                        TEXT,
  is_active                   BOOLEAN NOT NULL DEFAULT true,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sites_user_id ON sites(user_id);

-- Keywords: SEO keywords tracked for a site
CREATE TABLE keywords (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  site_id         TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  keyword         TEXT NOT NULL,
  target_url      TEXT,              -- URL this keyword should rank for
  current_ranking INTEGER,           -- Current Google ranking (1-100, null if not ranked)
  source          TEXT,              -- Where the keyword came from (e.g., "ai_generated", "manual", "gsc")
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(site_id, keyword)
);

-- GSC Keyword Daily: Daily Google Search Console keyword performance
CREATE TABLE gsc_keyword_daily (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  site_id     TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  keyword     TEXT NOT NULL,
  date        DATE NOT NULL,
  impressions INTEGER NOT NULL,
  clicks      INTEGER NOT NULL,
  position    REAL NOT NULL,          -- Average position
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(site_id, keyword, date)
);
CREATE INDEX idx_gsc_keyword_daily_site_date ON gsc_keyword_daily(site_id, date);
CREATE INDEX idx_gsc_keyword_daily_date ON gsc_keyword_daily(date);

-- GSC Properties: Google Search Console properties connected to a site
CREATE TABLE gsc_properties (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  site_id     TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  site_url    TEXT NOT NULL,          -- GSC property URL
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(site_id, site_url)
);
CREATE INDEX idx_gsc_properties_site_active ON gsc_properties(site_id, is_active);

-- Content: Blog posts / pages managed by the platform
CREATE TABLE content (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  site_id       TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  wp_post_id    INTEGER,              -- WordPress post ID (for syncing)
  title         TEXT NOT NULL,
  url           TEXT,
  status        content_status NOT NULL DEFAULT 'DRAFT',
  published_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prompts: AI prompt templates with versioning
CREATE TABLE prompts (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  site_id     TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  version     INTEGER NOT NULL DEFAULT 1,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(site_id, name, version)
);

-- Autopilot Runs: Logs for automated job executions
CREATE TABLE autopilot_runs (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  site_id         TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  scheduled_for   TIMESTAMPTZ NOT NULL,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  status          autopilot_run_status NOT NULL DEFAULT 'PENDING',
  error_message   TEXT,
  result_summary  JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_autopilot_runs_site_scheduled ON autopilot_runs(site_id, scheduled_for);

-- Pages: WordPress posts and pages synced from the WP plugin
CREATE TABLE pages (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  site_id           TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  wp_post_id        INTEGER NOT NULL,   -- WordPress post ID
  type              page_type NOT NULL,
  title             TEXT NOT NULL,
  url               TEXT NOT NULL,
  last_updated      TIMESTAMPTZ NOT NULL,
  tracking_enabled  BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(site_id, wp_post_id, type)
);
CREATE INDEX idx_pages_site_type ON pages(site_id, type);

-- Content Versions: Generated content versions for pages
CREATE TABLE content_versions (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  page_id      TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  version      INTEGER NOT NULL,
  content      TEXT NOT NULL,
  reason       TEXT NOT NULL,
  published_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(page_id, version)
);
CREATE INDEX idx_content_versions_page ON content_versions(page_id);

-- Performance Snapshots: Google Search Console performance data per page
CREATE TABLE performance_snapshots (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  page_id     TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  keyword     TEXT NOT NULL,
  impressions INTEGER NOT NULL,
  clicks      INTEGER NOT NULL,
  position    REAL NOT NULL,
  date        DATE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(page_id, keyword, date)
);
CREATE INDEX idx_performance_snapshots_page_date ON performance_snapshots(page_id, date);
CREATE INDEX idx_performance_snapshots_date ON performance_snapshots(date);

-- Change Intents: Track SEO change intents before application
CREATE TABLE change_intents (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  site_id     TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  page_id     TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  intent_type change_intent_type NOT NULL,
  payload     JSONB NOT NULL,
  status      change_intent_status NOT NULL DEFAULT 'PENDING',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_at  TIMESTAMPTZ
);
CREATE INDEX idx_change_intents_site_status ON change_intents(site_id, status);
CREATE INDEX idx_change_intents_page_status ON change_intents(page_id, status);
CREATE INDEX idx_change_intents_status ON change_intents(status);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE gsc_keyword_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE gsc_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE content ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE autopilot_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_intents ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (auth_id = auth.uid()::text);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth_id = auth.uid()::text);

-- Sites: users can only see/manage their own sites
CREATE POLICY "Users can view own sites"
  ON sites FOR SELECT
  USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()::text));

CREATE POLICY "Users can insert own sites"
  ON sites FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()::text));

CREATE POLICY "Users can update own sites"
  ON sites FOR UPDATE
  USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()::text));

CREATE POLICY "Users can delete own sites"
  ON sites FOR DELETE
  USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()::text));

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sites_updated_at
  BEFORE UPDATE ON sites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_keywords_updated_at
  BEFORE UPDATE ON keywords
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gsc_properties_updated_at
  BEFORE UPDATE ON gsc_properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_updated_at
  BEFORE UPDATE ON content
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prompts_updated_at
  BEFORE UPDATE ON prompts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_autopilot_runs_updated_at
  BEFORE UPDATE ON autopilot_runs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pages_updated_at
  BEFORE UPDATE ON pages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
