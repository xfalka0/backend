import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Dimensions, StatusBar, SafeAreaView, Image, ScrollView, Animated as RNAnimated } from 'react-native';
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
import axios from 'axios';
import { API_URL } from '../config';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

const VIP_LEVELS = [
    { level: 1, title: 'VIP 1', colors: ['#92400e', '#451a03'], frameColors: ['#cd7f32', '#a05a2c'], glow: 'rgba(146, 64, 14, 0.4)' }, // Bronze
    { level: 2, title: 'VIP 2', colors: ['#475569', '#1e293b'], frameColors: ['#cbd5e1', '#94a3b8'], glow: 'rgba(71, 85, 105, 0.4)' }, // Silver
    { level: 3, title: 'VIP 3', colors: ['#b45309', '#78350f'], frameColors: ['#fbbf24', '#d97706'], glow: 'rgba(180, 83, 9, 0.5)' }, // Gold
    { level: 4, title: 'VIP 4', colors: ['#0e7490', '#164e63'], frameColors: ['#22d3ee', '#0891b2'], glow: 'rgba(14, 116, 144, 0.6)' }, // Platinum
    { level: 5, title: 'VIP 5', colors: ['#be185d', '#831843'], frameColors: ['#e879f9', '#d946ef'], glow: 'rgba(190, 24, 93, 0.7)' }, // Diamond
    { level: 6, title: 'VIP 6', colors: ['#1a1a1a', '#000000', '#451a03'], frameColors: ['#fbbf24', '#fde68a'], glow: 'rgba(251, 191, 36, 0.9)' },
];

const BENEFITS_DATA = {
    1: [
        { id: 'kimlik', title: 'Kimlik', icon: 'person-circle-outline' },
        { id: 'rozet', title: 'Temel Rozet', icon: 'ribbon-outline' },
    ],
    6: [
        { id: 'kimlik', title: 'Kimlik', icon: 'person-circle-outline' },
        { id: 'cerceve', title: 'Avatar Çerçevesi', icon: 'color-palette-outline' },
        { id: 'madalya', title: 'Madalya', icon: 'medal-outline' },
        { id: 'ceviri', title: 'Ücretsiz Çeviri', icon: 'language-outline' },
        { id: 'kisitlama', title: 'Kısıtlamaları Kaldırın', icon: 'eye-outline' },
        { id: 'balon', title: 'Konuşma Balonu', icon: 'chatbubble-ellipses-outline' },
        { id: 'onecik', title: 'Öne Çık', icon: 'trending-up-outline' },
        { id: 'ziyaretci', title: 'Ziyaretçileri Gör', icon: 'people-outline' },
        { id: 'hediye', title: 'Hediye Bildirimi', icon: 'gift-outline' },
    ],
};

[2, 3, 4, 5].forEach(lvl => {
    BENEFITS_DATA[lvl] = BENEFITS_DATA[6].slice(0, lvl + 2);
});

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
                    headers: { 'Authorization': `Bearer ${user.token}` } // Assuming token is passed or managed globally
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
        // Continuous Floating Animation
        floatingY.value = withRepeat(
            withSequence(
                withTiming(-12, { duration: 2500, easing: Easing.inOut(Easing.sin) }),
                withTiming(0, { duration: 2500, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            true
        );

        // Continuous 3D Rotation (Tilt)
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

        // Frame Rotate (Constant)
        frameRotate.value = withRepeat(
            withTiming(360, { duration: 3500, easing: Easing.linear }),
            -1,
            false
        );

        // Shine Sweep Effect (VIP 3+)
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

        // Halo Aura Effect (VIP 5+)
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
        if (userVip < 6) {
            setUserVip(prev => prev + 1);
            setShowUpgradeModal(true);
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

    const shineStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: shineX.value }],
    }));

    const haloStyle = useAnimatedStyle(() => ({
        transform: [{ scale: haloScale.value }],
        opacity: haloOpacity.value,
    }));

    const frameStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${frameRotate.value}deg` }],
    }));

    const pulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseScale.value }],
    }));

    const currentConfig = VIP_LEVELS.find(v => v.level === selectedLevel);

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
                colors={[`${currentConfig.colors[0]}33`, '#030712']}
                style={StyleSheet.absoluteFill}
            />

            {/* Ambient Particles Removed due to missing JSON file */}
            <View style={[StyleSheet.absoluteFill, { zIndex: 0 }]} pointerEvents="none" />

            <SafeAreaView style={styles.safeArea}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={28} color="white" />
                    </TouchableOpacity>

                    <Text style={styles.headerTitle}>VIP AYRICALIKLARI</Text>

                    <TouchableOpacity style={styles.infoButton}>
                        <Ionicons name="help-circle-outline" size={28} color="white" />
                    </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
                    {/* Elite Card Section */}
                    <Animated.View style={[styles.eliteCardContainer, floatingStyle]}>



                        <View style={[styles.eliteCardWrapper, { shadowColor: currentConfig.glow, zIndex: 1 }]}>
                            <LinearGradient
                                colors={currentConfig.colors}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.eliteCard}
                            >
                                {/* VIP 4: Particle Stars removed as requested */}




                                <View style={styles.cardHeader}>
                                    <View style={styles.avatarWrapper}>
                                        <VipFrame
                                            level={selectedLevel}
                                            avatar={user.profile_image || `https://ui-avatars.com/api/?name=${user.name || 'User'}&background=1e293b&color=fff`}
                                            size={100}
                                        />
                                    </View>

                                    <View style={styles.userInfo}>
                                        <Text style={styles.userName}>{user.name || 'Elite Üye'}</Text>
                                        <Text style={styles.expText}>
                                            {selectedLevel === userVip
                                                ? (userVip < 6
                                                    ? `VIP ${userVip + 1} olmak için en az ${vipProgress?.nextThreshold || THRESHOLDS[userVip + 1]} coin gerekmektedir`
                                                    : 'Maksimum seviyeye ulaştın!')
                                                : `VIP ${selectedLevel} olmak için en az ${THRESHOLDS[selectedLevel]} coin gerekmektedir`}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.cardFooter}>
                                    <View style={styles.vipTag}>
                                        <Text style={styles.cardVipText}>LEVEL {selectedLevel}</Text>
                                    </View>
                                </View>
                            </LinearGradient>
                        </View>
                    </Animated.View>

                    {/* Bounce Carousel Dots */}
                    {renderPaginationDots()}

                    <View style={styles.dividerContainer}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>ÖZEL AYRICALIKLAR</Text>
                        <View style={styles.dividerLine} />
                    </View>

                    {/* Level Selector - Mini Grid Style */}
                    <View style={styles.levelSelectorContainer}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.levelSelectorScroll}>
                            {VIP_LEVELS.map((item) => (
                                <TouchableOpacity
                                    key={item.level}
                                    onPress={() => handleLevelSelect(item.level)}
                                    style={[
                                        styles.levelItem,
                                        selectedLevel === item.level && styles.selectedLevelItem
                                    ]}
                                >
                                    <Text style={[
                                        styles.levelItemText,
                                        selectedLevel === item.level && { color: item.frameColors[0], fontWeight: '900' }
                                    ]}>
                                        VIP{item.level}
                                    </Text>
                                    {selectedLevel === item.level && (
                                        <Animated.View style={[styles.levelActiveIndicator, { backgroundColor: item.frameColors[0] }]} />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Benefits 3xN Grid */}
                    <View style={styles.gridContainer}>
                        {BENEFITS_DATA[selectedLevel]?.map((benefit) => (
                            <View key={benefit.id} style={styles.benefitItemWrapper}>
                                <View style={styles.benefitCard}>
                                    <View style={styles.benefitIconBackground}>
                                        <Ionicons name={benefit.icon} size={30} color={currentConfig.frameColors[0]} />
                                    </View>
                                    <Text style={styles.benefitTitleText} numberOfLines={2}>{benefit.title}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                </ScrollView>

                {/* Fixed Footer Action */}
                <View style={styles.absoluteFooter}>
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
                                {selectedLevel > userVip ? 'HEMEN YÜKSELTİN' : 'AVANTAJLARI YÖNET'}
                            </Text>
                        </LinearGradient>
                    </TouchableOpacity>
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
    container: { flex: 1 },
    safeArea: { flex: 1 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
    },
    backButton: { padding: 4 },
    infoButton: { padding: 4 },
    headerTitle: {
        color: 'white',
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 2,
        opacity: 0.9,
    },
    eliteCardContainer: {
        padding: 20,
        paddingBottom: 10,
        overflow: 'visible', // Ensure container doesn't clip
    },
    eliteCardWrapper: {
        borderRadius: 28,
        elevation: 30,
        shadowOffset: { width: 0, height: 15 },
        shadowOpacity: 0.7,
        shadowRadius: 20,
        overflow: 'visible', // Ensure wrapper doesn't clip
        backgroundColor: 'transparent', // Important for shadow on Android with overflow visible
    },
    eliteCard: {
        width: '100%',
        borderRadius: 28,
        padding: 24,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.12)',
        overflow: 'visible', // Allow lottie to flow out
    },
    shineContainer: {
        position: 'absolute',
        top: 0,
        width: 180,
        height: '100%',
        opacity: 0.6,
        zIndex: 1,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        zIndex: 5,
        overflow: 'visible', // Allow children to extend outside
    },
    avatarWrapper: {
        width: 100,
        height: 100,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible', // Allow children to extend outside
    },
    userInfo: {
        marginLeft: 22,
        flex: 1,
    },
    userName: {
        color: 'white',
        fontSize: 24,
        fontWeight: '900',
        letterSpacing: 0.5,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    expText: {
        color: 'rgba(255,255,255,0.55)',
        fontSize: 11,
        marginTop: 12,
        lineHeight: 16,
        fontWeight: '700',
    },
    cardFooter: {
        marginTop: 20,
        alignItems: 'flex-end',
    },
    vipTag: {
        backgroundColor: 'rgba(0,0,0,0.2)',
        paddingHorizontal: 15,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    cardVipText: {
        color: 'white',
        fontSize: 32,
        fontWeight: '900',
        fontStyle: 'italic',
        opacity: 0.15,
    },
    paginationContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10,
    },
    dotTouchArea: {
        padding: 5,
    },
    dotWrapper: {
        width: 10,
        height: 10,
        borderRadius: 5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    activeDotWrapper: {
        width: 24,
        height: 10,
        borderRadius: 5,
    },
    activeDot: {
        flex: 1,
        width: '100%',
        borderRadius: 5,
    },
    inactiveDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 30,
        marginVertical: 12,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.06)',
    },
    dividerText: {
        color: '#475569',
        fontSize: 12,
        fontWeight: '900',
        marginHorizontal: 16,
        letterSpacing: 2.5,
    },
    levelSelectorContainer: {
        marginBottom: 20,
    },
    levelSelectorScroll: {
        paddingHorizontal: 20,
        gap: 20,
    },
    levelItem: {
        paddingVertical: 10,
        paddingHorizontal: 12,
        alignItems: 'center',
    },
    levelItemText: {
        color: '#475569',
        fontSize: 14,
        fontWeight: '800',
    },
    levelActiveIndicator: {
        width: 18,
        height: 3.5,
        borderRadius: 2,
        marginTop: 6,
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 16,
    },
    benefitItemWrapper: {
        width: '33.33%',
        padding: 6,
    },
    benefitCard: {
        backgroundColor: 'rgba(255,255,255,0.025)',
        borderRadius: 24,
        padding: 16,
        alignItems: 'center',
        justifyContent: 'center',
        aspectRatio: 1,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    benefitIconBackground: {
        width: 52,
        height: 52,
        backgroundColor: 'rgba(255,255,255,0.035)',
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    benefitTitleText: {
        color: '#94a3b8',
        fontSize: 10.5,
        fontWeight: '900',
        textAlign: 'center',
        lineHeight: 13,
    },
    absoluteFooter: {
        position: 'absolute',
        bottom: 25,
        left: 0,
        right: 0,
        paddingHorizontal: 20,
    },
    upgradeButton: {
        width: '100%',
        height: 60,
        borderRadius: 30,
        overflow: 'hidden',
        elevation: 20,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 15,
    },
    buttonGradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        color: 'white',
        fontSize: 15,
        fontWeight: '900',
        letterSpacing: 1.5,
    },
});

export default VipScreen;
