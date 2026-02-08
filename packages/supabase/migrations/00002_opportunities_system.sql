-- ============================================================================
-- Opportunities System — Track keywords ranking #11-20 with traffic potential
-- ============================================================================

-- Projects table: WordPress sites with their DataForSEO credentials
CREATE TABLE projects (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  site_id           TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  wp_url            TEXT NOT NULL,                    -- WordPress site URL
  dataforseo_domain TEXT NOT NULL,                    -- Domain for DataForSEO API
  dataforseo_location_code INTEGER DEFAULT 2840,      -- US by default (2840)
  dataforseo_language_code TEXT DEFAULT 'en',
  is_active         BOOLEAN NOT NULL DEFAULT true,
  last_synced_at    TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(site_id, wp_url)
);

CREATE INDEX idx_projects_site_id ON projects(site_id);
CREATE INDEX idx_projects_is_active ON projects(is_active);

-- Opportunities table: Keywords ranking #11-20 with traffic gain potential
CREATE TABLE opportunities (
  id                        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id                TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  keyword                   TEXT NOT NULL,
  current_position          INTEGER NOT NULL CHECK (current_position BETWEEN 11 AND 20),
  target_url                TEXT NOT NULL,                -- URL currently ranking
  search_volume             INTEGER NOT NULL,             -- Monthly search volume
  current_traffic           REAL NOT NULL,                -- Estimated current monthly traffic
  potential_traffic_pos_1   REAL NOT NULL,                -- Traffic if moved to position 1
  traffic_gain              REAL NOT NULL,                -- potential - current
  traffic_gain_percentage   REAL NOT NULL,                -- (gain / current) * 100
  cpc                       REAL,                         -- Cost per click (if available)
  competition               REAL,                         -- 0-1 competition score
  keyword_difficulty        INTEGER,                      -- 0-100 difficulty score
  ranking_page_title        TEXT,                         -- Title of the ranking page
  ranking_page_description  TEXT,                         -- Meta description
  opportunity_score         REAL NOT NULL,                -- Weighted score (volume * gain * ease)
  priority                  TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status                    TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'dismissed')),
  notes                     TEXT,
  discovered_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_checked_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at              TIMESTAMPTZ,

  UNIQUE(project_id, keyword)
);

CREATE INDEX idx_opportunities_project_id ON opportunities(project_id);
CREATE INDEX idx_opportunities_status ON opportunities(status);
CREATE INDEX idx_opportunities_priority ON opportunities(priority);
CREATE INDEX idx_opportunities_opportunity_score ON opportunities(opportunity_score DESC);
CREATE INDEX idx_opportunities_current_position ON opportunities(current_position);
CREATE INDEX idx_opportunities_traffic_gain ON opportunities(traffic_gain DESC);

-- Opportunity Actions: Track changes made to capitalize on opportunities
CREATE TABLE opportunity_actions (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  opportunity_id  TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  action_type     TEXT NOT NULL CHECK (action_type IN ('content_update', 'meta_optimization', 'schema_added', 'internal_links', 'backlinks', 'other')),
  description     TEXT NOT NULL,
  executed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  executed_by     TEXT,                                 -- User or 'system'
  metadata        JSONB                                 -- Additional context
);

CREATE INDEX idx_opportunity_actions_opportunity_id ON opportunity_actions(opportunity_id);
CREATE INDEX idx_opportunity_actions_action_type ON opportunity_actions(action_type);

-- Opportunity Position History: Track ranking changes over time
CREATE TABLE opportunity_position_history (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  opportunity_id  TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  position        INTEGER NOT NULL,
  search_volume   INTEGER NOT NULL,
  traffic         REAL NOT NULL,
  checked_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_opportunity_position_history_opportunity_id ON opportunity_position_history(opportunity_id);
CREATE INDEX idx_opportunity_position_history_checked_at ON opportunity_position_history(checked_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_position_history ENABLE ROW LEVEL SECURITY;

-- Projects: Users can only see their own projects
CREATE POLICY "Users can view own projects"
  ON projects FOR SELECT
  USING (site_id IN (
    SELECT s.id FROM sites s
    INNER JOIN users u ON u.id = s.user_id
    WHERE u.auth_id = auth.uid()::text
  ));

CREATE POLICY "Users can insert own projects"
  ON projects FOR INSERT
  WITH CHECK (site_id IN (
    SELECT s.id FROM sites s
    INNER JOIN users u ON u.id = s.user_id
    WHERE u.auth_id = auth.uid()::text
  ));

CREATE POLICY "Users can update own projects"
  ON projects FOR UPDATE
  USING (site_id IN (
    SELECT s.id FROM sites s
    INNER JOIN users u ON u.id = s.user_id
    WHERE u.auth_id = auth.uid()::text
  ));

CREATE POLICY "Users can delete own projects"
  ON projects FOR DELETE
  USING (site_id IN (
    SELECT s.id FROM sites s
    INNER JOIN users u ON u.id = s.user_id
    WHERE u.auth_id = auth.uid()::text
  ));

-- Opportunities: Users can only see opportunities for their own projects
CREATE POLICY "Users can view own opportunities"
  ON opportunities FOR SELECT
  USING (project_id IN (
    SELECT p.id FROM projects p
    INNER JOIN sites s ON s.id = p.site_id
    INNER JOIN users u ON u.id = s.user_id
    WHERE u.auth_id = auth.uid()::text
  ));

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to calculate opportunity score
-- Score = (search_volume * traffic_gain * ease_factor) / 1000
-- ease_factor = 1.0 for position 11, decreasing to 0.5 for position 20
CREATE OR REPLACE FUNCTION calculate_opportunity_score(
  search_vol INTEGER,
  traffic_gain_val REAL,
  current_pos INTEGER
)
RETURNS REAL AS $$
DECLARE
  ease_factor REAL;
BEGIN
  -- Easier to rank from position 11 than position 20
  ease_factor := 1.0 - ((current_pos - 11) * 0.05);
  RETURN (search_vol * traffic_gain_val * ease_factor) / 1000.0;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to auto-assign priority based on opportunity score
CREATE OR REPLACE FUNCTION assign_priority_from_score(score REAL)
RETURNS TEXT AS $$
BEGIN
  IF score >= 100 THEN
    RETURN 'critical';
  ELSIF score >= 50 THEN
    RETURN 'high';
  ELSIF score >= 20 THEN
    RETURN 'medium';
  ELSE
    RETURN 'low';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
