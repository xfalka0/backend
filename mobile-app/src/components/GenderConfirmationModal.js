import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, BackHandler } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';
import GlassCard from './ui/GlassCard';
import GradientButton from './ui/GradientButton';
import { useAppStore } from '../store/useAppStore';

export function needsGenderConfirmation(u) {
    if (!u || !u.id || u.id === 'guest') return false;
    if (u.gender_confirmed_at) return false;
    const staffRoles = ['admin', 'super_admin', 'operator', 'moderator', 'staff', 'coin_bayisi'];
    if (staffRoles.includes(u.role) || u.gender === 'coin_bayisi') return false;
    return true;
}

export default function GenderConfirmationModal({ visible, user, onConfirmed }) {
    const [loading, setLoading] = useState(false);
    const [selectedGender, setSelectedGender] = useState(null); // 'erkek' or 'kadin'
    const [step, setStep] = useState(1); // 1: verify existing, 2: change gender

    useEffect(() => {
        if (!visible) {
            setStep(1);
            setSelectedGender(null);
            setLoading(false);
        }
    }, [visible, user?.id]);

    // Trap Android hardware Back button while mandatory gender blocker is visible
    useEffect(() => {
        if (!visible) return;
        const backSub = BackHandler.addEventListener('hardwareBackPress', () => true);
        return () => backSub.remove();
    }, [visible]);

    const currentGenderLabel = user?.gender === 'kadin' ? 'Kadın' : (user?.gender === 'erkek' ? 'Erkek' : 'Belirtilmemiş');

    const submitGender = async (finalGender) => {
        if (!user?.id || loading) return;
        setLoading(true);
        try {
            const token = await AsyncStorage.getItem('token');
            const res = await axios.put(`${API_URL}/users/${user.id}/gender-confirm`, 
                { gender: finalGender },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            // Sync authoritative confirmation state to store and storage
            const serverUser = res.data?.user || (res.data?.id ? res.data : null);
            const mergedUser = {
                ...(useAppStore.getState().user || user),
                ...(serverUser || {}),
                gender: finalGender,
                gender_confirmed_at: serverUser?.gender_confirmed_at || new Date().toISOString(),
            };
            await AsyncStorage.setItem('user', JSON.stringify(mergedUser));
            useAppStore.getState().setUser(mergedUser);
            useAppStore.getState().setServerAuthSync(true);
            
            onConfirmed?.(mergedUser);
        } catch (e) {
            console.error('Gender confirm error:', e.response?.data || e.message);
            const errMsg = e.response?.data?.error || 'Bir hata oluştu.';
            
            // Eğer zaten doğrulanmış hatası alırsak (bu cihazda eski kalmışsa), 
            // lokal datayı güncelleyip modalı kapatalım ki kullanıcı sıkışmasın.
            if (errMsg.includes('daha önce doğruladınız')) {
                const mergedUser = {
                    ...(useAppStore.getState().user || user),
                    gender_confirmed_at: new Date().toISOString(),
                };
                await AsyncStorage.setItem('user', JSON.stringify(mergedUser));
                useAppStore.getState().setUser(mergedUser);
                useAppStore.getState().setServerAuthSync(true);
                onConfirmed?.(mergedUser);
            } else {
                alert(errMsg);
            }
        } finally {
            setLoading(false);
        }
    };

    if (!visible) return null;

    // Render in MainActivity window (not Android Dialog <Modal>) so hardware Back cannot dismiss natively
    return (
        <View
            style={styles.overlay}
            pointerEvents="auto"
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
        >
            <View style={styles.modalContainer}>
                <GlassCard style={styles.card}>
                        <View style={styles.iconContainer}>
                            <LinearGradient colors={['#a855f7', '#ec4899']} style={styles.iconBg}>
                                <Ionicons name="shield-checkmark" size={32} color="white" />
                            </LinearGradient>
                        </View>
                        
                        <Text style={styles.title}>Cinsiyetini Doğrula</Text>
                        <Text style={styles.subtitle}>Keşfette karşı cins profilleri görürsün, bu yüzden bilgin doğru olmalı. Lütfen mevcut cinsiyetini onayla.</Text>
                        
                        {step === 1 && (
                            <View style={styles.stepContainer}>
                                <View style={styles.currentInfo}>
                                    <Text style={styles.currentLabel}>Şu anki cinsiyetin:</Text>
                                    <Text style={styles.currentValue}>{currentGenderLabel}</Text>
                                </View>

                                <View style={styles.buttonRow}>
                                    <GradientButton 
                                        title="Değiştir" 
                                        onPress={() => setStep(2)} 
                                        style={styles.flexBtn} 
                                        colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.1)']}
                                        textColor="white"
                                    />
                                    <View style={{ width: 10 }} />
                                    <GradientButton 
                                        title="Doğru" 
                                        onPress={() => submitGender(user?.gender === 'kadin' ? 'kadin' : 'erkek')} 
                                        style={styles.flexBtn} 
                                        loading={loading}
                                    />
                                </View>
                            </View>
                        )}

                        {step === 2 && (
                            <View style={styles.stepContainer}>
                                <Text style={styles.selectLabel}>Doğru cinsiyetini seç:</Text>
                                <View style={styles.optionsRow}>
                                    <GradientButton 
                                        title="Kadınım" 
                                        onPress={() => setSelectedGender('kadin')}
                                        style={styles.flexBtn}
                                        colors={selectedGender === 'kadin' ? ['#ec4899', '#f472b6'] : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.1)']}
                                    />
                                    <View style={{ width: 10 }} />
                                    <GradientButton 
                                        title="Erkeğim" 
                                        onPress={() => setSelectedGender('erkek')}
                                        style={styles.flexBtn}
                                        colors={selectedGender === 'erkek' ? ['#3b82f6', '#60a5fa'] : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.1)']}
                                    />
                                </View>

                                <GradientButton 
                                    title="Onayla ve Devam Et"
                                    onPress={() => submitGender(selectedGender)}
                                    disabled={!selectedGender}
                                    loading={loading}
                                    style={{ marginTop: 20 }}
                                />
                            </View>
                        )}
                    </GlassCard>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 99999,
        elevation: 99999,
        backgroundColor: 'rgba(0,0,0,0.92)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContainer: {
        width: '100%',
        maxWidth: 400,
    },
    card: {
        padding: 24,
        alignItems: 'center',
    },
    iconContainer: {
        marginBottom: 16,
    },
    iconBg: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.7)',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20,
    },
    stepContainer: {
        width: '100%',
    },
    currentInfo: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    currentLabel: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
        marginBottom: 4,
    },
    currentValue: {
        color: 'white',
        fontSize: 20,
        fontWeight: 'bold',
    },
    selectLabel: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 12,
        textAlign: 'center',
    },
    buttonRow: {
        flexDirection: 'row',
        width: '100%',
    },
    optionsRow: {
        flexDirection: 'row',
        width: '100%',
    },
    flexBtn: {
        flex: 1,
    }
});
