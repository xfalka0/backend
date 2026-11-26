-- Migration: 20261126_03_subscription_events.sql
-- Purpose: RevenueCat abonelik yaşam döngüsü olaylarını (INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION, BILLING_ISSUE) saklamak.

DO $$
DECLARE
    uid_type TEXT;
BEGIN
    SELECT format_type(atttypid, atttypmod) INTO uid_type
    FROM pg_attribute
    WHERE attrelid = 'users'::regclass AND attname = 'id' AND NOT attisdropped;

    EXECUTE format($sql$
        CREATE TABLE IF NOT EXISTS subscription_events (
            id BIGSERIAL PRIMARY KEY,
            event_id VARCHAR(255) UNIQUE NOT NULL,
            user_id %s REFERENCES users(id) ON DELETE SET NULL,
            app_user_id VARCHAR(255),
            event_type VARCHAR(80) NOT NULL,
            product_id VARCHAR(120),
            duration_months INTEGER,
            transaction_id VARCHAR(255),
            original_transaction_id VARCHAR(255),
            price NUMERIC(12, 2),
            currency VARCHAR(16),
            store VARCHAR(40),
            environment VARCHAR(32),
            cancel_reason VARCHAR(120),
            expiration_at TIMESTAMP WITH TIME ZONE,
            raw_payload JSONB,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
    $sql$, uid_type);
END $$;

CREATE INDEX IF NOT EXISTS idx_sub_events_type_created ON subscription_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sub_events_user_created ON subscription_events(user_id, created_at DESC);
