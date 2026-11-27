const normalizeSourceName = (raw) => {
    const val = String(raw || '').trim().toLowerCase();
    if (!val) return null;
    if (['meta', 'facebook', 'fb', 'instagram', 'ig', 'fb_ads', 'ig_ads', 'facebook_ads', 'meta_ads'].includes(val)) {
        return 'meta';
    }
    if (['google', 'google_ads', 'adwords', 'google_play', 'gads'].includes(val)) {
        return 'google';
    }
    if (['tiktok', 'tt', 'tiktok_ads'].includes(val)) {
        return 'tiktok';
    }
    return val.slice(0, 100);
};

const parseInstallReferrer = (referrer) => {
    const out = { utmSource: null, utmMedium: null, utmCampaign: null, inferredSource: null };
    if (!referrer || typeof referrer !== 'string') return out;

    let raw = referrer.trim();
    if (!raw) return out;
    try {
        // Bazen çift encode edilmiş olabiliyor
        if (raw.includes('%3D') || raw.includes('%26')) {
            raw = decodeURIComponent(raw);
        }
    } catch (_) {
        // ignore decode error
    }

    const queryPart = raw.includes('?') ? raw.split('?').slice(1).join('?') : raw;
    try {
        const params = new URLSearchParams(queryPart);
        out.utmSource = params.get('utm_source') || params.get('source') || null;
        out.utmMedium = params.get('utm_medium') || null;
        out.utmCampaign = params.get('utm_campaign') || params.get('campaign') || null;

        if (!out.utmSource) {
            if (params.get('fbclid')) out.inferredSource = 'meta';
            else if (params.get('gclid')) out.inferredSource = 'google';
            else if (params.get('ttclid')) out.inferredSource = 'tiktok';
        }
    } catch (_) {
        // ignore parse error
    }

    if (!out.utmSource && !out.inferredSource) {
        const lower = raw.toLowerCase();
        if (lower.includes('facebook') || lower.includes('instagram') || lower.includes('fbclid') || lower.includes('meta')) {
            out.inferredSource = 'meta';
        } else if (lower.includes('gclid') || lower.includes('google')) {
            out.inferredSource = 'google';
        } else if (lower.includes('tiktok') || lower.includes('ttclid')) {
            out.inferredSource = 'tiktok';
        }
    }

    return out;
};

async function saveOptionalRegistrationMeta(db, userId, body = {}) {
    try {
        const referrer = body.installReferrer || body.install_referrer || null;
        const parsedRef = parseInstallReferrer(referrer);

        const utmSource = (body.utmSource || body.utm_source || parsedRef.utmSource || null);
        const utmMedium = (body.utmMedium || body.utm_medium || parsedRef.utmMedium || null);
        const utmCampaign = (body.utmCampaign || body.utm_campaign || parsedRef.utmCampaign || null);
        const appVersion = body.appVersion || body.app_version || null;

        const rawAcq =
            body.acquisitionSource ||
            body.acquisition_source ||
            utmSource ||
            parsedRef.inferredSource ||
            (body.referralCode ? 'referans' : null);

        const acq = normalizeSourceName(rawAcq);

        if (acq || utmSource || utmMedium || utmCampaign || referrer || appVersion) {
            await db.query(
                `UPDATE users
                 SET acquisition_source = COALESCE(NULLIF(TRIM(acquisition_source), ''), $1),
                     utm_source = COALESCE(NULLIF(TRIM(utm_source), ''), $2),
                     utm_medium = COALESCE(NULLIF(TRIM(utm_medium), ''), $3),
                     utm_campaign = COALESCE(NULLIF(TRIM(utm_campaign), ''), $4),
                     install_referrer = COALESCE(NULLIF(TRIM(install_referrer), ''), $5),
                     app_version = COALESCE($6, app_version)
                 WHERE id = $7`,
                [
                    acq,
                    utmSource ? String(utmSource).slice(0, 120) : null,
                    utmMedium ? String(utmMedium).slice(0, 120) : null,
                    utmCampaign ? String(utmCampaign).slice(0, 150) : null,
                    referrer ? String(referrer) : null,
                    appVersion ? String(appVersion).slice(0, 40) : null,
                    userId,
                ]
            );
        }
    } catch (_) {
        // Migration not yet applied on DB
    }
}

async function touchUserSession(db, userId, body = {}) {
    try {
        const appVersion = body?.appVersion || body?.app_version || null;
        const platform = body?.platform || null;
        await db.query(
            `INSERT INTO user_sessions (user_id, session_date, app_version, platform)
             VALUES ($1, (NOW() AT TIME ZONE 'Europe/Istanbul')::date, $2, $3)
             ON CONFLICT (user_id, session_date)
             DO UPDATE SET last_seen_at = NOW(), app_version = COALESCE(EXCLUDED.app_version, user_sessions.app_version)`,
            [userId, appVersion ? String(appVersion).slice(0, 40) : null, platform ? String(platform).slice(0, 30) : null]
        );
    } catch (_) {
        // user_sessions migration not applied yet
    }
}

module.exports = {
    normalizeSourceName,
    parseInstallReferrer,
    saveOptionalRegistrationMeta,
    touchUserSession,
};

