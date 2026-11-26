-- Migration: 20261126_02_acquisition_and_ad_spends.sql
-- Purpose: Kayıt kaynağı (kampanya/utm/install_referrer/sürüm) ve reklam harcaması takibi.
-- Geçmiş kullanıcı satırları NULL kalır; panelde "bilinmiyor" olarak gösterilir.

ALTER TABLE users ADD COLUMN IF NOT EXISTS acquisition_source VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS utm_source VARCHAR(120);
ALTER TABLE users ADD COLUMN IF NOT EXISTS utm_medium VARCHAR(120);
ALTER TABLE users ADD COLUMN IF NOT EXISTS utm_campaign VARCHAR(150);
ALTER TABLE users ADD COLUMN IF NOT EXISTS install_referrer TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS app_version VARCHAR(40);

CREATE INDEX IF NOT EXISTS idx_users_acquisition_source ON users(acquisition_source);

CREATE TABLE IF NOT EXISTS ad_spends (
    id SERIAL PRIMARY KEY,
    spend_date DATE NOT NULL,
    source VARCHAR(120) NOT NULL,
    campaign VARCHAR(150) DEFAULT '',
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_spends_date_source ON ad_spends(spend_date DESC, source);
