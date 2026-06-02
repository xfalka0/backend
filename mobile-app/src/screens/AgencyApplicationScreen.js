import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    SafeAreaView,
    StatusBar,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Alert,
    Linking
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as Haptics from 'expo-haptics';

import { API_URL } from '../config';
import { useTheme } from '../contexts/ThemeContext';
import GlassCard from '../components/ui/GlassCard';
import { useAppStore } from '../store/useAppStore';

export default function AgencyApplicationScreen() {
    const navigation = useNavigation();
    const { theme } = useTheme();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [application, setApplication] = useState(null);

    // Form States
    const [agencyName, setAgencyName] = useState('');
    const [phone, setPhone] = useState('');
    const [reason, setReason] = useState('');

    const fetchApplicationStatus = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) return;

            const res = await axios.get(`${API_URL}/agency/my-application`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data) {
                setApplication(res.data);
                // Pre-fill form if rejected to ease re-submission
                if (res.data.status === 'rejected') {
                    setAgencyName(res.data.agency_name || '');
                    setPhone(res.data.phone || '');
                    setReason(res.data.reason || '');
                }
            } else {
                setApplication(null);
            }
        } catch (error) {
            console.error('[AgencyAppScreen] Fetch status error:', error);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        React.useCallback(() => {
            fetchApplicationStatus();
        }, [])
    );

    const handleSubmit = async () => {
        if (!agencyName.trim() || !phone.trim()) {
            Alert.alert('Hata', 'Lütfen Ajans Adı ve Telefon numarası alanlarını doldurun.');
            return;
        }

        setSubmitting(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) return;

            const res = await axios.post(`${API_URL}/agency/applications`, {
                agencyName: agencyName.trim(),
                phone: phone.trim(),
                reason: reason.trim()
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data && res.data.success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert('Başarılı', res.data.message || 'Başvurunuz başarıyla gönderildi.');
                fetchApplicationStatus();
            } else {
                Alert.alert('Hata', res.data?.error || 'Başvuru gönderilemedi.');
            }
        } catch (error) {
            console.error('[AgencyAppScreen] Submit application error:', error);
            const errMsg = error.response?.data?.error || 'Bir hata oluştu, lütfen daha sonra tekrar deneyin.';
            Alert.alert('Hata', errMsg);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <StatusBar barStyle="light-content" />
                <SafeAreaView style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#06b6d4" />
                    <Text style={styles.loadingText}>Başvuru durumu sorgulanıyor...</Text>
                </SafeAreaView>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView 
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            
            {/* Cyan Accent Backdrop Layer */}
            <LinearGradient
                colors={['#0891b2', '#09021a']}
                style={styles.headerBackdrop}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
            />

            <SafeAreaView style={styles.safeArea}>
                {/* Header Row */}
                <View style={styles.headerRow}>
                    <TouchableOpacity 
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <Text style={styles.headerLabel}>ORTAKLIK BAŞVURUSU</Text>
                        <Text style={styles.headerTitle}>Falka Ajans Ol</Text>
                    </View>
                </View>

                <ScrollView 
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                >
                    {/* If Pending Application */}
                    {application && application.status === 'pending' && (
                        <GlassCard intensity={30} tint="dark" style={styles.statusCard}>
                            <LinearGradient
                                colors={['rgba(245, 158, 11, 0.15)', 'rgba(217, 119, 6, 0.15)']}
                                style={StyleSheet.absoluteFill}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            />
                            <View style={styles.iconWrapperPending}>
                                <Ionicons name="time" size={32} color="#f59e0b" style={styles.pulseIcon} />
                            </View>
                            <Text style={styles.statusTitle}>Başvurunuz Değerlendiriliyor 🕒</Text>
                            <Text style={styles.statusDescription}>
                                **"{application.agency_name}"** ajans başvurunuz süper yöneticilerimiz tarafından incelenmektedir. Sonuçlandığında ajans yönetim paneliniz otomatik olarak aktifleşecektir.
                            </Text>
                            <View style={styles.statusDetailsContainer}>
                                <View style={styles.detailItem}>
                                    <Text style={styles.detailLabel}>Telefon:</Text>
                                    <Text style={styles.detailValue}>{application.phone}</Text>
                                </View>
                                <View style={styles.detailItem}>
                                    <Text style={styles.detailLabel}>Tarih:</Text>
                                    <Text style={styles.detailValue}>{new Date(application.created_at).toLocaleDateString('tr-TR')}</Text>
                                </View>
                            </View>
                        </GlassCard>
                    )}

                    {/* If Approved Application */}
                    {application && application.status === 'approved' && (
                        <GlassCard intensity={35} tint="dark" style={styles.statusCard}>
                            <LinearGradient
                                colors={['rgba(16, 185, 129, 0.15)', '#0596690f']}
                                style={StyleSheet.absoluteFill}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            />
                            <View style={styles.iconWrapperApproved}>
                                <Ionicons name="checkmark-circle" size={40} color="#10b981" />
                            </View>
                            <Text style={styles.statusTitle}>Ajansınız Aktifleştirildi! 🎉</Text>
                            <Text style={styles.statusDescription}>
                                Harika! **"{application.agency_name}"** başvurunuz onaylandı. Artık resmi bir Falka Ajans sahibisiniz. Aşağıdaki davet kodunu kullanarak yayıncılarınızı ajansınıza bağlayabilirsiniz.
                            </Text>

                            <View style={styles.codeContainer}>
                                <Text style={styles.codeLabel}>DAVET KODUNUZ (REFERRAL CODE)</Text>
                                <Text style={styles.codeText}>{application.referral_code || 'Üretiliyor...'}</Text>
                            </View>

                            <TouchableOpacity 
                                style={styles.dashboardButton}
                                activeOpacity={0.8}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                    // Trigger user sync in Zustand store so that is_agency_owner immediately evaluates
                                    useAppStore.getState().syncBalanceWithServer();
                                    navigation.replace('AgencyDashboard');
                                }}
                            >
                                <LinearGradient
                                    colors={['#10b981', '#059669']}
                                    style={styles.dashboardButtonGradient}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                >
                                    <Ionicons name="business" size={18} color="#fff" style={{ marginRight: 6 }} />
                                    <Text style={styles.dashboardButtonText}>Ajans Yönetim Paneline Git ⚡</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </GlassCard>
                    )}

                    {/* Form Layout Redirect to Google Forms */}
                    {(!application || application.status === 'rejected') && (
                        <View style={{ width: '100%' }}>
                            {application && application.status === 'rejected' && (
                                <GlassCard intensity={25} tint="dark" style={styles.rejectedAlert}>
                                    <Ionicons name="close-circle" size={24} color="#ef4444" style={{ marginRight: 10 }} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.rejectedTitle}>Önceki Başvurunuz Reddedildi</Text>
                                        <Text style={styles.rejectedText}>
                                            Bilgilerinizi gözden geçirerek resmi form üzerinden yeniden başvuru yapabilirsiniz.
                                        </Text>
                                    </View>
                                </GlassCard>
                            )}

                            <Text style={styles.introText}>
                                Kendi yayıncı ekibinizi kurup Falka'nın premium finansal altyapısı ile yüksek gelirler elde etmek için ortaklık başvurunuzu resmi formumuz üzerinden tamamlayın.
                            </Text>

                            <GlassCard intensity={20} tint="dark" style={styles.formCard}>
                                <Text style={styles.benefitsTitle}>AJANS PROGRAMI AVANTAJLARI</Text>
                                
                                <View style={styles.benefitsContainer}>
                                    <View style={styles.benefitItem}>
                                        <Ionicons name="cash" size={20} color="#06b6d4" />
                                        <Text style={styles.benefitText}>%40 - %50 Arası Yüksek Komisyon Oranları</Text>
                                    </View>
                                    <View style={styles.benefitItem}>
                                        <Ionicons name="stats-chart" size={20} color="#06b6d4" />
                                        <Text style={styles.benefitText}>Gerçek Zamanlı Yayıncı Analitiği ve Takibi</Text>
                                    </View>
                                    <View style={styles.benefitItem}>
                                        <Ionicons name="card" size={20} color="#06b6d4" />
                                        <Text style={styles.benefitText}>Güvenli ve Düzenli Haftalık Ödemeler</Text>
                                    </View>
                                    <View style={styles.benefitItem}>
                                        <Ionicons name="flash" size={20} color="#06b6d4" />
                                        <Text style={styles.benefitText}>Kolay Kullanımlı Yayıncı Davet ve Yönetim Paneli</Text>
                                    </View>
                                </View>

                                <TouchableOpacity 
                                    style={styles.submitButton}
                                    activeOpacity={0.8}
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                        Linking.openURL('https://forms.gle/vsw1ay6J719NvmLD7');
                                    }}
                                >
                                    <LinearGradient
                                        colors={['#06b6d4', '#0891b2']}
                                        style={styles.submitButtonGradient}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                    >
                                        <Text style={styles.submitButtonText}>BAŞVURU FORMUNU AÇ ⚡</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </GlassCard>
                        </View>
                    )}

                    <View style={{ height: 100 }} />
                </ScrollView>
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#09021a'
    },
    safeArea: {
        flex: 1
    },
    headerBackdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 200,
        zIndex: 0
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        zIndex: 10
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15
    },
    headerTitleContainer: {
        flex: 1
    },
    headerLabel: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 1.5
    },
    headerTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '900',
        letterSpacing: -0.5,
        marginTop: 2
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    loadingText: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 12,
        fontWeight: '700',
        marginTop: 15
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 15
    },
    statusCard: {
        padding: 24,
        borderRadius: 32,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        alignItems: 'center',
        overflow: 'hidden',
        position: 'relative',
        marginTop: 10
    },
    iconWrapperPending: {
        width: 60,
        height: 60,
        borderRadius: 20,
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16
    },
    iconWrapperApproved: {
        width: 60,
        height: 60,
        borderRadius: 20,
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16
    },
    statusTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '950',
        textAlign: 'center',
        letterSpacing: -0.2
    },
    statusDescription: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 13,
        fontWeight: '500',
        textAlign: 'center',
        marginTop: 12,
        lineHeight: 18,
        paddingHorizontal: 5
    },
    statusDetailsContainer: {
        width: '100%',
        backgroundColor: 'rgba(0,0,0,0.25)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.04)',
        borderRadius: 20,
        padding: 16,
        marginTop: 20
    },
    detailItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 4
    },
    detailLabel: {
        color: 'rgba(255, 255, 255, 0.4)',
        fontSize: 11,
        fontWeight: '700'
    },
    detailValue: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '800'
    },
    codeContainer: {
        width: '100%',
        backgroundColor: 'rgba(16, 185, 129, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.2)',
        borderRadius: 20,
        padding: 18,
        alignItems: 'center',
        marginTop: 22
    },
    codeLabel: {
        color: '#10b981',
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 1
    },
    codeText: {
        color: '#fff',
        fontSize: 26,
        fontWeight: '950',
        letterSpacing: 3,
        marginTop: 6
    },
    dashboardButton: {
        width: '100%',
        height: 48,
        borderRadius: 16,
        overflow: 'hidden',
        marginTop: 24,
        elevation: 8
    },
    dashboardButtonGradient: {
        width: '100%',
        height: '100%',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center'
    },
    dashboardButtonText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '900'
    },
    rejectedAlert: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 20,
        borderColor: 'rgba(239, 68, 68, 0.2)',
        borderWidth: 1,
        marginBottom: 20,
        backgroundColor: 'rgba(239, 68, 68, 0.05)'
    },
    rejectedTitle: {
        color: '#ef4444',
        fontSize: 13,
        fontWeight: '900'
    },
    rejectedText: {
        color: 'rgba(255, 255, 255, 0.65)',
        fontSize: 11,
        fontWeight: '500',
        marginTop: 2
    },
    introText: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 13,
        fontWeight: '500',
        lineHeight: 18,
        marginBottom: 20,
        paddingHorizontal: 4
    },
    formCard: {
        padding: 22,
        borderRadius: 28,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)'
    },
    inputLabel: {
        color: 'rgba(255, 255, 255, 0.4)',
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 1,
        marginBottom: 8
    },
    input: {
        width: '100%',
        height: 48,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
        borderRadius: 14,
        paddingHorizontal: 16,
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 20
    },
    textArea: {
        height: 100,
        paddingTop: 12,
        textAlignVertical: 'top'
    },
    submitButton: {
        width: '100%',
        height: 48,
        borderRadius: 16,
        overflow: 'hidden',
        marginTop: 10,
        elevation: 8
    },
    submitButtonGradient: {
        width: '100%',
        height: '100%',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center'
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '900'
    },
    benefitsTitle: {
        color: '#06b6d4',
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 1.5,
        marginBottom: 16,
        textAlign: 'center'
    },
    benefitsContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        borderRadius: 20,
        padding: 18,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
        marginBottom: 20
    },
    benefitItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15
    },
    benefitText: {
        color: '#e2e8f0',
        fontSize: 13,
        fontWeight: '600',
        marginLeft: 12,
        flex: 1
    }
});
