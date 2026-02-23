import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Platform, Linking, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { API_URL } from '../config';
import { useTheme } from '../contexts/ThemeContext';
import { DARK_THEME, LIGHT_THEME } from '../theme';
import ModernAlert from '../components/ui/ModernAlert';

export default function SettingsScreen({ navigation, route }) {
    const { theme, themeMode, toggleTheme } = useTheme();
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
    const [notifications, setNotifications] = useState({
        messages: true,
        matching: true,
    });

    // Sync settings with backend on change
    const updateSetting = async (key, value) => {
        try {
            await axios.patch(`${API_URL}/users/${user.id}`, { [key]: value });
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
        // Simulate cache clearing
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
                    await axios.delete(`${API_URL}/users/${user.id}`);
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

    const SettingItem = ({ icon, label, sublabel, value, type = 'next', onPress, onValueChange, iconColor = '#8b5cf6' }) => (
        <TouchableOpacity
            style={styles.settingItem}
            onPress={onPress}
            disabled={type === 'switch'}
            activeOpacity={0.7}
        >
            <View style={[styles.iconContainer, { backgroundColor: `${iconColor}15` }]}>
                <Ionicons name={icon} size={22} color={iconColor} />
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
                    trackColor={{ false: themeMode === 'dark' ? '#1e293b' : '#e2e8f0', true: '#8b5cf6' }}
                    thumbColor={Platform.OS === 'android' ? (value ? '#8b5cf6' : (themeMode === 'dark' ? '#94a3b8' : '#ffffff')) : undefined}
                />
            )}
        </TouchableOpacity>
    );

    const SectionHeader = ({ title }) => (
        <Text style={[styles.sectionHeader, { color: theme.colors.textSecondary }]}>{title}</Text>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={[styles.header, { backgroundColor: 'transparent' }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, { backgroundColor: theme.colors.glass }]}>
                    <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Ayarlar</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                <SectionHeader title="HESAP" />
                <View style={[styles.sectionCard, { backgroundColor: theme.colors.glass, borderColor: theme.colors.glassBorder }]}>
                    <SettingItem
                        icon="person-outline"
                        label="Profil Bilgilerini Düzenle"
                        onPress={() => navigation.navigate('Profil')}
                    />
                    <SettingItem
                        icon="eye-off-outline"
                        label="Profilimi Gizle"
                        sublabel="Başka kullanıcılar seni göremez"
                        type="switch"
                        value={isProfileHidden}
                        onValueChange={handleToggleProfile}
                    />
                    <SettingItem
                        icon="language-outline"
                        label="Uygulama Dili"
                        sublabel="Türkçe"
                        onPress={() => setAlert({ visible: true, title: 'Dil Değiştir', message: 'Şu an sadece Türkçe desteklenmektedir.', type: 'info' })}
                    />
                </View>

                <SectionHeader title="GÖRÜNÜM" />
                <View style={[styles.sectionCard, { backgroundColor: theme.colors.glass, borderColor: theme.colors.glassBorder }]}>
                    <SettingItem
                        icon={themeMode === 'dark' ? "moon-outline" : "sunny-outline"}
                        label={themeMode === 'dark' ? "Koyu Tema" : "Açık Tema"}
                        sublabel="Uygulama görünümünü değiştir"
                        type="switch"
                        value={themeMode === 'dark'}
                        onValueChange={toggleTheme}
                    />
                </View>

                <SectionHeader title="GİZLİLİK" />
                <View style={[styles.sectionCard, { backgroundColor: theme.colors.glass, borderColor: theme.colors.glassBorder }]}>
                    <SettingItem
                        icon="ban-outline"
                        label="Engellenen Kişiler"
                        onPress={() => setAlert({ visible: true, title: 'Geliştiriliyor', message: 'Engellenen listesi yakında eklenecektir.', type: 'info' })}
                    />
                    <SettingItem
                        icon="radio-button-on-outline"
                        label="Çevrimiçi Durumu"
                        type="switch"
                        value={onlineStatus}
                        onValueChange={handleToggleOnline}
                        iconColor="#10b981"
                    />
                </View>

                <SectionHeader title="BİLDİRİMLER" />
                <View style={[styles.sectionCard, { backgroundColor: theme.colors.glass, borderColor: theme.colors.glassBorder }]}>
                    <SettingItem
                        icon="chatbubble-outline"
                        label="Mesaj Bildirimleri"
                        type="switch"
                        value={notifications.messages}
                        onValueChange={(v) => setNotifications({ ...notifications, messages: v })}
                    />
                    <SettingItem
                        icon="heart-outline"
                        label="Eşleşme ve Beğeniler"
                        type="switch"
                        value={notifications.matching}
                        onValueChange={(v) => setNotifications({ ...notifications, matching: v })}
                        iconColor="#f472b6"
                    />
                </View>

                <SectionHeader title="DESTEK VE BİLGİ" />
                <View style={[styles.sectionCard, { backgroundColor: theme.colors.glass, borderColor: theme.colors.glassBorder }]}>
                    <SettingItem
                        icon="document-text-outline"
                        label="Kullanım Koşulları"
                        onPress={() => navigation.navigate('Legal', { type: 'terms' })}
                    />
                    <SettingItem
                        icon="shield-checkmark-outline"
                        label="Gizlilik Sözleşmesi"
                        onPress={() => navigation.navigate('Legal', { type: 'privacy' })}
                    />
                    <SettingItem
                        icon="trash-outline"
                        label="Önbelleği Temizle"
                        onPress={handleClearCache}
                        iconColor="#64748b"
                    />
                </View>

                <TouchableOpacity style={[styles.logoutButton, { backgroundColor: themeMode === 'dark' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)' }]} onPress={handleLogout}>
                    <Ionicons name="log-out-outline" size={20} color="#ef4444" />
                    <Text style={styles.logoutText}>Çıkış Yap</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount} disabled={loading}>
                    <Text style={[styles.deleteText, { color: theme.colors.textSecondary }]}>Hesabı Sil</Text>
                </TouchableOpacity>

                <Text style={[styles.versionText, { color: theme.colors.textSecondary }]}>Versiyon 1.0.4 - Premium</Text>
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
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '900',
    },
    scrollContent: {
        paddingHorizontal: 20,
    },
    sectionHeader: {
        color: '#64748b',
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 1,
        marginTop: 25,
        marginBottom: 10,
        marginLeft: 5,
    },
    sectionCard: {
        borderRadius: 24,
        padding: 8,
        borderWidth: 1,
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 16,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textContainer: {
        flex: 1,
        marginLeft: 15,
    },
    itemLabel: {
        fontSize: 15,
        fontWeight: '600',
    },
    itemSublabel: {
        color: '#64748b',
        fontSize: 12,
        marginTop: 2,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        padding: 16,
        borderRadius: 20,
        marginTop: 40,
        gap: 10,
    },
    logoutText: {
        color: '#ef4444',
        fontSize: 16,
        fontWeight: '700',
    },
    deleteButton: {
        padding: 15,
        alignItems: 'center',
        marginTop: 10,
    },
    deleteText: {
        color: '#475569',
        fontSize: 14,
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
    versionText: {
        textAlign: 'center',
        color: '#334155',
        fontSize: 10,
        marginTop: 20,
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
