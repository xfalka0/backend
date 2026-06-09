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
    Alert
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

export default function AgencyJoinScreen() {
    const navigation = useNavigation();
    const { theme, themeMode } = useTheme();
    const { user, setUser } = useAppStore();

    const [loading, setLoading] = useState(false);
    const [agencyCode, setAgencyCode] = useState('');
    const [linkedAgency, setLinkedAgency] = useState(null);
    const [fetchingAgency, setFetchingAgency] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    // Sync profile and check if linked to agency
    const checkAgencyStatus = async () => {
        if (!user) return;
        setFetchingAgency(true);
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) return;

            // Sync user profile
            const profileRes = await axios.get(`${API_URL}/users/${user.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (profileRes.data) {
                const updatedUser = { ...user, ...profileRes.data };
                setUser(updatedUser);
                await AsyncStorage.setItem('user', JSON.stringify(updatedUser));

                // If user is linked to an agency, fetch agency details
                if (profileRes.data.agency_id) {
                    const agencyRes = await axios.get(`${API_URL}/users/${user.id}/agency`, {
                        headers: { Authorization: `Bearer ${token}` }
                    }).catch(() => null);

                    if (agencyRes && agencyRes.data && agencyRes.data.name) {
                        setLinkedAgency(agencyRes.data);
                    } else {
                        // Fallback generic info
                        setLinkedAgency({ name: 'Falka Ajansı', status: 'active' });
                    }
                } else {
                    setLinkedAgency(null);
                }
            }
        } catch (error) {
            console.error('[AgencyJoinScreen] Status sync error:', error);
        } finally {
            setFetchingAgency(false);
        }
    };

    useEffect(() => {
        checkAgencyStatus();
    }, []);

    const handleJoin = async () => {
        if (!agencyCode.trim()) {
            Alert.alert('Uyarı', 'Lütfen geçerli bir ajans veya davet kodu girin.');
            return;
        }

        setLoading(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) return;

            const res = await axios.post(`${API_URL}/agencies/join`, {
                agencyId: agencyCode.trim()
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data && res.data.success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert('Başarılı', res.data.message || 'Ajansa başarıyla katıldınız!');

                // Refresh profile data to sync agency_id and new roles
                const profileRes = await axios.get(`${API_URL}/users/${user.id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (profileRes.data) {
                    const updatedUser = { ...user, ...profileRes.data };
                    setUser(updatedUser);
                    await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
                }

                // Reload screen state
                checkAgencyStatus();
                setAgencyCode('');
            } else {
                Alert.alert('Hata', res.data?.error || 'Ajansa katılım sağlanamadı.');
            }
        } catch (error) {
            console.error('[AgencyJoinScreen] Join error:', error);
            const errMsg = error.response?.data?.error || 'Bir hata oluştu, lütfen kodu kontrol edip tekrar deneyin.';
            Alert.alert('Hata', errMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: theme.colors.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            {themeMode === 'dark' && (
                <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                    <LinearGradient
                        colors={theme.gradients.dark}
                        style={StyleSheet.absoluteFill}
                    />
                </View>
            )}

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
                        <Text style={styles.headerLabel}>AJANS KATILIM PANELİ</Text>
                        <Text style={styles.headerTitle}>Ajansa Katıl</Text>
                    </View>
                </View>

                {fetchingAgency ? (
                    <View style={styles.loadingWrapper}>
                        <ActivityIndicator size="large" color="#db2777" />
                        <Text style={styles.loadingText}>Ajans bilgileri doğrulanıyor...</Text>
                    </View>
                ) : (
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContent}
                    >
                        {linkedAgency ? (
                            /* User is already linked to an agency */
                            <GlassCard intensity={35} tint="dark" style={styles.statusCard}>
                                <LinearGradient
                                    colors={['rgba(219, 39, 119, 0.15)', 'rgba(124, 58, 237, 0.05)']}
                                    style={StyleSheet.absoluteFill}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                />
                                <View style={styles.iconWrapperLinked}>
                                    <Ionicons name="business" size={42} color="#db2777" />
                                    <View style={styles.badgeWrapper}>
                                        <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                                    </View>
                                </View>
                                <Text style={styles.statusTitle}>Ajansa Bağlısınız</Text>
                                <Text style={styles.statusDescription}>
                                    Şu anda aktif olarak <Text style={styles.agencyNameHighlight}>"{linkedAgency.name}"</Text> ajansının bünyesinde yer almaktasınız.
                                </Text>

                                <View style={styles.detailsContainer}>
                                    <View style={styles.detailItem}>
                                        <Text style={styles.detailLabel}>Ajans Adı:</Text>
                                        <Text style={styles.detailValue}>{linkedAgency.name}</Text>
                                    </View>
                                    {linkedAgency.owner_name && (
                                        <View style={styles.detailItem}>
                                            <Text style={styles.detailLabel}>Ajans Sahibi:</Text>
                                            <Text style={styles.detailValue}>{linkedAgency.owner_name}</Text>
                                        </View>
                                    )}
                                    {linkedAgency.referral_code && (
                                        <View style={styles.detailItem}>
                                            <Text style={styles.detailLabel}>Ajans Kodu:</Text>
                                            <Text style={[styles.detailValue, { color: '#db2777' }]}>{linkedAgency.referral_code}</Text>
                                        </View>
                                    )}
                                    <View style={styles.detailItem}>
                                        <Text style={styles.detailLabel}>Durum:</Text>
                                        <Text style={[styles.detailValue, { color: '#10b981' }]}>Aktif Üye</Text>
                                    </View>
                                </View>

                                <View style={styles.warningAlert}>
                                    <Ionicons name="information-circle-outline" size={20} color="#f59e0b" style={{ marginRight: 8 }} />
                                    <Text style={styles.warningText}>
                                        Mevcut ajansınızdan ayrılmak veya başka ajansa geçmek istiyorsanız, güvenlik gereği bunu sadece mevcut ajans sahibiniz panelinden gerçekleştirebilir.
                                    </Text>
                                </View>
                            </GlassCard>
                        ) : (
                            /* User needs to join an agency */
                            <View style={styles.formContainer}>
                                <GlassCard intensity={25} tint="dark" style={styles.introCard}>
                                    <View style={styles.introAccentLine} />
                                    <View style={styles.introTextContainer}>
                                        <Text style={styles.introTitle}>Bir Ajansta Yer Alın, Daha Fazla Kazanın! ⚡</Text>
                                        <Text style={styles.introDesc}>
                                            Bir ajansa katılarak özel görevlere erişebilir, performans takipleriyle gelirinizi optimize edebilir ve ödemelerinizi ajansınız aracılığıyla kolayca alabilirsiniz.
                                        </Text>
                                    </View>
                                </GlassCard>

                                <Text style={styles.inputLabel}>Ajans Davet Kodu / Referans Kodu</Text>
                                <TextInput
                                    style={[styles.input, isFocused && styles.inputFocused]}
                                    placeholder=""
                                    placeholderTextColor="rgba(255, 255, 255, 0.3)"
                                    value={agencyCode}
                                    onChangeText={setAgencyCode}
                                    autoCapitalize="characters"
                                    autoCorrect={false}
                                    editable={!loading}
                                    onFocus={() => setIsFocused(true)}
                                    onBlur={() => setIsFocused(false)}
                                />
                                <Text style={styles.inputHelper}>
                                    Ajans yöneticinizden aldığınız 6 haneli davet kodunu veya benzersiz ajans kodunu girin.
                                </Text>

                                <TouchableOpacity
                                    style={styles.submitButton}
                                    onPress={handleJoin}
                                    disabled={loading}
                                >
                                    <LinearGradient
                                        colors={['#db2777', '#7c3aed']}
                                        style={styles.gradientButton}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                    >
                                        {loading ? (
                                            <ActivityIndicator size="small" color="#fff" />
                                        ) : (
                                            <>
                                                <Text style={styles.submitButtonText}>Ajansa Katıl</Text>
                                                <Ionicons name="flash" size={16} color="#fff" style={{ marginLeft: 6 }} />
                                            </>
                                        )}
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        )}
                    </ScrollView>
                )}
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
        height: 280
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 12 : 36,
        paddingBottom: 20
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)'
    },
    headerTitleContainer: {
        marginLeft: 16
    },
    headerLabel: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 1.5,
        textTransform: 'uppercase'
    },
    headerTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '950',
        letterSpacing: -0.5
    },
    loadingWrapper: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40
    },
    loadingText: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 13,
        fontWeight: '600',
        marginTop: 14
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 40
    },
    statusCard: {
        borderRadius: 28,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
        overflow: 'hidden',
        marginTop: 10
    },
    iconWrapperLinked: {
        width: 80,
        height: 80,
        borderRadius: 24,
        backgroundColor: 'rgba(219, 39, 119, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        position: 'relative'
    },
    badgeWrapper: {
        position: 'absolute',
        bottom: -4,
        right: -4,
        backgroundColor: '#09021a',
        borderRadius: 12,
        padding: 2
    },
    statusTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '950',
        textAlign: 'center',
        marginBottom: 8
    },
    statusDescription: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 13,
        fontWeight: '500',
        textAlign: 'center',
        lineHeight: 18,
        paddingHorizontal: 5
    },
    agencyNameHighlight: {
        color: '#db2777',
        fontWeight: '900'
    },
    detailsContainer: {
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
        paddingVertical: 6
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
    warningAlert: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 16,
        borderRadius: 20,
        borderColor: 'rgba(245, 158, 11, 0.2)',
        borderWidth: 1,
        marginTop: 20,
        backgroundColor: 'rgba(245, 158, 11, 0.05)'
    },
    warningText: {
        flex: 1,
        color: 'rgba(245, 158, 11, 0.8)',
        fontSize: 11,
        fontWeight: '600',
        lineHeight: 15
    },
    formContainer: {
        marginTop: 10
    },
    introCard: {
        borderRadius: 24,
        padding: 20,
        marginBottom: 26,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
        flexDirection: 'row',
        alignItems: 'center',
        overflow: 'hidden'
    },
    introAccentLine: {
        width: 4,
        borderRadius: 2,
        backgroundColor: '#db2777',
        marginRight: 16,
        height: '80%'
    },
    introTextContainer: {
        flex: 1
    },
    introTitle: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '900',
        marginBottom: 6
    },
    introDesc: {
        color: 'rgba(255, 255, 255, 0.55)',
        fontSize: 12,
        fontWeight: '500',
        lineHeight: 17
    },
    inputLabel: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 11,
        fontWeight: '750',
        marginBottom: 10,
        marginLeft: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    input: {
        width: '100%',
        height: 56,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        paddingHorizontal: 18,
        color: '#fff',
        fontSize: 15,
        fontWeight: '700'
    },
    inputFocused: {
        borderColor: '#db2777',
        backgroundColor: 'rgba(255, 255, 255, 0.06)'
    },
    inputHelper: {
        color: 'rgba(255, 255, 255, 0.35)',
        fontSize: 11,
        fontWeight: '500',
        marginTop: 8,
        marginLeft: 4,
        lineHeight: 15
    },
    submitButton: {
        width: '100%',
        height: 54,
        borderRadius: 18,
        overflow: 'hidden',
        marginTop: 32,
        elevation: 8,
        shadowColor: '#db2777',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10
    },
    gradientButton: {
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
    }
});
