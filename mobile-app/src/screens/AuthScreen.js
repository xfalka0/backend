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
import { COLORS } from '../theme';
import AuthBackground from '../components/animated/AuthBackground';
import GlassInput from '../components/ui/GlassInput';
import WelcomeButton from '../components/ui/WelcomeButton';
import FloatingProfiles from '../components/animated/FloatingProfiles';
import OtpInput from '../components/ui/OtpInput';
import ModernAlert from '../components/ui/ModernAlert';

const { width, height } = Dimensions.get('window');

export default function AuthScreen({ navigation, route }) {
    // Steps: 0: Method Selection, 1: Identifier Input, 2: OTP Entry
    const [step, setStep] = useState(1);
    const [authMethod, setAuthMethod] = useState('email'); // Default to email
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('+90');
    const [otp, setOtp] = useState('');
    const [password, setPassword] = useState('');
    const [isRegisterMode, setIsRegisterMode] = useState(false);
    const [loading, setLoading] = useState(false);
    const [alert, setAlert] = useState({ visible: false, title: '', message: '', type: 'error' });

    const sheetY = useSharedValue(height);

    useEffect(() => {
        sheetY.value = withSpring(height * 0.35, { damping: 15 });

        GoogleSignin.configure({
            webClientId: '412160281837-aru1hd03qt91r9s42hnn2scvnfgc9sf0.apps.googleusercontent.com',
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

    const animatedSheetStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: sheetY.value }],
    }));

    const handleEmailAuth = async () => {
        if (!email || !password) {
            setAlert({ visible: true, title: 'Hata', message: 'Lütfen tüm alanları doldurun.', type: 'error' });
            return;
        }

        setLoading(true);
        try {
            const endpoint = isRegisterMode ? '/auth/register-email' : '/auth/login-email';
            const payload = { email, password };
            const res = await axios.post(`${API_URL}${endpoint}`, payload);

            if (res.data.user) {
                const { user, token } = res.data;
                await AsyncStorage.setItem('token', token);
                await AsyncStorage.setItem('user', JSON.stringify(user));

                if (user.onboarding_completed) {
                    navigation.replace('Main', { user: { ...user, token } });
                } else {
                    navigation.replace('Onboarding', { userId: user.id, token });
                }
            }
        } catch (error) {
            setAlert({ visible: true, title: 'Hata', message: error.response?.data?.error || 'Giriş yapılamadı.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleRequestOtp = async () => {
        if (authMethod === 'email') {
            handleEmailAuth();
            return;
        }

        const identifier = phone;
        if (!identifier || phone.length < 10) {
            setAlert({ visible: true, title: 'Hata', message: 'Lütfen geçerli bir telefon numarası girin.', type: 'error' });
            return;
        }

        setLoading(true);
        try {
            const res = await axios.post(`${API_URL}/auth/request-otp`, { phone });

            if (res.data.success) {
                setStep(2);
                if (res.data.dev_otp) {
                    setAlert({ visible: true, title: 'DEV MODU', message: `Kodunuz: ${res.data.dev_otp}`, type: 'info' });
                }
            }
        } catch (error) {
            setAlert({ visible: true, title: 'Hata', message: error.response?.data?.error || 'Kod gönderilemedi.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (otp.length < 6) return;

        setLoading(true);
        try {
            const payload = { phone, otp };
            const res = await axios.post(`${API_URL}/auth/verify-otp`, payload);

            if (res.data.user) {
                const { user, token } = res.data;
                await AsyncStorage.setItem('token', token);
                await AsyncStorage.setItem('user', JSON.stringify(user));

                if (user.onboarding_completed) {
                    navigation.replace('Main', { user: { ...user, token } });
                } else {
                    navigation.replace('Onboarding', { userId: user.id, token });
                }
            }
        } catch (error) {
            setAlert({ visible: true, title: 'Hata', message: error.response?.data?.error || 'Kod doğrulanamadı.', type: 'error' });
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

            // Verify with backend
            const res = await axios.post(`${API_URL}/auth/google`, { idToken });

            if (res.data.user) {
                const { user, token } = res.data;
                await AsyncStorage.setItem('token', token);
                await AsyncStorage.setItem('user', JSON.stringify(user));

                if (user.onboarding_completed) {
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
                navigation.replace('Main', { user: { ...user, token } });
            }
        } catch (error) {
            console.error(error);
            setAlert({ visible: true, title: 'Test Giriş Hatası', message: error.message, type: 'error' });
        } finally {
            setLoading(false);
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
                {authMethod === 'email' ? (isRegisterMode ? 'Hesap Oluştur' : 'Giriş Yap') : 'Telefon Numaran'}
            </Text>
            <Text style={styles.subtitle}>
                {authMethod === 'email'
                    ? (isRegisterMode ? 'Kaydolmak için bilgileri girin' : 'Devam etmek için giriş yapın')
                    : 'Doğrulama kodu göndereceğiz'}
            </Text>

            {authMethod === 'email' ? (
                <>
                    <GlassInput
                        label="E-posta"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                    />
                    <GlassInput
                        label="Şifre"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />
                </>
            ) : (
                <GlassInput
                    label="Telefon"
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                />
            )}

            <WelcomeButton
                title={authMethod === 'email' ? (isRegisterMode ? 'KAYIT OL' : 'GİRİŞ YAP') : 'KOD GÖNDER'}
                variant="gradient"
                onPress={handleRequestOtp}
                loading={loading}
            />

            {authMethod === 'email' && (
                <TouchableOpacity
                    onPress={() => setIsRegisterMode(!isRegisterMode)}
                    style={{ alignSelf: 'center', marginTop: 16 }}
                >
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>
                        {isRegisterMode ? 'Zaten hesabın var mı? Giriş yap' : 'Hesabın yok mu? Kayıt ol'}
                    </Text>
                </TouchableOpacity>
            )}
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
                        // Auto verify when 6 chars entered
                        setTimeout(() => handleVerifyOtp(), 100);
                    }
                }}
            />

            {loading && <ActivityIndicator size="large" color="#8b5cf6" style={{ marginTop: 20 }} />}

            <TouchableOpacity style={styles.resendButton} onPress={handleRequestOtp}>
                <Text style={styles.resendText}>Kodu tekrar gönder</Text>
            </TouchableOpacity>
        </Animated.View>
    );

    return (
        <View style={styles.container}>
            <AuthBackground />

            <View style={styles.topSection}>
                <FloatingProfiles />
                <LinearGradient
                    colors={['rgba(15, 23, 42, 0.2)', 'rgba(15, 23, 42, 0.6)']}
                    style={StyleSheet.absoluteFill}
                />

                <SafeAreaView style={styles.logoContainer}>
                    <Animated.View entering={FadeIn.delay(300)}>
                        <View style={styles.logoCircle}>
                            <LinearGradient
                                colors={['#8b5cf6', '#ec4899']}
                                style={styles.logoGradient}
                            >
                                <Ionicons name="heart" size={32} color="white" />
                            </LinearGradient>
                        </View>
                    </Animated.View>
                </SafeAreaView>
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
        height: height * 0.45,
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
        height: height * 0.75,
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
    }
});
