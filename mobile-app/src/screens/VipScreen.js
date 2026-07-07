import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Dimensions, StatusBar, SafeAreaView, Image, ScrollView, Animated as RNAnimated, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
    useAnimatedStyle,
    withRepeat,
    withTiming,
    useSharedValue,
    withSequence,
    interpolate,
    useDerivedValue,
    withSpring,
    Easing,
    withDelay
} from 'react-native-reanimated';
import VipUpgradeModal from '../components/ui/VipUpgradeModal';
import { Motion } from '../components/motion/MotionSystem';
import VipFrame from '../components/ui/VipFrame';
import VipBadge from '../components/ui/VipBadge';
import axios from 'axios';
import { API_URL } from '../config';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';

const { width, height } = Dimensions.get('window');

const VIP_LEVELS = [
    { level: 1, title: 'VIP 1', colors: ['#1e1b4b', '#0f172a'], frameColors: ['#818cf8', '#6366f1'], glow: 'rgba(99, 102, 241, 0.4)' },
    { level: 2, title: 'VIP 2', colors: ['#2e1065', '#0f172a'], frameColors: ['#a855f7', '#7c3aed'], glow: 'rgba(124, 58, 237, 0.5)' },
    { level: 3, title: 'VIP 3', colors: ['#032b49', '#02111d'], frameColors: ['#38bdf8', '#0284c7'], glow: 'rgba(2, 132, 199, 0.6)' },
    { level: 4, title: 'VIP 4', colors: ['#4c0519', '#0f172a'], frameColors: ['#f43f5e', '#be123c'], glow: 'rgba(244, 63, 94, 0.6)' },
    { level: 5, title: 'VIP 5', colors: ['#4c052e', '#0f050b'], frameColors: ['#ec4899', '#db2777'], glow: 'rgba(236, 72, 153, 0.7)' },
    { level: 6, title: 'VIP 6', colors: ['#2e1f03', '#0c0700'], frameColors: ['#FFE082', '#FBBF24'], glow: 'rgba(251, 191, 36, 0.85)' },
];

const BENEFITS_DATA = {
    1: [
        { id: 'rozet', title: 'VIP 1 Rozeti', icon: 'ribbon-outline' },
        { id: 'cerceve', title: 'VIP 1 Çerçevesi', icon: 'color-palette-outline' },
        { id: 'boost', title: 'Günde 1 Boost', icon: 'flash-outline' },
        { id: 'ziyaretci', title: '10 Ziyaretçi Gör', icon: 'eye-outline' },
        { id: 'magaza', title: 'VIP 1 Mağaza', icon: 'cart-outline' },
    ],
    2: [
        { id: 'rozet', title: 'VIP 2 Rozeti', icon: 'ribbon-outline' },
        { id: 'cerceve', title: 'VIP 2 Çerçevesi', icon: 'color-palette-outline' },
        { id: 'boost', title: 'Günde 2 Boost', icon: 'flash-outline' },
        { id: 'ziyaretci', title: '30 Ziyaretçi Gör', icon: 'eye-outline' },
        { id: 'glow', title: 'Profil Glow Etkisi', icon: 'sparkles-outline' },
        { id: 'balon', title: 'VIP Sohbet Balonu', icon: 'chatbubble-ellipses-outline' },
    ],
    3: [
        { id: 'rozet', title: 'VIP 3 Rozeti', icon: 'ribbon-outline' },
        { id: 'cerceve', title: 'VIP 3 Çerçevesi', icon: 'color-palette-outline' },
        { id: 'boost', title: 'Günde 3 Boost', icon: 'flash-outline' },
        { id: 'ziyaretci', title: '50 Ziyaretçi Gör', icon: 'eye-outline' },
        { id: 'isim', title: 'Oda İsim Rengi', icon: 'color-wand-outline' },
        { id: 'giris', title: 'Küçük Giriş Efekti', icon: 'enter-outline' },
        { id: 'magaza', title: 'VIP 3 Ürünleri', icon: 'cart-outline' },
    ],
    4: [
        { id: 'rozet', title: 'VIP 4 Rozeti', icon: 'ribbon-outline' },
        { id: 'cerceve', title: 'VIP 4 Çerçevesi', icon: 'color-palette-outline' },
        { id: 'boost', title: 'Günde 5 Boost', icon: 'flash-outline' },
        { id: 'ziyaretci', title: '100 Ziyaretçi Gör', icon: 'eye-outline' },
        { id: 'fans', title: 'Hayranları Gör', icon: 'heart-outline' },
        { id: 'giris', title: 'Orta Giriş Efekti', icon: 'enter-outline' },
        { id: 'tema', title: 'Özel Profil Teması', icon: 'image-outline' },
        { id: 'kesfet', title: 'Yüksek Görünürlük', icon: 'trending-up-outline' },
    ],
    5: [
        { id: 'rozet', title: 'VIP 5 Rozeti', icon: 'ribbon-outline' },
        { id: 'cerceve', title: 'VIP 5 Çerçevesi', icon: 'color-palette-outline' },
        { id: 'boost', title: 'Günde 8 Boost', icon: 'flash-outline' },
        { id: 'ziyaretci', title: 'Tüm Ziyaretçiler', icon: 'eye-outline' },
        { id: 'fans', title: 'Hayranları Gör', icon: 'heart-outline' },
        { id: 'giris', title: 'Premium Giriş', icon: 'enter-outline' },
        { id: 'balon', title: 'Özel Sohbet Balonu', icon: 'chatbubble-ellipses-outline' },
        { id: 'tema', title: 'Özel Profil Teması', icon: 'image-outline' },
    ],
    6: [
        { id: 'rozet', title: 'VIP 6 Rozeti', icon: 'ribbon-outline' },
        { id: 'cerceve', title: 'En Şık Çerçeve', icon: 'color-palette-outline' },
        { id: 'boost', title: 'Günde 12 Boost', icon: 'flash-outline' },
        { id: 'ziyaretci', title: 'Ziyaretçiler Açık', icon: 'eye-outline' },
        { id: 'fans', title: 'Hayranlar Açık', icon: 'heart-outline' },
        { id: 'giris', title: 'Özel Giriş Efekti', icon: 'enter-outline' },
        { id: 'aura', title: 'Özel Oda Aurası', icon: 'sparkles-outline' },
        { id: 'isim', title: 'İsim Glow & Rengi', icon: 'color-wand-outline' },
        { id: 'magaza', title: 'VIP 6 Mağazası', icon: 'cart-outline' },
        { id: 'destek', title: 'Destek Önceliği', icon: 'help-buoy-outline' },
    ],
};

const VipScreen = ({ route, navigation }) => {
    const [user, setUser] = useState(route.params?.user || {});
    const [userVip, setUserVip] = useState(route.params?.userVip !== undefined ? route.params.userVip : (user.vip_level || 0));
    const [selectedLevel, setSelectedLevel] = useState(userVip || 1);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [vipProgress, setVipProgress] = useState(null);

    useEffect(() => {
        if (!user.name) {
            AsyncStorage.getItem('user').then(data => {
                if (data) {
                    const parsedUser = JSON.parse(data);
                    setUser(parsedUser);
                    if (userVip === 0 && parsedUser.vip_level) {
                        setUserVip(parsedUser.vip_level);
                        setSelectedLevel(parsedUser.vip_level || 1);
                    }
                }
            });
        }
    }, []);

    const THRESHOLDS = {
        1: 100,
        2: 1500,
        3: 10000,
        4: 20000,
        5: 40000,
        6: 100000
    };

    // Fetch dynamic progress on focus
    useFocusEffect(
        React.useCallback(() => {
            if (user?.id) {
                axios.get(`${API_URL}/vip/progress`, {
                    headers: { 'Authorization': `Bearer ${user.token}` }
                })
                    .then(res => setVipProgress(res.data))
                    .catch(err => console.log('Fetch VIP progress error:', err));
            }
        }, [user?.id])
    );

    // Reanimated Shared Values
    const floatingY = useSharedValue(0);
    const shineX = useSharedValue(-width);
    const haloScale = useSharedValue(1);
    const haloOpacity = useSharedValue(0.5);
    const pulseScale = useSharedValue(1);
    const frameRotate = useSharedValue(0);
    const rotateX = useSharedValue(0);
    const rotateY = useSharedValue(0);

    useEffect(() => {
        floatingY.value = withRepeat(
            withSequence(
                withTiming(-12, { duration: 2500, easing: Easing.inOut(Easing.sin) }),
                withTiming(0, { duration: 2500, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            true
        );

        rotateX.value = withRepeat(
            withSequence(
                withTiming(3, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
                withTiming(-3, { duration: 3000, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            true
        );

        rotateY.value = withRepeat(
            withSequence(
                withTiming(-4, { duration: 3500, easing: Easing.inOut(Easing.sin) }),
                withTiming(4, { duration: 3500, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            true
        );

        frameRotate.value = withRepeat(
            withTiming(360, { duration: 3500, easing: Easing.linear }),
            -1,
            false
        );

        if (selectedLevel >= 3) {
            shineX.value = withRepeat(
                withSequence(
                    withTiming(width, { duration: 2500, easing: Easing.linear }),
                    withDelay(1200, withTiming(-width, { duration: 0 }))
                ),
                -1,
                false
            );
        }

        if (selectedLevel >= 5) {
            haloScale.value = withRepeat(
                withTiming(1.5, { duration: 2200 }),
                -1,
                false
            );
            haloOpacity.value = withRepeat(
                withSequence(withTiming(0.8, { duration: 1100 }), withTiming(0, { duration: 1100 })),
                -1,
                false
            );
        }

        pulseScale.value = withRepeat(
            withSequence(withTiming(1.08, { duration: 1200 }), withTiming(1, { duration: 1200 })),
            -1,
            true
        );
    }, [selectedLevel]);

    const handleLevelSelect = (level) => {
        setSelectedLevel(level);
    };

    const handleUpgrade = () => {
        if (selectedLevel > userVip) {
            navigation.navigate('Shop', { user });
        } else {
            navigation.navigate('VipDetails', { user: { ...user, vip_level: userVip } });
        }
    };

    // Animated Styles
    const floatingStyle = useAnimatedStyle(() => ({
        transform: [
            { perspective: 1000 },
            { translateY: floatingY.value },
            { rotateX: `${rotateX.value}deg` },
            { rotateY: `${rotateY.value}deg` }
        ],
    }));

    const currentConfig = VIP_LEVELS.find(v => v.level === selectedLevel);

    const userXp = vipProgress?.currentXp || 0;
    const nextThreshold = vipProgress?.nextThreshold || THRESHOLDS[selectedLevel] || 100;
    const progressPercent = vipProgress ? (vipProgress.progress * 100) : 0;
    const xpNeeded = vipProgress?.xpNeeded || 0;
    const nextLevel = vipProgress?.nextLevel || 1;

    const renderPaginationDots = () => {
        return (
            <View style={styles.paginationContainer}>
                {VIP_LEVELS.map((item) => {
                    const isActive = selectedLevel === item.level;
                    return (
                        <TouchableOpacity
                            key={item.level}
                            onPress={() => handleLevelSelect(item.level)}
                            style={styles.dotTouchArea}
                        >
                            <Motion.Bounce visible={isActive}>
                                <View style={[styles.dotWrapper, isActive && styles.activeDotWrapper]}>
                                    {isActive ? (
                                        <LinearGradient
                                            colors={item.frameColors}
                                            style={styles.activeDot}
                                        />
                                    ) : (
                                        <View style={styles.inactiveDot} />
                                    )}
                                </View>
                            </Motion.Bounce>
                        </TouchableOpacity>
                    );
                })}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <LinearGradient
                colors={['#090518', '#04020a']}
                style={StyleSheet.absoluteFill}
            />

            {/* Neon Glowing Background Effect */}
            <View style={[styles.topLightGlow, { backgroundColor: currentConfig.glow }]} />

            <SafeAreaView style={styles.safeArea}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={24} color="white" />
                    </TouchableOpacity>

                    <Text style={styles.headerTitle}>VIP MERKEZİ</Text>

                    <TouchableOpacity style={styles.infoButton}>
                        <Ionicons name="help-circle-outline" size={24} color="white" />
                    </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
                    {/* Elite Card Section */}
                    <Animated.View style={[styles.eliteCardContainer, floatingStyle]}>
                        <View style={[styles.eliteCardWrapper, { shadowColor: currentConfig.glow, zIndex: 1 }]}>
                            <LinearGradient
                                colors={currentConfig.colors}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.eliteCard}
                            >
                                <View style={styles.cardHeader}>
                                    <View style={styles.avatarWrapper}>
                                        <VipFrame
                                            level={selectedLevel}
                                            avatar={user.profile_image || `https://ui-avatars.com/api/?name=${user.name || 'User'}&background=1e293b&color=fff`}
                                            size={84}
                                        />
                                    </View>
                                    <View style={styles.userInfo}>
                                        <View style={styles.nameBadgeRow}>
                                            <Text style={styles.userName} numberOfLines={1}>{user.name || 'Elite Üye'}</Text>
                                            <VipBadge level={selectedLevel} size={44} />
                                        </View>
                                        <Text style={styles.userStatusText}>
                                            {selectedLevel <= userVip ? 'Sahip Olduğun Seviye' : 'Önizleme Seviyesi'}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.progressSection}>
                                    <View style={styles.progressHeader}>
                                        <Text style={styles.progressLabel}>VIP Tecrübesi</Text>
                                        <Text style={styles.progressValue}>{userXp} / {nextThreshold} XP</Text>
                                    </View>
                                    <View style={styles.progressBarBg}>
                                        <LinearGradient
                                            colors={currentConfig.frameColors}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={[styles.progressBarFill, { width: `${progressPercent}%` }]}
                                        />
                                    </View>
                                    {userVip < 6 ? (
                                        <Text style={styles.progressFooterText}>
                                            VIP {nextLevel} olmak için {xpNeeded} XP daha gerekli
                                        </Text>
                                    ) : (
                                        <Text style={styles.progressFooterText}>
                                            Maksimum VIP Seviyesindesiniz! 🎉
                                        </Text>
                                    )}
                                </View>
                            </LinearGradient>
                        </View>
                    </Animated.View>

                    {/* Bounce Carousel Dots */}
                    {renderPaginationDots()}

                    <View style={styles.dividerContainer}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>AYRICALIKLAR</Text>
                        <View style={styles.dividerLine} />
                    </View>

                    {/* Level Selector - Premium Slider Bar */}
                    <View style={styles.levelSelectorContainer}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.levelSelectorScroll}>
                            {VIP_LEVELS.map((item) => {
                                const isSelected = selectedLevel === item.level;
                                const isUnlocked = item.level <= userVip;
                                return (
                                    <TouchableOpacity
                                        key={item.level}
                                        onPress={() => handleLevelSelect(item.level)}
                                        style={[
                                            styles.levelItem,
                                            isSelected && { borderColor: item.frameColors[0], backgroundColor: 'rgba(255,255,255,0.05)' }
                                        ]}
                                        activeOpacity={0.8}
                                    >
                                        <View style={styles.tabIconTextRow}>
                                            <Ionicons 
                                                name={isUnlocked ? "shield-checkmark" : "lock-closed"} 
                                                size={11} 
                                                color={isUnlocked ? '#10b981' : 'rgba(255,255,255,0.4)'} 
                                                style={{ marginRight: 4 }}
                                            />
                                            <Text style={[
                                                styles.levelItemText,
                                                isSelected && { color: 'white', fontWeight: '900' }
                                            ]}>
                                                VIP {item.level}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>

                    {/* Benefits 3xN Grid */}
                    <View style={styles.gridContainer}>
                        {BENEFITS_DATA[selectedLevel]?.map((benefit) => (
                            <View key={benefit.id} style={styles.benefitItemWrapper}>
                                <BlurView intensity={12} tint="dark" style={styles.benefitCardBlur}>
                                    <View style={styles.benefitCard}>
                                        <LinearGradient
                                            colors={['rgba(255,255,255,0.01)', 'rgba(255,255,255,0.03)']}
                                            style={StyleSheet.absoluteFill}
                                        />
                                        <View style={styles.benefitIconBackground}>
                                            <LinearGradient
                                                colors={['rgba(139, 92, 246, 0.15)', 'rgba(236, 72, 153, 0.15)']}
                                                style={StyleSheet.absoluteFill}
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 1 }}
                                            />
                                            <Ionicons name={benefit.icon} size={24} color={currentConfig.frameColors[0]} />
                                        </View>
                                        <Text style={styles.benefitTitleText} numberOfLines={2}>{benefit.title}</Text>
                                    </View>
                                </BlurView>
                            </View>
                        ))}
                    </View>

                    {/* Next Level Unlocks Section */}
                    {selectedLevel < 6 && (() => {
                        const currentBenefits = BENEFITS_DATA[selectedLevel] || [];
                        const nextBenefits = BENEFITS_DATA[selectedLevel + 1] || [];
                        const extraBenefits = nextBenefits.filter(nb => !currentBenefits.some(cb => cb.id === nb.id));
                        if (extraBenefits.length === 0) return null;
                        return (
                            <View style={styles.unlocksSection}>
                                <Text style={styles.unlocksTitle}>VIP {selectedLevel + 1} Seviyesinde Açılacaklar</Text>
                                <View style={styles.unlocksCard}>
                                    <LinearGradient
                                        colors={['rgba(139, 92, 246, 0.05)', 'rgba(236, 72, 153, 0.05)']}
                                        style={StyleSheet.absoluteFill}
                                    />
                                    {extraBenefits.map((eb) => (
                                        <View key={eb.id} style={styles.unlockItemRow}>
                                            <View style={styles.unlockIconBg}>
                                                <Ionicons name={eb.icon} size={15} color="#ec4899" />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.unlockItemTitle}>{eb.title}</Text>
                                                <Text style={styles.unlockItemDesc}>VIP {selectedLevel + 1} ile bu avantajı hemen kullan.</Text>
                                            </View>
                                            <Ionicons name="lock-closed" size={14} color="rgba(255,255,255,0.3)" />
                                        </View>
                                    ))}
                                </View>
                            </View>
                        );
                    })()}
                </ScrollView>

                {/* Fixed Footer Action */}
                <View style={styles.absoluteFooter}>
                    <BlurView intensity={25} tint="dark" style={styles.footerBlurContainer}>
                        <TouchableOpacity
                            style={[styles.upgradeButton, { shadowColor: currentConfig.glow }]}
                            onPress={handleUpgrade}
                        >
                            <LinearGradient
                                colors={currentConfig.frameColors}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.buttonGradient}
                            >
                                <Text style={styles.buttonText}>
                                    {selectedLevel > userVip ? `VIP ${selectedLevel}'e YÜKSELT` : 'AVANTAJLARI YÖNET'}
                                </Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </BlurView>
                </View>
            </SafeAreaView>

            <VipUpgradeModal
                visible={showUpgradeModal}
                level={userVip}
                onClose={() => setShowUpgradeModal(false)}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { 
        flex: 1,
        backgroundColor: '#04020a'
    },
    safeArea: { 
        flex: 1 
    },
    topLightGlow: {
        position: 'absolute',
        top: -150,
        left: -50,
        right: -50,
        height: 350,
        borderRadius: 175,
        backgroundColor: 'rgba(139, 92, 246, 0.15)',
        zIndex: 0,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 20 : 15,
        paddingBottom: 15,
        zIndex: 10,
    },
    backButton: { 
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.06)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)'
    },
    infoButton: { 
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.06)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)'
    },
    headerTitle: {
        color: 'white',
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 1.5,
    },
    eliteCardContainer: {
        padding: 20,
        paddingBottom: 15,
        overflow: 'visible',
    },
    eliteCardWrapper: {
        borderRadius: 24,
        elevation: 20,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
        backgroundColor: 'transparent',
    },
    eliteCard: {
        width: '100%',
        borderRadius: 24,
        padding: 20,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.08)',
        overflow: 'hidden',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatarWrapper: {
        width: 84,
        height: 84,
        alignItems: 'center',
        justifyContent: 'center',
    },
    userInfo: {
        marginLeft: 18,
        flex: 1,
    },
    nameBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
    },
    userName: {
        color: 'white',
        fontSize: 20,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    inlineBadge: {
        borderRadius: 8,
        overflow: 'hidden',
    },
    badgeGrad: {
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    badgeText: {
        color: 'white',
        fontSize: 9,
        fontWeight: '900',
    },
    userStatusText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 11,
        marginTop: 4,
        fontWeight: '600',
    },
    progressSection: {
        marginTop: 20,
    },
    progressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    progressLabel: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 10,
        fontWeight: '700',
    },
    progressValue: {
        color: 'white',
        fontSize: 11,
        fontWeight: '800',
    },
    progressBarBg: {
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(255,255,255,0.08)',
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 3,
    },
    progressFooterText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 9.5,
        marginTop: 6,
        fontWeight: '600',
    },
    paginationContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
        marginBottom: 15,
    },
    dotTouchArea: {
        padding: 4,
    },
    dotWrapper: {
        width: 8,
        height: 8,
        borderRadius: 4,
        alignItems: 'center',
        justifyContent: 'center',
    },
    activeDotWrapper: {
        width: 20,
        height: 8,
        borderRadius: 4,
    },
    activeDot: {
        flex: 1,
        width: '100%',
        borderRadius: 4,
    },
    inactiveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginVertical: 10,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    dividerText: {
        color: '#475569',
        fontSize: 10.5,
        fontWeight: '900',
        marginHorizontal: 12,
        letterSpacing: 2,
    },
    levelSelectorContainer: {
        marginBottom: 15,
    },
    levelSelectorScroll: {
        paddingHorizontal: 20,
        gap: 10,
    },
    levelItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        backgroundColor: 'rgba(255,255,255,0.01)',
    },
    tabIconTextRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    levelItemText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
        fontWeight: '700',
    },
    levelActiveIndicator: {
        position: 'absolute',
        bottom: 0,
        left: 12,
        right: 12,
        height: 2,
        borderRadius: 1,
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 14,
    },
    benefitItemWrapper: {
        width: '33.33%',
        padding: 5,
    },
    benefitCardBlur: {
        borderRadius: 20,
        overflow: 'hidden',
    },
    benefitCard: {
        borderRadius: 20,
        padding: 12,
        alignItems: 'center',
        justifyContent: 'center',
        aspectRatio: 1,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    benefitIconBackground: {
        width: 48,
        height: 48,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
        overflow: 'hidden',
    },
    benefitTitleText: {
        color: '#94a3b8',
        fontSize: 10,
        fontWeight: '800',
        textAlign: 'center',
        lineHeight: 12,
    },
    unlocksSection: {
        paddingHorizontal: 20,
        marginTop: 20,
        marginBottom: 10,
    },
    unlocksTitle: {
        color: '#f43f5e',
        fontSize: 13,
        fontWeight: '900',
        letterSpacing: 0.5,
        marginBottom: 10,
    },
    unlocksCard: {
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(244, 63, 94, 0.15)',
        padding: 16,
        overflow: 'hidden',
        gap: 12,
    },
    unlockItemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    unlockIconBg: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: 'rgba(244, 63, 94, 0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    unlockItemTitle: {
        color: 'white',
        fontSize: 11.5,
        fontWeight: '800',
    },
    unlockItemDesc: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 9.5,
        marginTop: 2,
        fontWeight: '600',
    },
    absoluteFooter: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    },
    footerBlurContainer: {
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 25,
        borderTopWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    upgradeButton: {
        width: '100%',
        height: 54,
        borderRadius: 27,
        overflow: 'hidden',
        elevation: 15,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
    },
    buttonGradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 1,
    },
});

export default VipScreen;
