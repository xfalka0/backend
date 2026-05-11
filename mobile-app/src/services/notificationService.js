
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';

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
   * Registers for push notifications and returns the token
   */
  registerForPushNotificationsAsync: async () => {
    let token;

    if (!Device.isDevice) {
      console.log('[NOTIFY] Must use physical device for Push Notifications');
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[NOTIFY] Failed to get push token for push notification!');
      return null;
    }

    // Get the token from Expo
    token = (await Notifications.getExpoPushTokenAsync()).data;
    console.log('[NOTIFY] Expo Push Token:', token);

    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    return token;
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
