import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Dimensions, ActivityIndicator, Alert, Animated } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';
import { useAlert } from '../contexts/AlertContext';
import Confetti from './ui/Confetti';
import { useStarterPack } from '../contexts/StarterPackContext';

import { PurchaseService } from '../services/purchaseService';

const { width } = Dimensions.get('window');

export default function InsufficientCoinsModal({ visible, onClose, onBuyCoins, onPurchaseSuccess }) {
    const [loading, setLoading] = useState(false);
    const [starterPack, setStarterPack] = useState({
        coins: 300,
        price: 199.99,
        discounted_price: 99.99
    });
    const [isEligible, setIsEligible] = useState(true);
    const [timeLeft, setTimeLeft] = useState('23:59:59');
    const [showConfetti, setShowConfetti] = useState(false);
    const { showAlert } = useAlert();
    const { completeStarterPack } = useStarterPack();

    // Animations
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.9)).current;
    const floatAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const heartAnims = useRef([...Array(5)].map(() => new Animated.Value(0))).current;

    const animationsRef = useRef([]);

    useEffect(() => {
        if (visible) {
            checkEligibility();
            startAnimations();
            
            let totalSeconds = 23 * 3600 + 59 * 60 + 59;
            const interval = setInterval(() => {
                totalSeconds--;
                if (totalSeconds <= 0) {
                    clearInterval(interval);
                    return;
                }
                const h = Math.floor(totalSeconds / 3600);
                const m = Math.floor((totalSeconds % 3600) / 60);
                const s = totalSeconds % 60;
                setTimeLeft(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
            }, 1000);

            return () => {
                clearInterval(interval);
                animationsRef.current.forEach(anim => anim?.stop());
                animationsRef.current = [];
            };
        } else {
            fadeAnim.setValue(0);
            scaleAnim.setValue(0.95);
        }
    }, [visible]);

    const checkEligibility = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) return;
            const res = await axios.get(`${API_URL}/starter-pack/check`, {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 3000
            });
            setIsEligible(true); 
            if (res.data.eligible) {
                setStarterPack(res.data.pack);
            }
        } catch (error) {
            setIsEligible(true); 
        }
    };

    const startAnimations = () => {
        const mainAnims = Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
            Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
            Animated.loop(
                Animated.sequence([
                    Animated.timing(floatAnim, { toValue: 1, duration: 2500, useNativeDriver: true }),
                    Animated.timing(floatAnim, { toValue: 0, duration: 2500, useNativeDriver: true })
                ])
            ),
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.06, duration: 800, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true })
                ])
            )
        ]);

        mainAnims.start();
        animationsRef.current.push(mainAnims);

        heartAnims.forEach((anim, i) => {
            anim.setValue(0);
            const heartLoop = Animated.loop(
                Animated.sequence([
                    Animated.delay(i * 400),
                    Animated.timing(anim, { toValue: 1, duration: 3000, useNativeDriver: true })
                ])
            );
            heartLoop.start();
            animationsRef.current.push(heartLoop);
        });
    };

    const handleStarterPurchase = async () => {
        setLoading(true);
        try {
            // 1. Fetch available packages from RevenueCat
            const packages = await PurchaseService.getOfferings();
            
            if (!packages || packages.length === 0) {
                showAlert({
                    title: "Hata",
                    message: "Satın alma seçenekleri şu an yüklenemedi.",
                    type: "error"
                });
                setLoading(false);
                return;
            }

            // Find our starter package (searching for 'starter' and '300' in identifier)
            console.log('[Store] Available IDs:', packages.map(p => p.product.identifier));
            
            const starterPackage = packages.find(p => {
                const id = p.product.identifier.toLowerCase();
                // Match common starter pack naming patterns
                return id === 'starter300' ||
                       id.includes('starter:starter300') ||
                       (id.includes('starter') && id.includes('300')) || 
                       (id.includes('baslangic') && id.includes('300')) ||
                       id === 'starter_pack' || id === '300_coins_starter';
            });

            if (!starterPackage) {
                console.warn('[Store] Starter package not found. Matching criteria failed.');
                showAlert({
                    title: "Hata",
                    message: "Özel teklif paketi mağazada bulunamadı. Lütfen teknik destek ile iletişime geçin.",
                    type: "error"
                });
                setLoading(false);
                return;
            }

            // 2. Trigger Real Purchase
            const result = await PurchaseService.purchasePackage(starterPackage);
            
            if (result.success) {
                const token = await AsyncStorage.getItem('token');
                const backendRes = await axios.post(`${API_URL}/starter-pack/purchase`, {
                    transactionId: result.transactionId || `rc_${Date.now()}`
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (backendRes.data.success) {
                    setShowConfetti(true);
                    showAlert({
                        title: "Başarılı!",
                        message: "300 Coin hesabınıza eklendi. Keyifli sohbetler!",
                        type: "success",
                        onConfirm: () => {
                            completeStarterPack();
                            if (onPurchaseSuccess) {
                                onPurchaseSuccess();
                            } else {
                                onClose();
                            }
                        }
                    });
                } else {
                    showAlert({
                        title: "Bilgi",
                        message: "Ödeme başarılı ancak bakiye güncellenirken bir sorun oluştu.",
                        type: "warning"
                    });
                }
            } else if (!result.cancelled) {
                showAlert({
                    title: "Hata",
                    message: result.error || "Satın alma işlemi tamamlanamadı.",
                    type: "error"
                });
            }
        } catch (error) {
            console.error('[Purchase] Error:', error);
            
            const serverMsg = error.response?.data?.error;
            const isAlreadyBought = serverMsg?.includes('daha önce') || error.response?.status === 400;

            if (isAlreadyBought) {
                showAlert({
                    title: "Bilgi",
                    message: "Bu paketi zaten satın almışsınız. Bakiyeniz güncel değilse lütfen uygulamayı kapatıp açın.",
                    type: "info",
                    onConfirm: () => {
                        completeStarterPack();
                        onClose();
                    }
                });
            } else {
                showAlert({
                    title: "Hata",
                    message: serverMsg || "Bir sorun oluştu: " + error.message,
                    type: "error"
                });
            }
        } finally {
            setLoading(false);
        }
    };

    const renderStarterPack = () => (
        <Animated.View style={[styles.modalContainer, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
            <LinearGradient
                colors={['#1a103d', '#0c071e']}
                style={styles.card}
            >
                {/* BACKGROUND DECORATION */}
                <View style={styles.bgDecoration}>
                    {heartAnims.map((anim, i) => (
                        <Animated.View 
                            key={i}
                            style={[
                                styles.floatingHeart, 
                                { 
                                    left: (i * 20) + '%',
                                    opacity: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.2, 0] }),
                                    transform: [
                                        { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [200, -200] }) },
                                        { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.5] }) }
                                    ]
                                }
                            ]}
                        >
                            <Ionicons name="heart" size={24} color="#ec4899" />
                        </Animated.View>
                    ))}
                    <Animated.View style={[styles.glowBall, { opacity: 0.15, transform: [{ translateY: floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 30] }) }] }]} />
                </View>

                {/* CLOSE BUTTON */}
                <TouchableOpacity 
                    style={styles.closeButton} 
                    onPress={onClose}
                    activeOpacity={0.7}
                >
                    <Ionicons name="close" size={22} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>

                {/* TOP BADGE */}
                <LinearGradient
                    colors={['#ec4899', '#8b5cf6']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.specialBadge}
                >
                    <Text style={styles.specialBadgeText}>%80 İNDİRİM</Text>
                </LinearGradient>

                {/* HEADER */}
                <Text style={styles.topLabel}>ÖZEL TEKLİF</Text>
                <Text style={[styles.titleSpecial, { marginTop: 5 }]}>Sohbet Yarım Kalmasın 💜</Text>
                <Text style={styles.messageSpecial}>
                    Ona söyleyeceklerin bitmedi, değil mi? Sohbetin devam etmesi için özel fırsatı kaçırma.
                </Text>

                {/* PRICE SECTION */}
                <View style={styles.priceSection}>
                    <Text style={styles.oldPrice}>199.99 TL</Text>
                    <Text style={styles.newPrice}>99.99 TL</Text>
                </View>

                {/* PRODUCT PILL */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <MaterialCommunityIcons name="lightning-bolt" size={16} color="#fcd34d" />
                    <Text style={{ color: '#fcd34d', fontSize: 13, fontWeight: '900', marginLeft: 4 }}>200 Coin + 100 Bonus</Text>
                </View>

                {/* CTA BUTTON */}
                <Animated.View style={[styles.ctaButtonWrapper, { transform: [{ scale: pulseAnim }] }]}>
                    <TouchableOpacity 
                        onPress={handleStarterPurchase} 
                        activeOpacity={0.8}
                        disabled={loading}
                        style={{ width: '100%' }}
                    >
                        <LinearGradient
                            colors={['#f59e0b', '#ea580c']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.ctaButton}
                        >
                            {loading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text style={styles.ctaButtonText}>Şimdi Aç 🔥</Text>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </Animated.View>

                {/* COUNTDOWN */}
                <View style={styles.footer}>
                    <Text style={styles.timerText}>Teklif {timeLeft} içinde bitiyor</Text>
                </View>
            </LinearGradient>
        </Animated.View>
    );

    return (
        <>
            <Modal
                visible={visible}
                transparent
                animationType="none"
                onRequestClose={onClose}
            >
                <View style={styles.overlay}>
                    {renderStarterPack()}
                </View>
            </Modal>
            {showConfetti && <Confetti onFinish={() => setShowConfetti(false)} />}
        </>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContainer: {
        width: width * 0.72,
        borderRadius: 20,
        overflow: 'hidden',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
    },
    card: {
        width: '100%',
        paddingVertical: 18,
        paddingHorizontal: 16,
        alignItems: 'center',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    bgDecoration: {
        ...StyleSheet.absoluteFillObject,
        overflow: 'hidden',
    },
    floatingHeart: {
        position: 'absolute',
    },
    glowBall: {
        position: 'absolute',
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#8b5cf6',
        top: -30,
        right: -30,
    },
    closeButton: {
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 20,
        padding: 5,
    },
    specialBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        position: 'absolute',
        top: 12,
        left: 12,
        zIndex: 10,
    },
    specialBadgeText: {
        color: '#fff',
        fontSize: 8,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    iconContainerMain: {
        marginTop: 0,
        marginBottom: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    mainGlow: {
        position: 'absolute',
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#8b5cf6',
        opacity: 0.2,
    },
    iconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.25)',
    },
    activeDot: {
        position: 'absolute',
        top: 2,
        right: 2,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#22c55e',
        borderWidth: 1.5,
        borderColor: '#1a103d',
    },
    socialProof: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.08)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        marginBottom: 10,
    },
    socialProofText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '700',
    },
    pulseDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#22c55e',
        marginRight: 5,
    },
    topLabel: {
        color: '#ec4899',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 4,
        marginTop: -5,
        textTransform: 'uppercase',
    },
    titleSpecial: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '900',
        textAlign: 'center',
        marginBottom: 6,
    },
    messageSpecial: {
        color: 'rgba(255,255,255,0.75)',
        fontSize: 11,
        textAlign: 'center',
        lineHeight: 15,
        marginBottom: 12,
        paddingHorizontal: 5,
    },
    priceSection: {
        alignItems: 'center',
        marginBottom: 10,
    },
    oldPrice: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 14,
        textDecorationLine: 'line-through',
        marginBottom: -2,
    },
    newPrice: {
        color: '#fff',
        fontSize: 38,
        fontWeight: '900',
        letterSpacing: -1,
        textShadowColor: 'rgba(139, 92, 246, 0.6)',
        textShadowOffset: { width: 0, height: 4 },
        textShadowRadius: 10,
    },
    ctaButtonWrapper: {
        width: '100%',
        shadowColor: '#ea580c',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
    },
    ctaButton: {
        width: '100%',
        height: 44,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ctaButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '900',
    },
    footer: {
        marginTop: 12,
        alignItems: 'center',
    },
    timerText: {
        color: '#ec4899',
        fontSize: 10,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 6,
    },
    dismissBtnText: {
        color: 'rgba(255,255,255,0.45)',
        fontSize: 11,
        fontWeight: '700',
    }
});
