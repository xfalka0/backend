import { Platform, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import Constants from 'expo-constants';

const STORAGE_KEY = 'install_attribution_meta_v1';
let cachedMeta = null;

const getAppVersion = () => {
    try {
        return (
            Application.nativeApplicationVersion ||
            Constants.expoConfig?.version ||
            Constants.manifest2?.extra?.expoClient?.version ||
            null
        );
    } catch (_) {
        return null;
    }
};

const parseQueryParams = (rawString) => {
    const result = { utmSource: null, utmMedium: null, utmCampaign: null, inferredSource: null };
    if (!rawString || typeof rawString !== 'string') return result;

    let decoded = rawString.trim();
    try {
        if (decoded.includes('%3D') || decoded.includes('%26')) {
            decoded = decodeURIComponent(decoded);
        }
    } catch (_) {
        // ignore
    }

    const queryPart = decoded.includes('?') ? decoded.split('?').slice(1).join('?') : decoded;
    try {
        const params = new URLSearchParams(queryPart);
        result.utmSource = params.get('utm_source') || params.get('source') || null;
        result.utmMedium = params.get('utm_medium') || null;
        result.utmCampaign = params.get('utm_campaign') || params.get('campaign') || null;
        if (!result.utmSource) {
            if (params.get('fbclid')) result.inferredSource = 'meta';
            else if (params.get('gclid')) result.inferredSource = 'google';
            else if (params.get('ttclid')) result.inferredSource = 'tiktok';
        }
    } catch (_) {
        // ignore
    }

    return result;
};

const withTimeout = (promise, ms = 1500) =>
    Promise.race([
        promise,
        new Promise((resolve) => setTimeout(() => resolve(null), ms)),
    ]);

/**
 * Google Play Install Referrer, Deep Link UTM parametreleri ve uygulama sürümünü toplar.
 * Hata durumunda asla auth akışını bloklamaz.
 */
export const getRegistrationMeta = async () => {
    const appVersion = getAppVersion();
    const platform = Platform.OS;

    if (cachedMeta) {
        return { ...cachedMeta, appVersion, platform };
    }

    try {
        const storedRaw = await AsyncStorage.getItem(STORAGE_KEY);
        if (storedRaw) {
            const parsed = JSON.parse(storedRaw);
            if (parsed && (parsed.installReferrer || parsed.utmSource || parsed.acquisitionSource)) {
                cachedMeta = parsed;
                return { ...parsed, appVersion, platform };
            }
        }
    } catch (_) {
        // ignore storage read error
    }

    let installReferrer = null;
    if (Platform.OS === 'android' && typeof Application.getInstallReferrerAsync === 'function') {
        try {
            const ref = await withTimeout(Application.getInstallReferrerAsync(), 1500);
            if (ref && typeof ref === 'string' && ref.trim()) {
                installReferrer = ref.trim();
            }
        } catch (_) {
            // Expo Go veya Play Store dışı kurulumlarda normaldir
        }
    }

    let initialUrl = null;
    try {
        initialUrl = await withTimeout(Linking.getInitialURL(), 800);
    } catch (_) {
        // ignore
    }

    const fromRef = parseQueryParams(installReferrer);
    const fromLink = parseQueryParams(initialUrl);

    const utmSource = fromRef.utmSource || fromLink.utmSource || null;
    const utmMedium = fromRef.utmMedium || fromLink.utmMedium || null;
    const utmCampaign = fromRef.utmCampaign || fromLink.utmCampaign || null;
    const acquisitionSource = utmSource || fromRef.inferredSource || fromLink.inferredSource || null;

    const meta = {
        acquisitionSource,
        utmSource,
        utmMedium,
        utmCampaign,
        installReferrer,
    };

    cachedMeta = meta;
    try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
    } catch (_) {
        // ignore storage write error
    }

    return { ...meta, appVersion, platform };
};

