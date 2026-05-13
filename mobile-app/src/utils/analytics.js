
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
export const trackPurchase = (amount, currency, packageName) => {
    try {
        const logger = getLogger();
        if (logger) {
            logger.logPurchase(Number(amount), currency, { package_name: packageName });
            console.log(`[META_ADS] Tracked Purchase: ${amount} ${currency} (${packageName})`);
        }
    } catch (error) {
        console.warn(`[META_ADS] Purchase tracking failed:`, error.message);
    }
};

/**
 * Track profile views or swipes
 */
export const trackDiscovery = (type) => {
    trackEvent('DiscoveryAction', { action_type: type });
};
