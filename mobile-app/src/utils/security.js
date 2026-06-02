import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Safely require expo-screen-capture to prevent crashes in Expo Go or virtual emulators where the native module is missing
let ScreenCapture = null;
try {
    ScreenCapture = require('expo-screen-capture');
} catch (e) {
    console.warn('[SECURITY] expo-screen-capture native module is not available in this environment.');
}

/**
 * Checks if the current execution is running inside an emulator/simulator.
 * Excellent for preventing automated spammers from executing.
 */
export const isEmulator = () => {
    // During developer mode or testing, we may allow emulators.
    // In production, Device.isDevice is false for emulators.
    return !Device.isDevice;
};

/**
 * Toggles screenshot and screen recording blocking on iOS and Android.
 * Prevents leaks of premium operator profiles or chat conversations.
 * @param {boolean} enable 
 */
export const preventScreenshots = async (enable = true) => {
    try {
        if (!ScreenCapture || !ScreenCapture.preventScreenCaptureAsync) {
            console.log('[SECURITY] Screenshot protection bypassed (native module not loaded/Expo Go/Simulator).');
            return;
        }

        // Prevent captures on physical devices
        if (enable) {
            await ScreenCapture.preventScreenCaptureAsync();
            console.log('[SECURITY] Screenshot and recording protection ENABLED.');
        } else {
            await ScreenCapture.allowScreenCaptureAsync();
            console.log('[SECURITY] Screenshot and recording protection DISABLED.');
        }
    } catch (err) {
        console.warn('[SECURITY] Screenshot prevention update failed:', err.message);
    }
};
