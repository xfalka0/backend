import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';

// REVENUECAT API KEYS (Replace with real keys from RevenueCat Dashboard)
const RC_API_KEYS = {
    apple: '',
    google: 'goog_EerPgzQtDpetwESLvIcHjFeiDXG', // Android Anahtarı Eklendi
};

export const PurchaseService = {
    init: async (userId) => {
        try {
            if (__DEV__) {
                Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
            }

            if (Platform.OS === 'ios') {
                if (!RC_API_KEYS.apple) {
                    throw new Error('RevenueCat iOS API anahtarı yapılandırılmamış.');
                }
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

            // Meta Ads Tracking
            try {
                const { trackPurchase } = require('../utils/analytics');
                const price = pack.product.price;
                const currency = pack.product.currencyCode || 'TRY';
                const packageName = pack.product.identifier;
                trackPurchase(price, currency, packageName);
            } catch (trackErr) {
                console.error('[META_ADS] Purchase tracking error:', trackErr);
            }

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

    purchaseProductByIdentifier: async (productIdentifier, type = 'INAPP') => {
        try {
            const purchaseType = type === 'SUBS' ? Purchases.PURCHASE_TYPE.SUBS : Purchases.PURCHASE_TYPE.INAPP;
            console.log(`[Purchases] Fetching product details for ${productIdentifier} (${purchaseType})...`);

            const products = await Purchases.getProducts([productIdentifier], purchaseType);
            if (products && products.length > 0) {
                const storeProduct = products[0];
                console.log(`[Purchases] Found storeProduct: ${storeProduct.identifier}, defaultOption: ${storeProduct.defaultOption?.id || 'none'}`);

                let purchaseResult;
                if (type === 'SUBS' && storeProduct.defaultOption) {
                    console.log(`[Purchases] Purchasing via purchaseSubscriptionOption...`);
                    purchaseResult = await Purchases.purchaseSubscriptionOption(storeProduct.defaultOption);
                } else if (Purchases.purchaseStoreProduct) {
                    console.log(`[Purchases] Purchasing via purchaseStoreProduct...`);
                    purchaseResult = await Purchases.purchaseStoreProduct(storeProduct);
                } else {
                    purchaseResult = await Purchases.purchaseProduct(productIdentifier, null, purchaseType);
                }
                return { success: true, customerInfo: purchaseResult.customerInfo };
            }

            console.log(`[Purchases] getProducts returned empty list, using purchaseProduct fallback for ${productIdentifier}...`);
            const { customerInfo } = await Purchases.purchaseProduct(productIdentifier, null, purchaseType);
            return { success: true, customerInfo };
        } catch (e) {
            if (!e.userCancelled) {
                console.log('[Purchases] Direct Product Purchase Error:', e);
                return { success: false, error: e.message };
            }
            return { success: false, cancelled: true };
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
