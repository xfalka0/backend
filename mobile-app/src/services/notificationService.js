import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { API_URL } from '../config';

const FALLBACK_EAS_PROJECT_ID = '39f2753e-8bbe-487c-a7a8-e83a7cfe4d74';

// Configure how notifications are handled when the app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const NotificationService = {
  /**
   * Registers Android notification channel & push notifications and returns the Expo Push Token
   */
  registerForPushNotificationsAsync: async () => {
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Genel Bildirimler',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#EC4899',
          sound: 'default',
          enableLights: true,
          enableVibrate: true,
          showBadge: true,
        });
      }

      if (!Device.isDevice) {
        console.log('[NOTIFY] Emulator/non-physical device detected, attempting push registration...');
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('[NOTIFY] Push notification permission not granted.');
        return null;
      }

      try {
        const devicePush = await Notifications.getDevicePushTokenAsync();
        const nativeToken = typeof devicePush?.data === 'string' ? devicePush.data.trim() : null;
        if (nativeToken) {
          console.log('[NOTIFY] Native FCM/Device Push Token acquired.');
          return nativeToken;
        }
      } catch (nativeErr) {
        console.warn('[NOTIFY] Native device push token fallback to Expo token:', nativeErr.message);
      }

      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.easConfig?.projectId ??
        FALLBACK_EAS_PROJECT_ID;

      const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      console.log('[NOTIFY] Expo Push Token:', token);

      return token;
    } catch (err) {
      console.warn('[NOTIFY] Error registering push notifications:', err.message);
      return null;
    }
  },

  /**
   * Updates the push token on the server for a specific user
   */
  updateServerToken: async (userId, token) => {
    if (!userId || !token) return;

    try {
      const authToken = await AsyncStorage.getItem('token');
      if (!authToken) {
        console.warn('[NOTIFY] No auth token found, skipping server update.');
        return;
      }

      console.log(`[NOTIFY] Updating token on server for user ${userId}...`);
      await axios.post(`${API_URL}/users/push-token`, {
        pushToken: token
      }, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      console.log('[NOTIFY] Server token updated successfully.');
    } catch (err) {
      console.error('[NOTIFY] Error updating server token:', err.response?.status === 401 ? 'Unauthorized (401)' : err.message);
    }
  }
};
