-- Migration: Add agent tables
-- Created: 2026-05-16

-- Agent runs table
CREATE TABLE IF NOT EXISTS agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  trigger_type VARCHAR(30) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'RUNNING',
  observations JSONB DEFAULT '{}',
  plan JSONB DEFAULT '{}',
  actions JSONB DEFAULT '[]',
  reflection JSONB DEFAULT '{}',
  safety_level_used VARCHAR(30) NOT NULL,
  admin_approvals JSONB DEFAULT '[]',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_group_id ON agent_runs(group_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON agent_runs(status);
CREATE INDEX IF NOT EXISTS idx_agent_runs_started_at ON agent_runs(started_at);

-- Recommendations table
CREATE TABLE IF NOT EXISTS recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  agent_run_id UUID REFERENCES agent_runs(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  action JSONB NOT NULL,
  reason TEXT NOT NULL,
  triggered_by TEXT NOT NULL,
  admin_response JSONB,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_recommendations_group_id ON recommendations(group_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_status ON recommendations(status);
CREATE INDEX IF NOT EXISTS idx_recommendations_type ON recommendations(type);
CREATE INDEX IF NOT EXISTS idx_recommendations_created_at ON recommendations(created_at);

-- Autonomous agent policies table
CREATE TABLE IF NOT EXISTS autonomous_agent_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE UNIQUE,
  enabled VARCHAR(10) NOT NULL DEFAULT 'false',
  mode VARCHAR(30) NOT NULL DEFAULT 'RECOMMEND_ONLY',
  allow_auto_policy_tuning VARCHAR(10) NOT NULL DEFAULT 'false',
  allow_auto_domain_blocking VARCHAR(10) NOT NULL DEFAULT 'false',
  allow_auto_lockdown VARCHAR(10) NOT NULL DEFAULT 'false',
  allow_auto_reports VARCHAR(10) NOT NULL DEFAULT 'true',
  max_actions_per_hour INTEGER NOT NULL DEFAULT 20,
  require_human_approval_for_high_impact VARCHAR(10) NOT NULL DEFAULT 'true',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_autonomous_agent_policies_group_id ON autonomous_agent_policies(group_id);