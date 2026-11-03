-- ==========================================================
-- Migration: Add country column to users table
-- Target: Render PostgreSQL (Production Database)
-- Note: Prepared for execution. DO NOT EXECUTE AUTOMATICALLY.
-- ==========================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT NULL;

-- Index for country filtering if needed in future
CREATE INDEX IF NOT EXISTS idx_users_country ON users(country) WHERE country IS NOT NULL;

