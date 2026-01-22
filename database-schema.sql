-- Promagen Users Database Schema
-- Run this SQL in your Neon dashboard (SQL Editor) to create the required tables.
--
-- Authority: docs/authority/ribbon-homepage.md § Promagen Users
-- Created: January 22, 2026
--
-- NOTE: These tables will also be auto-created by the cron job on first run,
-- but running this manually lets you verify the schema is correct.

-- ============================================================================
-- Table 1: provider_activity_events (raw click/activity events)
-- This table is populated by the /go/[providerId] route on every outbound click.
-- ============================================================================
CREATE TABLE IF NOT EXISTS provider_activity_events (
    click_id TEXT NOT NULL PRIMARY KEY,
    provider_id TEXT NOT NULL,
    event_type TEXT NOT NULL DEFAULT 'open',
    src TEXT,
    user_id TEXT,
    country_code TEXT,
    ip TEXT,
    user_agent TEXT,
    is_affiliate BOOLEAN DEFAULT FALSE,
    destination TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient aggregation queries
CREATE INDEX IF NOT EXISTS idx_provider_activity_events_aggregation
ON provider_activity_events (provider_id, country_code, created_at);

-- Index for efficient lookups by click_id (already primary key, but explicit for clarity)
-- Primary key already creates this index

-- ============================================================================
-- Table 2: provider_country_usage_30d (per-provider aggregation)
-- This is the FIXED schema that groups by (provider_id, country_code).
-- Populated by the cron job every 30 minutes.
-- ============================================================================
CREATE TABLE IF NOT EXISTS provider_country_usage_30d (
    provider_id TEXT NOT NULL,
    country_code TEXT NOT NULL,
    users_count BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (provider_id, country_code)
);

-- Index for efficient lookups by provider (for the providers API)
CREATE INDEX IF NOT EXISTS idx_provider_country_usage_30d_provider
ON provider_country_usage_30d (provider_id);

-- ============================================================================
-- Table 3: promagen_users_cron_runs (observability log)
-- Tracks each cron run for debugging and monitoring.
-- ============================================================================
CREATE TABLE IF NOT EXISTS promagen_users_cron_runs (
    id TEXT NOT NULL PRIMARY KEY,
    ran_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ok BOOLEAN NOT NULL,
    message TEXT NULL,
    rows_affected BIGINT NOT NULL DEFAULT 0,
    providers_affected BIGINT NOT NULL DEFAULT 0
);

-- ============================================================================
-- Verification queries (run these after creating tables to confirm)
-- ============================================================================

-- Check tables exist:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- Check provider_activity_events structure:
-- \d provider_activity_events

-- Check provider_country_usage_30d structure:
-- \d provider_country_usage_30d

-- Check indexes:
-- SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public';
