-- Migration: 20261127_01_locked_photo_promos.sql
-- Purpose: Kilitli fotoğraf havuzu, otomatik gönderim/açılma/satış dönüşüm takibi ve ayarlar.

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_locked_promo_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_hook_sent_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS locked_photo_pool (
    id SERIAL PRIMARY KEY,
    title VARCHAR(150),
    image_url TEXT NOT NULL,
    unlock_cost INTEGER NOT NULL DEFAULT 100,
    pre_message TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sent_count INTEGER NOT NULL DEFAULT 0,
    insufficient_hits INTEGER NOT NULL DEFAULT 0,
    unlock_count INTEGER NOT NULL DEFAULT 0,
    purchase_conversion_count INTEGER NOT NULL DEFAULT 0,
    conversion_revenue NUMERIC(12, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_locked_promo_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    default_unlock_cost INTEGER NOT NULL DEFAULT 100,
    daily_cap INTEGER NOT NULL DEFAULT 1,
    active_start_hour INTEGER NOT NULL DEFAULT 19,
    active_end_hour INTEGER NOT NULL DEFAULT 1,
    offline_start_minute INTEGER NOT NULL DEFAULT 1170,
    offline_end_minute INTEGER NOT NULL DEFAULT 1320,
    min_inactive_hours INTEGER NOT NULL DEFAULT 2,
    max_inactive_days INTEGER NOT NULL DEFAULT 7,
    numara_cooldown_hours INTEGER NOT NULL DEFAULT 18,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_admin_locked_promo_settings_singleton CHECK (id = 1)
);

INSERT INTO admin_locked_promo_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
    uid_type TEXT;
    cid_type TEXT;
    mid_type TEXT;
BEGIN
    SELECT format_type(atttypid, atttypmod) INTO uid_type
    FROM pg_attribute
    WHERE attrelid = 'users'::regclass AND attname = 'id' AND NOT attisdropped;

    SELECT format_type(atttypid, atttypmod) INTO cid_type
    FROM pg_attribute
    WHERE attrelid = 'chats'::regclass AND attname = 'id' AND NOT attisdropped;

    SELECT format_type(atttypid, atttypmod) INTO mid_type
    FROM pg_attribute
    WHERE attrelid = 'messages'::regclass AND attname = 'id' AND NOT attisdropped;

    EXECUTE format($sql$
        CREATE TABLE IF NOT EXISTS locked_photo_deliveries (
            id BIGSERIAL PRIMARY KEY,
            photo_id INTEGER NOT NULL REFERENCES locked_photo_pool(id) ON DELETE CASCADE,
            user_id %s NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            operator_id %s REFERENCES users(id) ON DELETE SET NULL,
            chat_id %s REFERENCES chats(id) ON DELETE SET NULL,
            pre_message_id %s REFERENCES messages(id) ON DELETE SET NULL,
            message_id %s REFERENCES messages(id) ON DELETE SET NULL,
            trigger_type VARCHAR(32) NOT NULL,
            pre_message_text TEXT,
            unlock_cost INTEGER NOT NULL DEFAULT 100,
            is_unlocked BOOLEAN NOT NULL DEFAULT FALSE,
            unlocked_at TIMESTAMPTZ,
            insufficient_funds_hit_at TIMESTAMPTZ,
            converted_to_purchase BOOLEAN NOT NULL DEFAULT FALSE,
            converted_payment_id TEXT,
            converted_amount NUMERIC(12, 2),
            converted_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    $sql$, uid_type, uid_type, cid_type, mid_type, mid_type);
END $$;

CREATE INDEX IF NOT EXISTS idx_locked_photo_deliveries_user_date
    ON locked_photo_deliveries(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_locked_photo_deliveries_user_photo
    ON locked_photo_deliveries(user_id, photo_id);
CREATE INDEX IF NOT EXISTS idx_locked_photo_deliveries_message
    ON locked_photo_deliveries(message_id);

