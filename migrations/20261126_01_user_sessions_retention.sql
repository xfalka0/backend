-- Migration: 20261126_01_user_sessions_retention.sql
-- Purpose: Gerçek D1/D7/D30 geri dönüş (retention) ve uygulama sürümü takibi için günlük oturum tablosu.
-- Note: users.id tipi (INTEGER veya UUID) dinamik tespit edilir.

DO $$
DECLARE
    uid_type TEXT;
BEGIN
    SELECT format_type(atttypid, atttypmod) INTO uid_type
    FROM pg_attribute
    WHERE attrelid = 'users'::regclass AND attname = 'id' AND NOT attisdropped;

    EXECUTE format($sql$
        CREATE TABLE IF NOT EXISTS user_sessions (
            id BIGSERIAL PRIMARY KEY,
            user_id %s NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            session_date DATE NOT NULL,
            first_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            app_version VARCHAR(40),
            platform VARCHAR(20),
            CONSTRAINT uq_user_sessions_user_day UNIQUE (user_id, session_date)
        )
    $sql$, uid_type);
END $$;

CREATE INDEX IF NOT EXISTS idx_user_sessions_date ON user_sessions(session_date DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_date ON user_sessions(user_id, session_date DESC);
