-- Migration: 20261113_pre_release_security_and_constraints.sql
-- Description:
-- 1. processed_webhook_events table for RevenueCat webhook idempotency
-- 2. users table balance >= 0 check constraint

-- 1. Processed Webhook Events Table
CREATE TABLE IF NOT EXISTS processed_webhook_events (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(255) UNIQUE NOT NULL,
    app_user_id VARCHAR(255),
    event_type VARCHAR(100),
    product_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processed_webhook_events_event_id ON processed_webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_processed_webhook_events_app_user_id ON processed_webhook_events(app_user_id);

-- 2. Balance Non-Negative Constraint on users
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_user_balance_non_negative'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT check_user_balance_non_negative CHECK (balance >= 0);
    END IF;
END $$;
