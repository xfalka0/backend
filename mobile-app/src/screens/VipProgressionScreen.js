import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Dimensions,
    ScrollView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withSequence,
    withTiming,
    Easing,
    withSpring
} from 'react-native-reanimated';
import VipFrame from '../components/ui/VipFrame';
import { API_URL } from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ModernAlert from '../components/ui/ModernAlert';

const { width } = Dimensions.get('window');

const VIP_THRESHOLDS = {
    1: 100,
    2: 1500,
    3: 10000,
    4: 20000,
    5: 40000,
    6: 100000
};

const VipProgressionScreen = ({ navigation, route }) => {
    const [loading, setLoading] = useState(true);
    const [purchasing, setPurchasing] = useState(false);
    const [coinAmount, setCoinAmount] = useState('');
    const [userBalance, setUserBalance] = useState(0);
    const [vipXp, setVipXp] = useState(0);
    const [vipLevel, setVipLevel] = useState(0);
    const [progress, setProgress] = useState(0);
    const [nextThreshold, setNextThreshold] = useState(0);
    const [alert, setAlert] = useState({ visible: false, title: '', message: '', type: 'info' });

    // Animations
    const shimmerX = useSharedValue(-width);
    const glowPulse = useSharedValue(1);
    const progressWidth = useSharedValue(0);

    useEffect(() => {
        // Shimmer effect
        shimmerX.value = withRepeat(
            withSequence(
                withTiming(width * 2, { duration: 2500, easing: Easing.linear }),
                withTiming(-width, { duration: 0 })
            ),
            -1,
            false
        );

        // Glow pulse
        glowPulse.value = withRepeat(
            withSequence(
                withTiming(1.15, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
                withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            true
        );

        fetchVipProgress();
    }, []);

    useEffect(() => {
        // Animate progress bar
        progressWidth.value = withSpring(progress, {
            damping: 15,
            stiffness: 90
        });
    }, [progress]);

    const fetchVipProgress = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            const userDataStr = await AsyncStorage.getItem('user');
            const userData = JSON.parse(userDataStr);

            // Get VIP progress
            const progressRes = await fetch(`${API_URL}/api/vip/progress`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const progressData = await progressRes.json();

            setVipXp(progressData.currentXp);
            setVipLevel(progressData.currentLevel);
            setProgress(progressData.progress);
            setNextThreshold(progressData.nextThreshold);
            setUserBalance(userData.balance || 0);
        } catch (error) {
            console.error('Error fetching VIP progress:', error);
            setAlert({ visible: true, title: 'Hata', message: 'VIP bilgileri yüklenemedi.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handlePurchase = async () => {
        const coins = parseInt(coinAmount);
        if (!coins || coins <= 0) {
            setAlert({ visible: true, title: 'Hata', message: 'Geçerli bir miktar girin.', type: 'warning' });
            return;
        }

        if (coins > userBalance) {
            setAlert({ visible: true, title: 'Yetersiz Bakiye', message: `${coins} coin gerekli, ${userBalance} coin mevcut.`, type: 'error' });
            return;
        }

        setPurchasing(true);
        try {
            const token = await AsyncStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/vip/purchase-xp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ coins })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Update local state
                setUserBalance(data.newBalance);
                setVipXp(data.newVipXp);
                setVipLevel(data.newVipLevel);
                setProgress(data.progress.progress);
                setNextThreshold(data.progress.nextThreshold);
                setCoinAmount('');

                // Show level up modal if leveled up
                if (data.leveledUp) {
                    setAlert({
                        visible: true,
                        title: '🎉 TEBRİKLER!',
                        message: `VIP ${data.newVipLevel} seviyesine yükseldiniz!`,
                        type: 'success'
                    });
                } else {
                    setAlert({ visible: true, title: 'Başarılı', message: `${coins} VIP XP kazandınız!`, type: 'success' });
                }
            } else {
                setAlert({ visible: true, title: 'Hata', message: data.error || 'Satın alma başarısız.', type: 'error' });
            }
        } catch (error) {
            console.error('Purchase error:', error);
            setAlert({ visible: true, title: 'Hata', message: 'Bir hata oluştu.', type: 'error' });
        } finally {
            setPurchasing(false);
        }
    };

    const shimmerStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: shimmerX.value }]
    }));

    const glowStyle = useAnimatedStyle(() => ({
        transform: [{ scale: glowPulse.value }]
    }));

    const progressBarStyle = useAnimatedStyle(() => ({
        width: `${progressWidth.value * 100}%`
    }));

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#fbbf24" />
            </View>
        );
    }

    const xpNeeded = nextThreshold - vipXp;
    const isMaxLevel = vipLevel === 6;

    return (
        <View style={styles.container}>
            {/* Header */}
            <LinearGradient
                colors={['#1a1a1a', '#0a0a0a']}
                style={styles.header}
            >
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#fbbf24" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>VIP YÜKSELTİŞ</Text>
                <View style={styles.balanceContainer}>
                    <Ionicons name="diamond" size={18} color="#fbbf24" />
                    <Text style={styles.balanceText}>{userBalance}</Text>
                </View>
            </LinearGradient>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                {/* VIP Frame Display */}
                <Animated.View style={[styles.frameContainer, glowStyle]}>
                    <View style={styles.frameGlow}>
                        <LinearGradient
                            colors={['rgba(251, 191, 36, 0.3)', 'transparent']}
                            style={StyleSheet.absoluteFill}
                        />
                    </View>
                    <VipFrame
                        level={vipLevel}
                        avatar={route.params?.avatar || 'https://via.placeholder.com/150'}
                        size={140}
                        isStatic={false}
                    />
                </Animated.View>

                {/* Current Level */}
                <View style={styles.levelBadge}>
                    <LinearGradient
                        colors={['#fbbf24', '#f59e0b', '#d97706']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.levelBadgeGradient}
                    >
                        <Animated.View style={shimmerStyle}>
                            <LinearGradient
                                colors={['transparent', 'rgba(255, 255, 255, 0.4)', 'transparent']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.shimmer}
                            />
                        </Animated.View>
                        <Text style={styles.levelText}>VIP {vipLevel}</Text>
                    </LinearGradient>
                </View>

                {/* Progress Section */}
                {!isMaxLevel && (
                    <View style={styles.progressSection}>
                        <View style={styles.progressHeader}>
                            <Text style={styles.progressLabel}>Bir Sonraki Seviye</Text>
                            <Text style={styles.progressValue}>VIP {vipLevel + 1}</Text>
                        </View>

                        {/* Progress Bar */}
                        <View style={styles.progressBarContainer}>
                            <View style={styles.progressBarBg}>
                                <Animated.View style={[styles.progressBarFill, progressBarStyle]}>
                                    <LinearGradient
                                        colors={['#fbbf24', '#f59e0b', '#fbbf24']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={StyleSheet.absoluteFill}
                                    />
                                </Animated.View>
                            </View>
                        </View>

                        <View style={styles.xpInfo}>
                            <Text style={styles.xpText}>{vipXp.toLocaleString()} XP</Text>
                            <Text style={styles.xpNeeded}>{xpNeeded.toLocaleString()} XP kaldı</Text>
                        </View>
                    </View>
                )}

                {isMaxLevel && (
                    <View style={styles.maxLevelContainer}>
                        <Ionicons name="trophy" size={48} color="#fbbf24" />
                        <Text style={styles.maxLevelText}>Maksimum Seviyeye Ulaştınız!</Text>
                    </View>
                )}

                {/* Purchase Section */}
                {!isMaxLevel && (
                    <View style={styles.purchaseSection}>
                        <Text style={styles.purchaseTitle}>VIP XP Satın Al</Text>
                        <Text style={styles.purchaseSubtitle}>1 Coin = 1 VIP XP</Text>

                        <View style={styles.inputContainer}>
                            <TextInput
                                style={styles.input}
                                placeholder="Coin miktarı"
                                placeholderTextColor="#6b7280"
                                keyboardType="numeric"
                                value={coinAmount}
                                onChangeText={setCoinAmount}
                            />
                            <TouchableOpacity
                                style={[styles.purchaseButton, purchasing && styles.purchaseButtonDisabled]}
                                onPress={handlePurchase}
                                disabled={purchasing}
                            >
                                <LinearGradient
                                    colors={['#fbbf24', '#f59e0b', '#d97706']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.purchaseButtonGradient}
                                >
                                    {purchasing ? (
                                        <ActivityIndicator color="#000" />
                                    ) : (
                                        <Text style={styles.purchaseButtonText}>SATIN AL</Text>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>

                        {/* Quick Purchase Buttons */}
                        <View style={styles.quickButtons}>
                            {[100, 500, 1000, 5000].map((amount) => (
                                <TouchableOpacity
                                    key={amount}
                                    style={styles.quickButton}
                                    onPress={() => setCoinAmount(amount.toString())}
                                >
                                    <Text style={styles.quickButtonText}>{amount}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                {/* VIP Thresholds */}
                <View style={styles.thresholdsSection}>
                    <Text style={styles.thresholdsTitle}>VIP Seviyeleri</Text>
                    {Object.entries(VIP_THRESHOLDS).map(([level, threshold]) => (
                        <View
                            key={level}
                            style={[
                                styles.thresholdItem,
                                parseInt(level) === vipLevel && styles.thresholdItemActive
                            ]}
                        >
                            <View style={styles.thresholdLeft}>
                                <Text style={styles.thresholdLevel}>VIP {level}</Text>
                                {parseInt(level) === vipLevel && (
                                    <View style={styles.currentBadge}>
                                        <Text style={styles.currentBadgeText}>Mevcut</Text>
                                    </View>
                                )}
                            </View>
                            <Text style={styles.thresholdValue}>{threshold.toLocaleString()} XP</Text>
                        </View>
                    ))}
                </View>
            </ScrollView>
            <ModernAlert
                visible={alert.visible}
                title={alert.title}
                message={alert.message}
                type={alert.type}
                onClose={() => setAlert({ ...alert, visible: false })}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a0a',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0a0a0a',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 50,
        paddingBottom: 20,
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fbbf24',
        letterSpacing: 2,
    },
    balanceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(251, 191, 36, 0.1)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(251, 191, 36, 0.3)',
    },
    balanceText: {
        color: '#fbbf24',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 6,
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 20,
        alignItems: 'center',
    },
    frameContainer: {
        marginTop: 20,
        marginBottom: 30,
        position: 'relative',
    },
    frameGlow: {
        position: 'absolute',
        top: -20,
        left: -20,
        right: -20,
        bottom: -20,
        borderRadius: 100,
    },
    levelBadge: {
        marginBottom: 30,
        overflow: 'hidden',
        borderRadius: 30,
        elevation: 8,
        shadowColor: '#fbbf24',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 12,
    },
    levelBadgeGradient: {
        paddingHorizontal: 40,
        paddingVertical: 12,
        position: 'relative',
        overflow: 'hidden',
    },
    shimmer: {
        position: 'absolute',
        top: 0,
        left: -width,
        width: width,
        height: '100%',
    },
    levelText: {
        fontSize: 28,
        fontWeight: '800',
        color: '#000',
        textAlign: 'center',
        letterSpacing: 3,
    },
    progressSection: {
        width: '100%',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 20,
        padding: 20,
        marginBottom: 30,
        borderWidth: 1,
        borderColor: 'rgba(251, 191, 36, 0.2)',
    },
    progressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    progressLabel: {
        fontSize: 14,
        color: '#9ca3af',
        fontWeight: '500',
    },
    progressValue: {
        fontSize: 18,
        color: '#fbbf24',
        fontWeight: '700',
    },
    progressBarContainer: {
        marginBottom: 12,
    },
    progressBarBg: {
        height: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 10,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 10,
    },
    xpInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    xpText: {
        fontSize: 16,
        color: '#fff',
        fontWeight: '600',
    },
    xpNeeded: {
        fontSize: 14,
        color: '#9ca3af',
    },
    maxLevelContainer: {
        alignItems: 'center',
        padding: 40,
    },
    maxLevelText: {
        fontSize: 20,
        color: '#fbbf24',
        fontWeight: '700',
        marginTop: 16,
        textAlign: 'center',
    },
    purchaseSection: {
        width: '100%',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 20,
        padding: 20,
        marginBottom: 30,
        borderWidth: 1,
        borderColor: 'rgba(251, 191, 36, 0.2)',
    },
    purchaseTitle: {
        fontSize: 18,
        color: '#fff',
        fontWeight: '700',
        marginBottom: 4,
        textAlign: 'center',
    },
    purchaseSubtitle: {
        fontSize: 14,
        color: '#9ca3af',
        marginBottom: 20,
        textAlign: 'center',
    },
    inputContainer: {
        marginBottom: 20,
    },
    input: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: '#fff',
        borderWidth: 1,
        borderColor: 'rgba(251, 191, 36, 0.3)',
        marginBottom: 12,
        textAlign: 'center',
    },
    purchaseButton: {
        borderRadius: 12,
        overflow: 'hidden',
        elevation: 4,
    },
    purchaseButtonDisabled: {
        opacity: 0.6,
    },
    purchaseButtonGradient: {
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    purchaseButtonText: {
        fontSize: 16,
        fontWeight: '800',
        color: '#000',
        letterSpacing: 2,
    },
    quickButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 10,
    },
    quickButton: {
        flex: 1,
        backgroundColor: 'rgba(251, 191, 36, 0.1)',
        borderRadius: 10,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: 'rgba(251, 191, 36, 0.3)',
    },
    quickButtonText: {
        color: '#fbbf24',
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center',
    },
    thresholdsSection: {
        width: '100%',
        marginBottom: 20,
    },
    thresholdsTitle: {
        fontSize: 18,
        color: '#fff',
        fontWeight: '700',
        marginBottom: 16,
    },
    thresholdItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        padding: 16,
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    thresholdItemActive: {
        backgroundColor: 'rgba(251, 191, 36, 0.1)',
        borderColor: 'rgba(251, 191, 36, 0.4)',
    },
    thresholdLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    thresholdLevel: {
        fontSize: 16,
        color: '#fff',
        fontWeight: '600',
    },
    currentBadge: {
        backgroundColor: '#fbbf24',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    currentBadgeText: {
        fontSize: 11,
        color: '#000',
        fontWeight: '700',
    },
    thresholdValue: {
        fontSize: 16,
        color: '#9ca3af',
        fontWeight: '600',
    },
});

export default VipProgressionScreen;
