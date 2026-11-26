
/**
 * Helper to safely require and use AppEventsLogger
 * This prevents crashes in Expo Go environments
 */
const getLogger = () => {
    try {
        const { AppEventsLogger } = require('react-native-fbsdk-next');
        return AppEventsLogger;
    } catch (e) {
        return null;
    }
};

/**
 * Custom analytics tracking for Meta Ads
 */
export const trackEvent = (eventName, params = {}) => {
    try {
        const logger = getLogger();
        if (logger) {
            logger.logEvent(eventName, params);
            console.log(`[META_ADS] Tracked: ${eventName}`, params);
        }
    } catch (error) {
        console.warn(`[META_ADS] Tracking failed for ${eventName}:`, error.message);
    }
};

/**
 * Track user registration
 */
export const trackRegistration = (method = 'unknown') => {
    trackEvent('CompletedRegistration', { registration_method: method });
};

/**
 * Track coin purchases
 */
export const trackPurchase = (amount, currency = 'TRY', packageName = '') => {
    try {
        const logger = getLogger();
        if (logger) {
            const parsedAmount = Number(amount);
            const safeAmount = Number.isFinite(parsedAmount) && parsedAmount >= 0 ? parsedAmount : 0;
            const safeCurrency = (currency || 'TRY').toString().toUpperCase();
            logger.logPurchase(safeAmount, safeCurrency, { package_name: packageName || 'unknown' });
            console.log(`[META_ADS] Tracked Purchase: ${safeAmount} ${safeCurrency} (${packageName})`);
        }
    } catch (error) {
        console.warn(`[META_ADS] Purchase tracking failed:`, error.message);
    }
};

/**
 * Track when a user runs out of coins / free messages
 */
export const trackFreeMessagesExhausted = (params = {}) => {
    trackEvent('FreeMessagesExhausted', params);
};

/**
 * Track profile views or swipes
 */
export const trackDiscovery = (type) => {
    trackEvent('DiscoveryAction', { action_type: type });
};
