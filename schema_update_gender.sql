-- UYARI: Bu migration'ı çalıştırmadan önce mutlaka veritabanı yedeği alınız.
-- ÖRNEK KOMUT: pg_dump -U myuser -h myhost -d mydb > mydb_backup.sql

-- 1. Tabloya yeni kolonlar ekleme
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender_confirmed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender_change_count INTEGER DEFAULT 0;

-- 2. Cinsiyet değişiklik log tablosu
CREATE TABLE IF NOT EXISTS gender_changes (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    old_gender VARCHAR(30),
    new_gender VARCHAR(30),
    source VARCHAR(50), -- 'onboarding', 'confirm', 'admin'
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
