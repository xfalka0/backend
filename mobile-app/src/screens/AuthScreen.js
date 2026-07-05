import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    Dimensions,
    TouchableOpacity,
    Platform,
    KeyboardAvoidingView,
    ScrollView,
    Keyboard,
    ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    FadeIn,
    FadeInUp,
    SlideInRight,
    SlideOutLeft,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

import { API_URL } from '../config';
import { NotificationService } from '../services/notificationService';
import { useChat } from '../contexts/ChatContext';
import { COLORS } from '../theme';
import AuthBackground from '../components/animated/AuthBackground';
import GlassInput from '../components/ui/GlassInput';
import WelcomeButton from '../components/ui/WelcomeButton';
import FloatingProfiles from '../components/animated/FloatingProfiles';
import OtpInput from '../components/ui/OtpInput';
import ModernAlert from '../components/ui/ModernAlert';

const { width, height } = Dimensions.get('window');

export default function AuthScreen({ navigation, route }) {
    const { refreshUser } = useChat();
    // Steps: 0: Method Selection, 1: Identifier Input, 2: OTP Entry
    const [step, setStep] = useState(1);
    const [authMethod, setAuthMethod] = useState('email'); // Default to email
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [password, setPassword] = useState('');
    const [isRegisterMode, setIsRegisterMode] = useState(false);
    const [loading, setLoading] = useState(false);
    const [alert, setAlert] = useState({ visible: false, title: '', message: '', type: 'error' });
    const [resendCountdown, setResendCountdown] = useState(0);

    const sheetY = useSharedValue(height);

    useEffect(() => {
        sheetY.value = withSpring(height * 0.05, { damping: 15 });

        GoogleSignin.configure({
            webClientId: '46669084263-drv76chuoahgvfitcdmctvvqm3cbudl7.apps.googleusercontent.com',
            androidClientId: '46669084263-vk43fvjtff4f95ep61rr8cv5mvj4t1h6.apps.googleusercontent.com',
            offlineAccess: true,
        });

        // Handle direct navigation from WelcomeScreen
        const m = route.params?.mode;
        if (m === 'phone' || m === 'email') {
            setAuthMethod(m);
            setStep(1);
        } else if (m === 'google') {
            handleGoogleLogin();
        }
    }, []);

    useEffect(() => {
        let interval = null;
        if (resendCountdown > 0) {
            interval = setInterval(() => {
                setResendCountdown(prev => prev - 1);
            }, 1000);
        } else {
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [resendCountdown]);

    const animatedSheetStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: sheetY.value }],
    }));

    const getDeviceId = async () => {
        try {
            if (Platform.OS === 'android') {
                return Application.getAndroidId();
            } else {
                return await Application.getIosIdForVendorAsync();
            }
        } catch (e) {
            console.log('Error getting device ID:', e);
            return null; // Fallback gracefully if impossible
        }
    };

    const handleEmailAuth = async () => {
        if (!email || !password) {
            setAlert({ visible: true, title: 'Hata', message: 'Lütfen tüm alanları doldurun.', type: 'error' });
            return;
        }

        setLoading(true);
        try {
            const endpoint = isRegisterMode ? '/auth/register-email' : '/auth/login-email';
            const deviceId = await getDeviceId();
            const normalizedEmail = email.trim().toLowerCase();
            const payload = { email: normalizedEmail, password, deviceId };
            const res = await axios.post(`${API_URL}${endpoint}`, payload);

            if (res.data.user) {
                const { user, token } = res.data;
                await AsyncStorage.setItem('token', token);
                await AsyncStorage.setItem('user', JSON.stringify(user));

                // Initialize global ChatProvider context immediately
                await refreshUser();

                if (user.onboarding_completed) {
                    // Register notifications after login
                    const token = await NotificationService.registerForPushNotificationsAsync();
                    if (token) await NotificationService.updateServerToken(user.id, token);
                    
                    navigation.replace('Main', { user: { ...user, token: res.data.token } });
                } else {
                    navigation.replace('Onboarding', { userId: user.id, token: res.data.token });
                }
            }
        } catch (error) {
            setAlert({ visible: true, title: 'Hata', message: error.response?.data?.error || `${error.message} (${error.config?.url || 'URL Yok'})`, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleRequestOtp = async () => {
        let identifier = authMethod === 'email' ? email.trim().toLowerCase() : phone;
        
        if (authMethod === 'email') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(identifier)) {
                setAlert({ visible: true, title: 'Hata', message: 'Lütfen geçerli bir e-posta adresi girin.', type: 'error' });
                return;
            }
        } else {
            if (!identifier || phone.length < 10) {
                setAlert({ visible: true, title: 'Hata', message: 'Lütfen geçerli bir telefon numarası girin.', type: 'error' });
                return;
            }
        }

        setLoading(true);
        try {
            const payload = authMethod === 'email' ? { email: identifier } : { phone };
            const res = await axios.post(`${API_URL}/auth/request-otp`, payload);

            if (res.data.success) {
                setOtp('');
                setStep(2);
                setResendCountdown(60); // Start 1-minute countdown
            }
        } catch (error) {
            setAlert({ visible: true, title: 'Hata', message: error.response?.data?.error || `${error.message} (${error.config?.url || 'URL Yok'})`, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (codeToVerify) => {
        const verifyCode = codeToVerify || otp;
        if (!verifyCode || verifyCode.length < 6) {
            setAlert({ visible: true, title: 'Hata', message: 'Lütfen 6 haneli doğrulama kodunu girin.', type: 'error' });
            return;
        }

        setLoading(true);
        try {
            const deviceId = await getDeviceId();
            const normalizedEmail = email ? email.trim().toLowerCase() : '';
            const payload = authMethod === 'email' ? { email: normalizedEmail, otp: verifyCode, deviceId } : { phone, otp: verifyCode, deviceId };
            const res = await axios.post(`${API_URL}/auth/verify-otp`, payload);

            if (res.data.user) {
                const { user, token } = res.data;
                await AsyncStorage.setItem('token', token);
                await AsyncStorage.setItem('user', JSON.stringify(user));

                // Initialize global ChatProvider context immediately
                await refreshUser();

                if (user.onboarding_completed) {
                    // Register notifications after login
                    const tokenResult = await NotificationService.registerForPushNotificationsAsync();
                    if (tokenResult) await NotificationService.updateServerToken(user.id, tokenResult);
                    
                    navigation.replace('Main', { user: { ...user, token } });
                } else {
                    navigation.replace('Onboarding', { userId: user.id, token });
                }
            }
        } catch (error) {
            setAlert({ visible: true, title: 'Hata', message: error.response?.data?.error || `${error.message} (${error.config?.url || 'URL Yok'})`, type: 'error' });
            setOtp('');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        try {
            await GoogleSignin.hasPlayServices();
            const userInfo = await GoogleSignin.signIn();
            const idToken = userInfo.idToken;
            const deviceId = await getDeviceId();

            // Verify with backend
            const res = await axios.post(`${API_URL}/auth/google`, { idToken, deviceId });

            if (res.data.user) {
                const { user, token } = res.data;
                await AsyncStorage.setItem('token', token);
                await AsyncStorage.setItem('user', JSON.stringify(user));

                // Initialize global ChatProvider context immediately
                await refreshUser();

                if (user.onboarding_completed) {
                    // Register notifications after login
                    const tokenResult = await NotificationService.registerForPushNotificationsAsync();
                    if (tokenResult) await NotificationService.updateServerToken(user.id, tokenResult);
                    
                    navigation.replace('Main', { user: { ...user, token } });
                } else {
                    navigation.replace('Onboarding', { userId: user.id, token });
                }
            }
        } catch (error) {
            if (error.code === statusCodes.SIGN_IN_CANCELLED) {
                // ignore
            } else if (error.code === statusCodes.IN_PROGRESS) {
                // ignore
            } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
                setAlert({ visible: true, title: 'Hata', message: 'Google Play Servisleri güncel değil.', type: 'error' });
            } else {
                setAlert({ visible: true, title: 'Giriş Hatası', message: 'Google ile giriş yapılamadı.', type: 'error' });
                console.error(error);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleTestLogin = async () => {
        setLoading(true);
        try {
            // 1. Ensure Test User Exists
            await axios.post(`${API_URL}/admin/create-simple-user`);

            // 2. Login
            const res = await axios.post(`${API_URL}/auth/login-email`, { email: '1', password: '1' });

            if (res.data.user) {
                const { user, token } = res.data;
                await AsyncStorage.setItem('token', token);
                await AsyncStorage.setItem('user', JSON.stringify(user));
                
                // Initialize global ChatProvider context immediately
                await refreshUser();
                
                // Register notifications after login
                const tokenResult = await NotificationService.registerForPushNotificationsAsync();
                if (tokenResult) await NotificationService.updateServerToken(user.id, tokenResult);

                navigation.replace('Main', { user: { ...user, token } });
            }
        } catch (error) {
            console.error(error);
            setAlert({ visible: true, title: 'Test Giriş Hatası', message: error.message, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleDomainSuggestion = (domain) => {
        if (!email) {
            setEmail(domain);
            return;
        }
        if (email.includes('@')) {
            const parts = email.split('@');
            setEmail(parts[0] + domain);
        } else {
            setEmail(email + domain);
        }
    };

    const resetAuth = () => {
        if (navigation.canGoBack()) {
            navigation.goBack();
        } else {
            navigation.replace('Welcome');
        }
    };

    const renderStep0 = () => (
        <Animated.View entering={FadeInUp} exiting={SlideOutLeft} style={styles.stepContainer}>
            <Text style={styles.title}>Hoş Geldiniz</Text>
            <Text style={styles.subtitle}>Devam etmek için bir yöntem seçin</Text>

            <WelcomeButton
                title="Telefon ile devam et"
                icon="call-outline"
                onPress={() => { setAuthMethod('phone'); setStep(1); }}
            />
            <WelcomeButton
                title="Google ile devam et"
                icon="logo-google"
                onPress={handleGoogleLogin}
            />
            <WelcomeButton
                title="E-posta ile devam et"
                icon="mail-outline"
                variant="gradient"
                onPress={() => { setAuthMethod('email'); setStep(1); }}
            />

            <TouchableOpacity onPress={handleTestLogin} style={{ marginTop: 20, backgroundColor: '#ef4444', padding: 15, borderRadius: 12, alignItems: 'center' }}>
                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>
                    GELİŞTİRİCİ: TEST GİRİŞİ YAP
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 10 }}>
                    (Google sorunu varsa buna tıkla)
                </Text>
            </TouchableOpacity>
        </Animated.View>
    );

    const renderStep1 = () => (
        <Animated.View entering={SlideInRight} exiting={SlideOutLeft} style={styles.stepContainer}>
            <TouchableOpacity onPress={resetAuth} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>

            <Text style={styles.title}>
                {authMethod === 'email' ? 'E-posta Adresin' : 'Telefon Numaran'}
            </Text>
            <Text style={styles.subtitle}>
                Doğrulama kodu göndereceğiz
            </Text>

            {authMethod === 'email' ? (
                <GlassInput
                    label="E-posta"
                    value={email}
                    onChangeText={(val) => setEmail(val.trim().toLowerCase())}
                    keyboardType="email-address"
                />
            ) : (
                <GlassInput
                    label="Telefon (05xx xxx xx xx)"
                    value={phone}
                    onChangeText={(val) => {
                        const numericVal = val.replace(/[^0-9]/g, '');
                        setPhone(numericVal);
                    }}
                    keyboardType="phone-pad"
                    maxLength={11}
                />
            )}

            {authMethod === 'email' && (
                <View style={styles.suggestionRow}>
                    {['@gmail.com', '@hotmail.com', '@outlook.com'].map((domain) => (
                        <TouchableOpacity
                            key={domain}
                            style={styles.suggestionChip}
                            onPress={() => handleDomainSuggestion(domain)}
                        >
                            <Text style={styles.suggestionText}>{domain}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            <WelcomeButton
                title="KOD GÖNDER"
                variant="gradient"
                onPress={handleRequestOtp}
                loading={loading}
            />
        </Animated.View>
    );

    const renderStep2 = () => (
        <Animated.View entering={SlideInRight} style={styles.stepContainer}>
            <TouchableOpacity onPress={() => setStep(1)} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>

            <Text style={styles.title}>Kodu Doğrula</Text>
            <Text style={styles.subtitle}>
                {authMethod === 'email' ? email : phone} adresine gönderilen 6 haneli kodu girin.
            </Text>

            <OtpInput
                value={otp}
                onChangeText={(val) => {
                    setOtp(val);
                    if (val.length === 6) {
                        // Auto-submit immediately using latest string to bypass state delay
                        handleVerifyOtp(val);
                    }
                }}
            />

            <WelcomeButton
                title="DEVAM ET"
                variant="gradient"
                onPress={() => handleVerifyOtp()}
                loading={loading}
                style={{ marginTop: 25 }}
            />

            <WelcomeButton
                title="E-POSTAYI DEĞİŞTİR"
                variant="outline"
                onPress={() => {
                    setOtp('');
                    setStep(1);
                }}
                style={{ marginTop: 10 }}
            />

            <TouchableOpacity 
                style={[styles.resendButton, resendCountdown > 0 && { opacity: 0.5 }, { marginTop: 20 }]} 
                onPress={handleRequestOtp}
                disabled={resendCountdown > 0 || loading}
            >
                <Text style={styles.resendText}>
                    {resendCountdown > 0 
                        ? `Kodu tekrar gönder (${resendCountdown}s)` 
                        : 'Kodu tekrar gönder'}
                </Text>
            </TouchableOpacity>
        </Animated.View>
    );

    return (
        <View style={styles.container}>
            <AuthBackground />

            <View style={styles.topSection}>
                <FloatingProfiles />
                <LinearGradient
                    colors={['rgba(15, 23, 42, 0.92)', 'rgba(15, 23, 42, 0.98)']}
                    style={StyleSheet.absoluteFill}
                />
            </View>

            <Animated.View style={[styles.bottomSheet, animatedSheetStyle]}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.sheetContent}
                >
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                        {step === 0 && renderStep0()}
                        {step === 1 && renderStep1()}
                        {step === 2 && renderStep2()}
                    </ScrollView>
                </KeyboardAvoidingView>
            </Animated.View>

            <ModernAlert
                visible={alert.visible}
                title={alert.title}
                message={alert.message}
                type={alert.type}
                onClose={() => {
                    if (alert.onClose) alert.onClose();
                    setAlert({ ...alert, visible: false });
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    topSection: {
        height: height * 0.15,
        width: '100%',
    },
    logoContainer: {
        alignItems: 'center',
        marginTop: 20,
    },
    logoCircle: {
        width: 70,
        height: 70,
        borderRadius: 35,
        padding: 2,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    logoGradient: {
        flex: 1,
        borderRadius: 35,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bottomSheet: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: height * 0.95,
        backgroundColor: '#0f172a',
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
        paddingTop: 30,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -10 },
                shadowOpacity: 0.3,
                shadowRadius: 20,
            },
            android: {
                elevation: 20,
            },
        }),
    },
    sheetContent: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 30,
        paddingBottom: 100,
    },
    stepContainer: {
        width: '100%',
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: 'white',
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.6)',
        marginTop: 4,
        marginBottom: 30,
    },
    backButton: {
        marginBottom: 20,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    resendButton: {
        marginTop: 20,
        alignItems: 'center',
    },
    resendText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 14,
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
    suggestionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        marginTop: 10,
        marginBottom: 20,
    },
    suggestionChip: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 18,
        paddingHorizontal: 8,
        paddingVertical: 8,
        justifyContent: 'center',
        alignItems: 'center',
        flex: 1,
        marginHorizontal: 4,
    },
    suggestionText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '600',
        fontFamily: 'Outfit_500Medium',
    }
});
