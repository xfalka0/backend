-- Migration: 20261126_05_monthly_targets.sql
-- Purpose: Aylık gelir (₺) ve kayıt hedeflerini veritabanında saklamak.

CREATE TABLE IF NOT EXISTS monthly_targets (
    month_key VARCHAR(7) PRIMARY KEY,
    revenue_target NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (revenue_target >= 0),
    registrations_target INTEGER NOT NULL DEFAULT 0 CHECK (registrations_target >= 0),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
