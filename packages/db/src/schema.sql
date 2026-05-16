-- TOGI Database Schema
-- PostgreSQL with Drizzle ORM

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id BIGINT UNIQUE NOT NULL,
  username VARCHAR(255),
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  language_code VARCHAR(10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Groups table
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_chat_id BIGINT UNIQUE NOT NULL,
  title VARCHAR(255),
  type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  bot_admin_status VARCHAR(30) NOT NULL DEFAULT 'UNKNOWN',
  owner_telegram_user_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Group admins table
CREATE TABLE group_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  telegram_user_id BIGINT NOT NULL,
  role VARCHAR(20) NOT NULL,
  permissions JSONB DEFAULT '{}',
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(group_id, telegram_user_id)
);

-- Group policies table
CREATE TABLE group_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  mode VARCHAR(20) NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(group_id, mode)
);

-- Violations table
CREATE TABLE violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  telegram_user_id BIGINT,
  telegram_message_id BIGINT,
  violation_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  risk_score INTEGER NOT NULL,
  action VARCHAR(50) NOT NULL,
  reason TEXT,
  labels JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Punishments table
CREATE TABLE punishments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  telegram_user_id BIGINT NOT NULL,
  type VARCHAR(20) NOT NULL,
  until_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  source VARCHAR(20) NOT NULL DEFAULT 'AUTO',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Domain rules table
CREATE TABLE domain_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  domain VARCHAR(255) NOT NULL,
  rule_type VARCHAR(20) NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit logs table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  actor_telegram_user_id BIGINT,
  action VARCHAR(50) NOT NULL,
  target_type VARCHAR(50),
  target_id VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Message fingerprints table
CREATE TABLE message_fingerprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  telegram_user_id BIGINT,
  telegram_message_id BIGINT,
  text_hash VARCHAR(64) NOT NULL,
  link_domains JSONB DEFAULT '[]',
  risk_score INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_telegram_user_id ON users(telegram_user_id);
CREATE INDEX idx_groups_telegram_chat_id ON groups(telegram_chat_id);
CREATE INDEX idx_group_admins_group_id ON group_admins(group_id);
CREATE INDEX idx_group_policies_group_id ON group_policies(group_id);
CREATE INDEX idx_violations_group_id ON violations(group_id);
CREATE INDEX idx_violations_created_at ON violations(created_at DESC);
CREATE INDEX idx_punishments_group_id ON punishments(group_id);
CREATE INDEX idx_punishments_telegram_user_id ON punishments(telegram_user_id);
CREATE INDEX idx_punishments_status ON punishments(status);
CREATE INDEX idx_domain_rules_domain ON domain_rules(domain);
CREATE INDEX idx_domain_rules_group_id ON domain_rules(group_id);
CREATE INDEX idx_audit_logs_group_id ON audit_logs(group_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_message_fingerprints_group_id ON message_fingerprints(group_id);
CREATE INDEX idx_message_fingerprints_text_hash ON message_fingerprints(text_hash);

-- User Risk Profiles (Phase 07)
CREATE TABLE IF NOT EXISTS user_risk_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id BIGINT NOT NULL UNIQUE,
  global_risk_score INTEGER NOT NULL DEFAULT 0,
  total_violations INTEGER NOT NULL DEFAULT 0,
  severe_violations INTEGER NOT NULL DEFAULT 0,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_violation_at TIMESTAMPTZ,
  labels JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS user_risk_profiles_telegram_user_id_unique ON user_risk_profiles(telegram_user_id);

-- Group User Profiles (Phase 07)
CREATE TABLE IF NOT EXISTS group_user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  telegram_user_id BIGINT NOT NULL,
  trust_score INTEGER NOT NULL DEFAULT 50,
  risk_score INTEGER NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ,
  first_message_at TIMESTAMPTZ,
  message_count INTEGER NOT NULL DEFAULT 0,
  violation_count INTEGER NOT NULL DEFAULT 0,
  warning_count INTEGER NOT NULL DEFAULT 0,
  mute_count INTEGER NOT NULL DEFAULT 0,
  ban_count INTEGER NOT NULL DEFAULT 0,
  last_activity_at TIMESTAMPTZ,
  probation_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(group_id, telegram_user_id)
);
CREATE INDEX IF NOT EXISTS idx_group_user_profiles_group_id ON group_user_profiles(group_id);

-- Threat Indicators (Phase 07)
CREATE TABLE IF NOT EXISTS threat_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(30) NOT NULL,
  value_hash VARCHAR(64) NOT NULL UNIQUE,
  normalized_value VARCHAR(255),
  risk_score INTEGER NOT NULL DEFAULT 0,
  labels JSONB DEFAULT '[]',
  first_seen_group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  seen_count INTEGER NOT NULL DEFAULT 1,
  affected_group_count INTEGER NOT NULL DEFAULT 1,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL DEFAULT 'WATCH',
  source VARCHAR(20) NOT NULL DEFAULT 'AUTO'
);
CREATE INDEX IF NOT EXISTS idx_threat_indicators_type ON threat_indicators(type);
CREATE INDEX IF NOT EXISTS idx_threat_indicators_status ON threat_indicators(status);

-- Group Intelligence Settings (Phase 07)
CREATE TABLE IF NOT EXISTS group_intelligence_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE UNIQUE,
  consume_global_watchlist INTEGER NOT NULL DEFAULT 1,
  contribute_anonymous_signals INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
