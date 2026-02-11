import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Image, KeyboardAvoidingView, Platform, TouchableOpacity, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { API_URL } from '../config';
import { COLORS } from '../theme';
import GradientButton from '../components/ui/GradientButton';
import GlassCard from '../components/ui/GlassCard';
import { Motion } from '../components/motion/MotionSystem';
import ModernAlert from '../components/ui/ModernAlert';

export default function SignupScreen({ navigation }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [alert, setAlert] = useState({ visible: false, title: '', message: '', type: 'info' });

    const handleSignup = async () => {
        if (!email || !password) {
            setAlert({ visible: true, title: 'Hata', message: 'Lütfen tüm alanları doldurun.', type: 'warning' });
            return;
        }

        setLoading(true);
        try {
            const res = await axios.post(`${API_URL}/register`, { email, password });
            if (res.data.user) {
                setAlert({
                    visible: true,
                    title: 'Başarılı',
                    message: 'Hesabınız oluşturuldu! Şimdi kurulum yapabilirsiniz.',
                    type: 'success',
                    onClose: () => navigation.replace('Onboarding', { userId: res.data.user.id, token: res.data.token })
                });
            }
        } catch (error) {
            const msg = error.response?.data?.error || 'Kayıt başarısız.';
            setAlert({
                visible: true,
                title: 'Kayıt Hatası',
                message: msg === 'Email already in use' ? 'Bu email zaten kullanılıyor.' : msg,
                type: 'error'
            });
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
                        <Text style={styles.greeting}>Aramıza Katıl!</Text>
                        <Text style={styles.subtitle}>Yeni bir başlangıç yap.</Text>

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>EMAIL ADRESİ</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="name@example.com"
                                placeholderTextColor="#64748b"
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
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
                            title="KAYIT OL"
                            onPress={handleSignup}
                            loading={loading}
                            style={styles.button}
                        />

                        <View style={styles.loginRow}>
                            <Text style={styles.footerText}>Zaten hesabın var mı? </Text>
                            <TouchableOpacity onPress={() => navigation.goBack()}>
                                <Text style={styles.loginLink}>Giriş Yap</Text>
                            </TouchableOpacity>
                        </View>
                    </GlassCard>
                </Motion.SlideUp>
            </KeyboardAvoidingView>
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
    loginRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 10,
    },
    footerText: {
        color: COLORS.textSecondary,
        fontSize: 14,
    },
    loginLink: {
        color: '#d946ef',
        fontWeight: 'bold',
        fontSize: 14,
    }
});
