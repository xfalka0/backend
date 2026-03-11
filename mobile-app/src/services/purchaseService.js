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

            // Log for debugging
            console.log('[Purchases] All Offerings:', Object.keys(offerings.all));

            if (offerings.current !== null) {
                return offerings.current.availablePackages;
            } else if (offerings.all && Object.keys(offerings.all).length > 0) {
                // Fallback to the first available offering if "Current" is not set in dashboard
                const firstOfferingKey = Object.keys(offerings.all)[0];
                return offerings.all[firstOfferingKey].availablePackages;
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

            // For consumable coin packages, the fact that we reached here means the store accepted the payment.
            // We return success so the app can sync with our backend.
            return { success: true, customerInfo };
        } catch (e) {
            if (!e.userCancelled) {
                console.log('[Purchases] Purchase Error Info:', e);
                // Check for pending payment error (code 24 in RevenueCat/Google Play)
                if (e.code === Purchases.PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR ||
                    e.message?.toLowerCase().includes('pending')) {
                    return { success: false, pending: true, error: 'Ödemeniz şu an işleniyor. Onaylandığında bakiyeniz eklenecektir.' };
                }
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
