-- Migration: 20261126_04_email_alerts_and_cron_logs.sql
-- Purpose: Gün sonu otomatik özet e-postası logları, eşik alarm ayarları ve tekrar önleyici alarm logları.

CREATE TABLE IF NOT EXISTS admin_alert_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    alert_revenue_drop_pct NUMERIC(5, 2) NOT NULL DEFAULT 50,
    alert_signup_spike_mult NUMERIC(5, 2) NOT NULL DEFAULT 3,
    alert_pending_support_limit INTEGER NOT NULL DEFAULT 20,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_admin_alert_settings_singleton CHECK (id = 1)
);

INSERT INTO admin_alert_settings (id, alert_revenue_drop_pct, alert_signup_spike_mult, alert_pending_support_limit)
VALUES (1, 50, 3, 20)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS daily_summary_runs (
    id BIGSERIAL PRIMARY KEY,
    run_date DATE NOT NULL,
    trigger_source VARCHAR(40) NOT NULL,
    status VARCHAR(30) NOT NULL,
    recipient VARCHAR(255),
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_summary_runs_date ON daily_summary_runs(run_date DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS alert_dispatch_logs (
    id BIGSERIAL PRIMARY KEY,
    alert_date DATE NOT NULL,
    alert_key VARCHAR(64) NOT NULL,
    metric_value NUMERIC(12, 2),
    threshold_value NUMERIC(12, 2),
    status VARCHAR(30) NOT NULL,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_alert_dispatch_once_per_day UNIQUE (alert_date, alert_key)
);
