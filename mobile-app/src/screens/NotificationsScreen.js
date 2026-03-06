import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Alert, ActivityIndicator } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import axios from 'axios';
import { API_URL } from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

export default function NotificationsScreen() {
    const { theme } = useTheme();
    const [loading, setLoading] = useState(false);
    const [isSubscribed, setIsSubscribed] = useState(false);

    useEffect(() => {
        checkSubscription();
    }, []);

    const checkSubscription = async () => {
        const userStr = await AsyncStorage.getItem('user');
        if (userStr) {
            const user = JSON.parse(userStr);
            if (user.push_token) setIsSubscribed(true);
        }
    };

    async function registerForPushNotificationsAsync() {
        let token;

        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
            });
        }

        if (Device.isDevice) {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;
            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }
            if (finalStatus !== 'granted') {
                Alert.alert('Hata', 'Bildirim izni verilmedi!');
                return;
            }

            try {
                const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
                if (!projectId) {
                    console.warn('Project ID not found, using default token fetch');
                }
                token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
            } catch (e) {
                console.error('Token fetch error:', e);
                Alert.alert('Hata', 'Bildirim jetonu alınamadı.');
            }
        } else {
            Alert.alert('Uyarı', 'Fiziksel bir cihaz kullanılmalıdır.');
        }

        return token;
    }

    const handleEnableNotifications = async () => {
        setLoading(true);
        try {
            const token = await registerForPushNotificationsAsync();
            if (token) {
                const authToken = await AsyncStorage.getItem('token');
                await axios.post(`${API_URL}/users/push-token`, { pushToken: token }, {
                    headers: { Authorization: `Bearer ${authToken}` }
                });

                // Update local user state
                const userStr = await AsyncStorage.getItem('user');
                if (userStr) {
                    const user = JSON.parse(userStr);
                    user.push_token = token;
                    await AsyncStorage.setItem('user', JSON.stringify(user));
                }

                setIsSubscribed(true);
                Alert.alert('Başarılı', 'Bildirimler başarıyla açıldı! 🎉');
            }
        } catch (error) {
            console.error('Notification setup error:', error);
            Alert.alert('Hata', 'Bildirimler etkinleştirilemedi.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.iconContainer}>
                <Ionicons
                    name={isSubscribed ? "notifications" : "notifications-off-outline"}
                    size={80}
                    color={isSubscribed ? "#8b5cf6" : "#475569"}
                />
            </View>
            <Text style={styles.title}>Bildirim Ayarları</Text>
            <Text style={styles.subtitle}>
                {isSubscribed
                    ? "Bildirimleriniz açık. Yeni mesaj ve aktivitelerden anında haberdar olacaksınız."
                    : "Yeni bir mesaj aldığınızda haberdar olmak için bildirimleri aktif edin."}
            </Text>

            {!isSubscribed && (
                <TouchableOpacity
                    style={styles.button}
                    onPress={handleEnableNotifications}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <Text style={styles.buttonText}>Bildirimleri Aktif Et</Text>
                    )}
                </TouchableOpacity>
            )}

            {isSubscribed && (
                <View style={styles.successBadge}>
                    <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                    <Text style={styles.successText}>Bildirimler Aktif</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', padding: 30 },
    iconContainer: { marginBottom: 30, backgroundColor: 'rgba(255,255,255,0.03)', padding: 40, borderRadius: 100 },
    title: { color: 'white', fontSize: 24, fontWeight: '900', marginBottom: 15, textAlign: 'center' },
    subtitle: { color: '#94a3b8', fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 40 },
    button: {
        backgroundColor: '#8b5cf6',
        paddingHorizontal: 40,
        paddingVertical: 18,
        borderRadius: 20,
        width: '100%',
        alignItems: 'center',
        shadowColor: '#8b5cf6',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10
    },
    buttonText: { color: 'white', fontSize: 18, fontWeight: '800' },
    successBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.2)'
    },
    successText: { color: '#10b981', marginLeft: 8, fontWeight: '700' }
});
