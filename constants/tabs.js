/**
 * Shared Discovery Tabs Constants
 */

const DISCOVERY_TABS = {
    RECOMMENDED: 'recommended',
    ONLINE: 'online',
    NEW: 'new',
    POPULAR: 'popular'
};

const TAB_MAPPING = {
    // English
    'recommended': 'Önerilen',
    'all': 'Önerilen',
    'online': 'Çevrimiçi',
    'new': 'Yeni',
    'popular': 'Popüler',
    // Turkish & ASCII variants
    'önerilen': 'Önerilen',
    'onerilen': 'Önerilen',
    'çevrimiçi': 'Çevrimiçi',
    'cevrimici': 'Çevrimiçi',
    'yeni': 'Yeni',
    'popüler': 'Popüler',
    'populer': 'Popüler'
};

function resolveTab(rawTab) {
    if (!rawTab) return 'Önerilen';
    const key = String(rawTab).trim().toLowerCase();
    return TAB_MAPPING[key] || null;
}

const VALID_TABS = ['recommended', 'online', 'new', 'popular', 'önerilen', 'çevrimiçi', 'yeni', 'popüler'];

module.exports = {
    DISCOVERY_TABS,
    TAB_MAPPING,
    resolveTab,
    VALID_TABS
};

