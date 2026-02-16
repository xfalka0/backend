import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';

// REVENUECAT API KEYS (Replace with real keys from RevenueCat Dashboard)
const RC_API_KEYS = {
    apple: 'goog_placeholder_ios_key', // iOS için henüz anahtar gelmedi
    google: 'goog_EerPgzQtDpetwESLvIcHjFeiDXG', // Android Anahtarı Eklendi
};

export const PurchaseService = {
    init: async (userId) => {
        try {
            Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);

            if (Platform.OS === 'ios') {
                await Purchases.configure({ apiKey: RC_API_KEYS.apple, appUserID: userId });
            } else if (Platform.OS === 'android') {
                await Purchases.configure({ apiKey: RC_API_KEYS.google, appUserID: userId });
            }

            console.log('[Purchases] Configured for user:', userId);
        } catch (e) {
            console.error('[Purchases] Initialization Error:', e);
        }
    },

    getOfferings: async () => {
        try {
            const offerings = await Purchases.getOfferings();
            if (offerings.current !== null) {
                return offerings.current.availablePackages;
            }
            return [];
        } catch (e) {
            console.error('[Purchases] Error fetching offerings:', e);
            return [];
        }
    },

    purchasePackage: async (pack) => {
        try {
            const { customerInfo, productIdentifier } = await Purchases.purchasePackage(pack);

            // Check if entitlement 'pro' (or whatever you named it) is active
            if (customerInfo.entitlements.active['pro'] !== undefined) {
                return { success: true, customerInfo };
            }

            return { success: false, error: 'Entitlement not active' };
        } catch (e) {
            if (!e.userCancelled) {
                console.error('[Purchases] Purchase Error:', e);
            }
            return { success: false, error: e.message, cancelled: e.userCancelled };
        }
    },

    getCustomerInfo: async () => {
        try {
            return await Purchases.getCustomerInfo();
        } catch (e) {
            console.error('[Purchases] Error fetching customer info:', e);
            return null;
        }
    },

    restorePurchases: async () => {
        try {
            return await Purchases.restorePurchases();
        } catch (e) {
            console.error('[Purchases] Error restoring purchases:', e);
            return null;
        }
    }
};
