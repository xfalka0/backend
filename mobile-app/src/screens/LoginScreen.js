import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, Image, KeyboardAvoidingView, Platform, Dimensions, TouchableOpacity } from 'react-native';
import { useAlert } from '../contexts/AlertContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { API_URL } from '../config';
import { COLORS } from '../theme';
import GradientButton from '../components/ui/GradientButton';
import GlassCard from '../components/ui/GlassCard';
import { Motion } from '../components/motion/MotionSystem';
import { GoogleSignin, GoogleSigninButton, statusCodes } from '@react-native-google-signin/google-signin';

const { width } = Dimensions.get('window');

export default function LoginScreen({ navigation }) {
    const { showAlert } = useAlert();
    const [email, setEmail] = useState('user@test.com');
    const [password, setPassword] = useState('pass123');
    const [loading, setLoading] = useState(false);
    const [wakingUp, setWakingUp] = useState(false);

    useEffect(() => {
        GoogleSignin.configure({
            webClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com', // Get this from Google Cloud Console
            offlineAccess: true,
        });
    }, []);

    const handleGoogleLogin = async () => {
        setLoading(true);
        try {
            // Attempt Real Login first
            await GoogleSignin.hasPlayServices();
            const userInfo = await GoogleSignin.signIn();
            const idToken = userInfo.idToken;
            await processLogin(idToken);
        } catch (error) {
            if (error.code === statusCodes.SIGN_IN_CANCELLED) {
                // User cancelled
            } else if (error.code === statusCodes.IN_PROGRESS) {
                // Operation in progress
            } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
                showAlert({ title: 'Hata', message: 'Google Play Servisleri güncel değil.', type: 'error' });
            } else {
                showAlert({ title: 'Giriş Hatası', message: 'Google ile giriş yapılamadı.', type: 'error' });
                console.error(error);
            }
        } finally {
            setLoading(false);
        }
    };

    const processLogin = async (idToken) => {
        try {
            const res = await axios.post(`${API_URL}/auth/google`, { idToken });

            if (res.data.user) {
                const userData = res.data.user;
                const token = res.data.token;

                await AsyncStorage.setItem('token', token);
                await AsyncStorage.setItem('user', JSON.stringify(userData));

                setLoading(false);
                if (userData.onboarding_completed) {
                    navigation.replace('Main', { user: { ...userData, token } });
                } else {
                    navigation.replace('Onboarding', { userId: userData.id, token: token });
                }
            }
        } catch (err) {
            setLoading(false);
            showAlert({ title: 'Sunucu Hatası', message: 'Giriş yapılamadı.', type: 'error' });
        }
    };

    const handleLogin = async () => {
        setLoading(true);
        setWakingUp(false);

        // Timer to show "waking up" message if takes too long
        const wakeTimer = setTimeout(() => {
            setWakingUp(true);
        }, 5000);

        try {
            const res = await axios.post(`${API_URL}/login`, { email, password }, { timeout: 30000 });
            clearTimeout(wakeTimer);
            setWakingUp(false);

            if (res.data.user) {
                const userData = res.data.user;
                const token = res.data.token;

                // Save to AsyncStorage
                await AsyncStorage.setItem('token', token);
                await AsyncStorage.setItem('user', JSON.stringify(userData));

                if (userData.onboarding_completed) {
                    navigation.replace('Main', { user: { ...userData, token } });
                } else {
                    navigation.replace('Onboarding', {
                        userId: userData.id,
                        token: token
                    });
                }
            }
        } catch (error) {
            clearTimeout(wakeTimer);
            setWakingUp(false);
            const msg = error.response?.data?.error || error.message || 'Giriş başarısız.';

            if (error.code === 'ECONNABORTED') {
                showAlert({
                    title: 'Bağlantı Zaman Aşımı',
                    message: 'Sunucuya bağlanılamadı. Lütfen internetinizi kontrol edip tekrar deneyin.',
                    type: 'error'
                });
            } else {
                showAlert({
                    title: 'Giriş Hatası',
                    message: msg === 'User not found' ? 'Kullanıcı bulunamadı veya şifre yanlış.' : msg,
                    type: 'error'
                });
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#0f172a', '#1e1b4b', '#0f172a']}
                style={styles.background}
            />

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.content}>
                <Motion.SlideUp delay={200}>
                    <View style={styles.header}>
                        <Image source={require('../../assets/icon.png')} style={styles.logo} />
                    </View>
                </Motion.SlideUp>

                <Motion.SlideUp delay={400}>
                    <GlassCard style={styles.card}>
                        <Text style={styles.greeting}>Tekrar Hoşgeldin!</Text>
                        <Text style={styles.subtitle}>Bağlanmaya hazır mısın?</Text>

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>EMAIL ADRESİ</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="name@example.com"
                                placeholderTextColor="#64748b"
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>ŞİFRE</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="••••••••"
                                placeholderTextColor="#64748b"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                            />
                        </View>

                        <GradientButton
                            title="GİRİŞ YAP"
                            onPress={handleLogin}
                            loading={loading}
                            style={styles.button}
                        />

                        {wakingUp && (
                            <Motion.Fade>
                                <Text style={styles.wakingUpText}>
                                    İstek biraz uzun sürüyor olabilir, sunucu uyandırılıyor...
                                </Text>
                            </Motion.Fade>
                        )}

                        <View style={styles.registerRow}>
                            <Text style={styles.footerText}>Hesabın yok mu? </Text>
                            <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
                                <Text style={styles.registerLink}>Kayıt Ol</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.divider}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>VEYA</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        <GoogleSigninButton
                            style={styles.googleButton}
                            size={GoogleSigninButton.Size.Wide}
                            color={GoogleSigninButton.Color.Dark}
                            onPress={handleGoogleLogin}
                            disabled={loading}
                        />
                    </GlassCard>
                </Motion.SlideUp>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    background: {
        ...StyleSheet.absoluteFillObject,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        padding: 24,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    logo: {
        width: 100,
        height: 100,
        borderRadius: 25,
    },
    card: {
        width: '100%',
    },
    greeting: {
        fontSize: 28,
        fontWeight: 'bold',
        color: 'white',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginBottom: 32,
    },
    inputContainer: {
        marginBottom: 20,
    },
    label: {
        fontSize: 12,
        fontWeight: 'bold',
        color: COLORS.textSecondary,
        marginBottom: 8,
        letterSpacing: 1,
    },
    input: {
        backgroundColor: COLORS.inputBg,
        borderRadius: 16,
        padding: 16,
        color: 'white',
        fontSize: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    button: {
        marginTop: 10,
        marginBottom: 20,
    },
    footerText: {
        textAlign: 'center',
        color: COLORS.textSecondary,
        fontSize: 14,
    },
    registerRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 10,
    },
    registerLink: {
        color: '#d946ef',
        fontWeight: 'bold',
        fontSize: 14,
        marginLeft: 5,
    },
    wakingUpText: {
        textAlign: 'center',
        color: COLORS.textSecondary,
        fontSize: 12,
        marginTop: 10,
        fontStyle: 'italic',
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 20,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    dividerText: {
        color: COLORS.textSecondary,
        marginHorizontal: 10,
        fontSize: 12,
        fontWeight: 'bold',
    },
    googleButton: {
        width: '100%',
        height: 50,
    }
});
