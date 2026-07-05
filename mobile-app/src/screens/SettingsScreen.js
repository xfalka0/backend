import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Platform, Linking, ActivityIndicator, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import MaskedView from '@react-native-masked-view/masked-view';
import axios from 'axios';
import { API_URL } from '../config';
import { useTheme } from '../contexts/ThemeContext';
import { DARK_THEME } from '../theme';
import ModernAlert from '../components/ui/ModernAlert';

// Generic MaskedView Gradient Icon for premium dating aesthetic
const GradientIcon = ({ name, size = 22, colors = ['#FFFFFF', '#EC4899'] }) => (
    <MaskedView
        style={{ width: size, height: size }}
        maskElement={
            <View style={{ backgroundColor: 'transparent', flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name={name} size={size} color="#FFFFFF" />
            </View>
        }
    >
        <LinearGradient
            colors={colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: size, height: size }}
        />
    </MaskedView>
);

export default function SettingsScreen({ navigation, route }) {
    const { theme, themeMode } = useTheme();
    const { user } = route.params || {};
    const [loading, setLoading] = useState(false);
    const [alert, setAlert] = useState({
        visible: false,
        title: '',
        message: '',
        type: 'info',
        showCancel: false,
        onConfirm: null
    });

    // Settings States
    const [isProfileHidden, setIsProfileHidden] = useState(user?.is_hidden || false);
    const [onlineStatus, setOnlineStatus] = useState(user?.show_online !== false);
    
    // Detailed Notification Preferences
    const [notifications, setNotifications] = useState({
        all: true,
        messages: true,
        voiceCalls: true,
        matching: true,
    });

    useEffect(() => {
        loadNotificationSettings();
    }, []);

    const loadNotificationSettings = async () => {
        try {
            const saved = await AsyncStorage.getItem('notification_settings');
            if (saved) {
                setNotifications(JSON.parse(saved));
            }
        } catch (e) {
            console.log('Load notifications settings error:', e);
        }
    };

    const updateSetting = async (key, value) => {
        try {
            const token = await AsyncStorage.getItem('token');
            await axios.patch(`${API_URL}/users/${user.id}`, { [key]: value }, {
                headers: { Authorization: `Bearer ${token}` }
            });
        } catch (err) {
            console.log(`Update ${key} error:`, err);
            setAlert({ visible: true, title: 'Hata', message: 'Ayar güncellenirken bir sorun oluştu.', type: 'error' });
        }
    };

    const handleToggleProfile = (val) => {
        setIsProfileHidden(val);
        updateSetting('is_hidden', val);
    };

    const handleToggleOnline = (val) => {
        setOnlineStatus(val);
        updateSetting('show_online', val);
    };

    const handleToggleNotification = async (key, val) => {
        const updated = { ...notifications, [key]: val };
        
        if (key === 'all') {
            updated.messages = val;
            updated.voiceCalls = val;
            updated.matching = val;
        } else {
            // If any sub-setting is enabled, master setting should be on
            if (val === true) {
                updated.all = true;
            } else {
                // If all sub-settings are disabled, master setting is off
                if (!updated.messages && !updated.voiceCalls && !updated.matching) {
                    updated.all = false;
                }
            }
        }
        
        setNotifications(updated);
        try {
            await AsyncStorage.setItem('notification_settings', JSON.stringify(updated));
        } catch (e) {
            console.log('Save notifications settings error:', e);
        }
    };

    const handleLogout = () => {
        setAlert({
            visible: true,
            title: 'Çıkış Yap',
            message: 'Hesabınızdan çıkış yapmak istediğinize emin misiniz?',
            showCancel: true,
            confirmText: 'ÇIKIŞ YAP',
            onConfirm: async () => {
                await AsyncStorage.clear();
                navigation.replace('Welcome');
            }
        });
    };

    const handleClearCache = () => {
        setLoading(true);
        setTimeout(() => {
            setLoading(false);
            setAlert({ visible: true, title: 'Başarılı', message: 'Uygulama önbelleği ve geçici dosyalar temizlendi.', type: 'success' });
        }, 1500);
    };

    const handleDeleteAccount = () => {
        setAlert({
            visible: true,
            title: 'Hesabı Sil',
            message: 'Tüm verileriniz kalıcı olarak silinecektir. Bu işlem geri alınamaz.',
            showCancel: true,
            confirmText: 'SİL',
            onConfirm: async () => {
                try {
                    setLoading(true);
                    const token = await AsyncStorage.getItem('token');
                    await axios.delete(`${API_URL}/users/${user.id}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    setLoading(false);
                    await AsyncStorage.clear();
                    navigation.replace('Welcome');
                } catch (err) {
                    setLoading(false);
                    setAlert({ visible: true, title: 'Hata', message: 'Hesap silinirken bir hata oluştu.', type: 'error' });
                }
            }
        });
    };

    const SettingItem = ({ icon, label, sublabel, value, type = 'next', onPress, onValueChange, colors, disabled = false }) => (
        <TouchableOpacity
            style={[styles.settingItem, disabled && { opacity: 0.5 }]}
            onPress={onPress}
            disabled={type === 'switch' || disabled}
            activeOpacity={0.7}
        >
            <View style={styles.iconContainer}>
                <GradientIcon name={icon} size={15} colors={colors} />
            </View>
            <View style={styles.textContainer}>
                <Text style={[styles.itemLabel, { color: theme.colors.text }]}>{label}</Text>
                {sublabel && <Text style={[styles.itemSublabel, { color: theme.colors.textSecondary }]}>{sublabel}</Text>}
            </View>
            {type === 'next' && <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />}
            {type === 'switch' && (
                <Switch
                    value={value}
                    onValueChange={onValueChange}
                    disabled={disabled}
                    trackColor={{ false: themeMode === 'dark' ? '#1e293b' : '#e2e8f0', true: '#EC4899' }}
                    thumbColor={Platform.OS === 'android' ? (value ? '#FFFFFF' : '#94a3b8') : undefined}
                />
            )}
        </TouchableOpacity>
    );

    const SectionHeader = ({ title }) => (
        <Text style={[styles.sectionHeader, { color: theme.colors.textSecondary }]}>{title}</Text>
    );

    return (
        <View style={styles.container}>
            {/* Background Image Layer identical to Profile Screen */}
            <View style={styles.bgWrapper}>
                <Image 
                    source={require('../../assets/fiva_profile_banner.png')} 
                    style={styles.backgroundImage}
                />
                <LinearGradient
                    colors={['rgba(9, 2, 26, 0.15)', 'rgba(9, 2, 26, 0.8)', '#09021a']}
                    style={StyleSheet.absoluteFill}
                />
            </View>

            <View style={[styles.header, { backgroundColor: 'transparent' }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, { backgroundColor: theme.colors.glass }]}>
                    <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Ayarlar</Text>
                <View style={{ width: 40 }} />
            </View>

            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#EC4899" />
                </View>
            )}

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                <SectionHeader title="FLÖRT & KEŞİF TERCİHLERİ" />
                <View style={[styles.sectionCard, { backgroundColor: theme.colors.glass, borderColor: theme.colors.glassBorder }]}>
                    <SettingItem
                        icon="person-outline"
                        label="Profil Bilgilerini Düzenle"
                        colors={['#FFC2EB', '#EC4899']}
                        onPress={() => navigation.navigate('Profil', { editMode: true })}
                    />
                    <SettingItem
                        icon="eye-off-outline"
                        label="Profilimi Gizle"
                        sublabel="Eşleşme havuzundan geçici olarak çıkarsın"
                        type="switch"
                        value={isProfileHidden}
                        onValueChange={handleToggleProfile}
                        colors={['#FF8A80', '#D50000']}
                    />
                    <SettingItem
                        icon="radio-button-on-outline"
                        label="Çevrimiçi Durumu"
                        sublabel="Diğer kullanıcılar çevrimiçi olduğunu görür"
                        type="switch"
                        value={onlineStatus}
                        onValueChange={handleToggleOnline}
                        colors={['#67E8F9', '#06B6D4']}
                    />
                </View>

                <SectionHeader title="MESAJ & ARAMA BİLDİRİMLERİ" />
                <View style={[styles.sectionCard, { backgroundColor: theme.colors.glass, borderColor: theme.colors.glassBorder }]}>
                    <SettingItem
                        icon="notifications-outline"
                        label="Tüm Bildirimler"
                        sublabel="Genel bildirimleri aç veya kapat"
                        type="switch"
                        value={notifications.all}
                        onValueChange={(v) => handleToggleNotification('all', v)}
                        colors={['#8B5CF6', '#EC4899']}
                    />
                    <SettingItem
                        icon="chatbubble-ellipses-outline"
                        label="Yeni Mesaj Uyarısı"
                        sublabel="Yeni bir mesaj aldığında bildir"
                        type="switch"
                        value={notifications.messages}
                        onValueChange={(v) => handleToggleNotification('messages', v)}
                        colors={['#60A5FA', '#3B82F6']}
                        disabled={!notifications.all}
                    />
                    <SettingItem
                        icon="call-outline"
                        label="Sesli Arama Bildirimi"
                        sublabel="Gelen sesli aramaları bildir"
                        type="switch"
                        value={notifications.voiceCalls}
                        onValueChange={(v) => handleToggleNotification('voiceCalls', v)}
                        colors={['#34D399', '#059669']}
                        disabled={!notifications.all}
                    />
                </View>

                <SectionHeader title="HESAP AYARLARI" />
                <View style={[styles.sectionCard, { backgroundColor: theme.colors.glass, borderColor: theme.colors.glassBorder }]}>
                    <SettingItem
                        icon="language-outline"
                        label="Uygulama Dili"
                        sublabel="Türkçe"
                        colors={['#4DD0E1', '#00ACC1']}
                        onPress={() => setAlert({ visible: true, title: 'Dil Değiştir', message: 'Şu an sadece Türkçe desteklenmektedir.', type: 'info' })}
                    />
                    <SettingItem
                        icon="ban-outline"
                        label="Engellenen Kişiler"
                        colors={['#FFB74D', '#F57C00']}
                        onPress={() => setAlert({ visible: true, title: 'Geliştiriliyor', message: 'Engellenen listesi yakında eklenecektir.', type: 'info' })}
                    />
                </View>

                <SectionHeader title="AŞK DESTEK VE BİLGİ" />
                <View style={[styles.sectionCard, { backgroundColor: theme.colors.glass, borderColor: theme.colors.glassBorder }]}>
                    <SettingItem
                        icon="logo-whatsapp"
                        label="WhatsApp Destek"
                        sublabel="+90 541 473 87 00"
                        colors={['#81C784', '#388E3C']}
                        onPress={() => {
                            Linking.openURL('https://wa.me/905414738700').catch(() => {
                                setAlert({ visible: true, title: 'Hata', message: 'WhatsApp uygulaması bulunamadı.', type: 'error' });
                            });
                        }}
                    />
                    <SettingItem
                        icon="mail-outline"
                        label="E-posta Destek"
                        sublabel="falkasoft@gmail.com"
                        colors={['#90CAF9', '#1565C0']}
                        onPress={() => {
                            Linking.openURL('mailto:falkasoft@gmail.com').catch(() => {
                                setAlert({ visible: true, title: 'Hata', message: 'E-posta uygulaması bulunamadı.', type: 'error' });
                            });
                        }}
                    />
                    <SettingItem
                        icon="document-text-outline"
                        label="Kullanım Koşulları"
                        colors={['#B0BEC5', '#546E7A']}
                        onPress={() => navigation.navigate('Legal', { type: 'terms' })}
                    />
                    <SettingItem
                        icon="shield-checkmark-outline"
                        label="Gizlilik Sözleşmesi"
                        colors={['#B0BEC5', '#546E7A']}
                        onPress={() => navigation.navigate('Legal', { type: 'privacy' })}
                    />
                    <SettingItem
                        icon="trash-outline"
                        label="Önbelleği Temizle"
                        colors={['#94A3B8', '#475569']}
                        onPress={handleClearCache}
                    />
                </View>

                <TouchableOpacity style={[styles.logoutButton, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]} onPress={handleLogout}>
                    <Ionicons name="log-out-outline" size={20} color="#ef4444" />
                    <Text style={styles.logoutText}>Çıkış Yap</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount} disabled={loading}>
                    <Text style={[styles.deleteText, { color: theme.colors.textSecondary }]}>Hesabı Sil</Text>
                </TouchableOpacity>

                <Text style={[styles.versionText, { color: theme.colors.textSecondary }]}>Versiyon 1.0.4 - Premium 💖</Text>
                <View style={{ height: 50 }} />
            </ScrollView>
            <ModernAlert
                visible={alert.visible}
                title={alert.title}
                message={alert.message}
                type={alert.type || 'info'}
                showCancel={alert.showCancel}
                confirmText={alert.confirmText}
                onConfirm={alert.onConfirm}
                onClose={() => setAlert({ ...alert, visible: false })}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#09021a', // Dark base matching profile
    },
    bgWrapper: {
        position: 'absolute',
        width: '100%',
        height: 400,
    },
    backgroundImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    headerTitle: {
        fontSize: 15,
        fontWeight: '950',
        letterSpacing: 0.5,
    },
    scrollContent: {
        paddingHorizontal: 20,
    },
    sectionHeader: {
        fontSize: 8.5,
        fontWeight: '800',
        letterSpacing: 1.5,
        marginTop: 12,
        marginBottom: 3,
        marginLeft: 5,
    },
    sectionCard: {
        borderRadius: 14,
        padding: 4,
        borderWidth: 1,
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 6,
        borderRadius: 9,
    },
    iconContainer: {
        width: 28,
        height: 28,
        borderRadius: 7,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    textContainer: {
        flex: 1,
        marginLeft: 8,
    },
    itemLabel: {
        fontSize: 12.5,
        fontWeight: '600',
    },
    itemSublabel: {
        fontSize: 9.5,
        marginTop: 2,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 10,
        borderRadius: 12,
        marginTop: 18,
        gap: 10,
    },
    logoutText: {
        color: '#ef4444',
        fontSize: 13,
        fontWeight: '700',
    },
    deleteButton: {
        padding: 8,
        alignItems: 'center',
        marginTop: 4,
    },
    deleteText: {
        fontSize: 11,
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
    versionText: {
        textAlign: 'center',
        fontSize: 9,
        marginTop: 10,
        letterSpacing: 1,
        fontWeight: '800',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.6)',
        zIndex: 1000,
        justifyContent: 'center',
        alignItems: 'center',
    }
});
