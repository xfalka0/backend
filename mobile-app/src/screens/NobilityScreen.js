import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    AccessibilityInfo,
    ActivityIndicator,
    Animated,
    Dimensions,
    Easing,
    Image,
    ImageBackground,
    Modal,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text as NativeText,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

import { API_URL } from '../config';
import { useAlert } from '../contexts/AlertContext';

const { width, height: screenHeight } = Dimensions.get('window');
const HERO_SIZE = Math.min(width * 0.58, 400);

const Text = (props) => <NativeText allowFontScaling={false} {...props} />;

const DEFAULT_TITLES = [
    { id: 1, key: 'knight', name: 'Şövalye', level: 1, price: 2999, duration_days: 30 },
    { id: 2, key: 'baron', name: 'Baron', level: 2, price: 4999, duration_days: 30 },
    { id: 3, key: 'king', name: 'Kral', level: 3, price: 12999, duration_days: 30 },
    { id: 4, key: 'duke', name: 'Dük', level: 4, price: 29999, duration_days: 30 },
    { id: 5, key: 'emperor', name: 'İmparator', level: 5, price: 49999, duration_days: 30 },
];

const COMMON_BENEFITS = {
    renewal: { name: 'Yenileme Teklifi', icon: 'sync-outline' },
    identity: { name: 'Asalet Kimliği', icon: 'finger-print-outline' },
    medal: { name: 'Özel Madalya', icon: 'ribbon-outline' },
    frame: { name: 'Avatar Çerçevesi', icon: 'scan-outline' },
    bubble: { name: 'Konuşma Balonu', icon: 'chatbubble-ellipses-outline' },
    entrance: { name: 'Giriş Efekti', icon: 'flash-outline' },
    priority: { name: 'Profil Önceliği', icon: 'trending-up-outline' },
    badge: { name: 'VIP Rozet', icon: 'shield-checkmark-outline' },
    crown: { name: 'Taç Rozeti', icon: 'diamond-outline' },
    room: { name: 'Oda Ayrıcalığı', icon: 'people-outline' },
};

const TITLE_THEMES = {
    knight: {
        accent: '#D5C5A5',
        accentSoft: '#82745C',
        gradient: ['#111319', '#080A0E', '#050506'],
        glow: 'rgba(185, 207, 236, 0.18)',
        image: require('../../assets/sovalye_v2.png'),
        backgroundImage: require('../../assets/sovalyebackground_v2.png'),
        backgroundImageOpacity: 0.65,
        isCutout: true,
        motto: 'Cesaretin asaletle mühürlendiği ilk mertebe',
        benefits: ['renewal', 'identity', 'medal', 'frame', 'bubble', 'entrance', 'priority', 'badge'],
    },
    baron: {
        accent: '#C9A7DB',
        accentSoft: '#785986',
        gradient: ['#17101D', '#0B0910', '#050506'],
        glow: 'rgba(158, 91, 196, 0.22)',
        image: require('../../assets/baron_v3.png'),
        backgroundImage: require('../../assets/baronbackground_v2.png'),
        backgroundImageOpacity: 0.65,
        isCutout: true,
        motto: 'Seçkin çevrelerin zarif ve ayrıcalıklı nişanı',
        benefits: ['renewal', 'identity', 'medal', 'frame', 'bubble', 'entrance', 'room', 'badge'],
    },
    king: {
        accent: '#E3BE72',
        accentSoft: '#8F682E',
        gradient: ['#1B150A', '#0D0A06', '#050506'],
        glow: 'rgba(224, 177, 77, 0.24)',
        image: require('../../assets/kral_v2.png'),
        backgroundImage: require('../../assets/kralbackground_v2.png'),
        backgroundImageOpacity: 0.65,
        isCutout: true,
        motto: 'Gücün, ihtişamın ve görünür prestijin simgesi',
        benefits: ['renewal', 'identity', 'crown', 'frame', 'bubble', 'entrance', 'priority', 'room'],
    },
    duke: {
        accent: '#D6A2BB',
        accentSoft: '#875068',
        gradient: ['#1C0C14', '#0D080B', '#050506'],
        glow: 'rgba(193, 76, 127, 0.22)',
        image: require('../../assets/duk_v2.png'),
        backgroundImage: require('../../assets/dukbackground_v2.png'),
        backgroundImageOpacity: 0.80,
        isCutout: true,
        imageStyle: { transform: [{ scale: 1.95 }, { translateY: 40 }] },
        motto: 'Hanedan zarafetini modern prestijle buluşturan unvan',
        benefits: ['renewal', 'identity', 'crown', 'frame', 'bubble', 'entrance', 'priority', 'badge'],
    },
    emperor: {
        accent: '#E6B46B',
        accentSoft: '#98562E',
        gradient: ['#200D08', '#0D0806', '#050506'],
        glow: 'rgba(226, 118, 55, 0.27)',
        image: require('../../assets/imparator_v2.png'),
        backgroundImage: require('../../assets/imparatorbackground_v2.png'),
        backgroundImageOpacity: 0.80,
        isCutout: true,
        motto: 'Asalet merkezinin erişilebilen en yüksek mertebesi',
        benefits: ['renewal', 'identity', 'crown', 'frame', 'bubble', 'entrance', 'priority', 'room'],
    },
};

const getTitleKey = (title) => {
    if (title?.key && TITLE_THEMES[title.key]) return title.key;
    return DEFAULT_TITLES.find((item) => Number(item.level) === Number(title?.level))?.key || 'knight';
};

const formatPrice = (value) => String(Number(value) || 0).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// ── Floating premium particles ──────────────────────────────────────
const PARTICLE_COUNT = 22;

function generateParticleConfigs() {
    const configs = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const size = 2 + Math.random() * 4; // 2–6px
        configs.push({
            id: i,
            size,
            startX: Math.random() * width,
            startY: screenHeight + 20 + Math.random() * 60,
            endY: -(20 + Math.random() * 80),
            driftX: (Math.random() - 0.5) * 90, // horizontal sway ±45
            duration: 6000 + Math.random() * 8000, // 6–14s per cycle
            delay: Math.random() * 6000,
            peakOpacity: 0.18 + Math.random() * 0.45,
            isGlowing: Math.random() > 0.65, // ~35% get a soft glow
        });
    }
    return configs;
}

const PARTICLE_CONFIGS = generateParticleConfigs();

function PremiumParticle({ config, accentColor, reduceMotion }) {
    const progress = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (reduceMotion) return undefined;

        const animate = () => {
            progress.setValue(0);
            Animated.sequence([
                Animated.delay(config.delay),
                Animated.timing(progress, {
                    toValue: 1,
                    duration: config.duration,
                    easing: Easing.linear,
                    useNativeDriver: true,
                }),
            ]).start(({ finished }) => {
                if (finished) animate();
            });
        };
        animate();
        return () => progress.stopAnimation();
    }, [reduceMotion]);

    if (reduceMotion) return null;

    const translateY = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [config.startY, config.endY],
    });

    const translateX = progress.interpolate({
        inputRange: [0, 0.25, 0.5, 0.75, 1],
        outputRange: [
            0,
            config.driftX * 0.6,
            config.driftX,
            config.driftX * 0.6,
            0,
        ],
    });

    const opacity = progress.interpolate({
        inputRange: [0, 0.08, 0.35, 0.7, 0.92, 1],
        outputRange: [0, config.peakOpacity * 0.5, config.peakOpacity, config.peakOpacity * 0.85, config.peakOpacity * 0.3, 0],
    });

    const scale = progress.interpolate({
        inputRange: [0, 0.15, 0.5, 0.85, 1],
        outputRange: [0.3, 1, 1.15, 0.9, 0.4],
    });

    return (
        <Animated.View
            pointerEvents="none"
            style={{
                position: 'absolute',
                left: config.startX,
                width: config.size,
                height: config.size,
                borderRadius: config.size / 2,
                backgroundColor: accentColor,
                opacity,
                transform: [{ translateY }, { translateX }, { scale }],
                ...(config.isGlowing ? {
                    shadowColor: accentColor,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.8,
                    shadowRadius: 6,
                } : {}),
            }}
        />
    );
}

const PremiumParticles = React.memo(function PremiumParticles({ accentColor, reduceMotion }) {
    if (reduceMotion) return null;
    return (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {PARTICLE_CONFIGS.map((config) => (
                <PremiumParticle
                    key={config.id}
                    config={config}
                    accentColor={accentColor}
                    reduceMotion={reduceMotion}
                />
            ))}
        </View>
    );
});

export function NobilityTabs({ titles, selectedTitle, onSelect, accent }) {
    const [layoutWidth, setLayoutWidth] = useState(0);
    const selectedIndex = Math.max(0, titles.findIndex((title) => title.id === selectedTitle?.id));
    const [visualIndex, setVisualIndex] = useState(selectedIndex);
    const indicatorIndex = useRef(new Animated.Value(selectedIndex)).current;
    const gap = 4;
    const horizontalPadding = 14;
    const tabWidth = layoutWidth > 0
        ? (layoutWidth - (horizontalPadding * 2) - (gap * (titles.length - 1))) / titles.length
        : 0;

    const moveIndicator = (index) => {
        setVisualIndex(index);
        Animated.spring(indicatorIndex, {
            toValue: index,
            speed: 20,
            bounciness: 4,
            useNativeDriver: true,
        }).start();
    };

    useEffect(() => {
        moveIndicator(selectedIndex);
    }, [selectedIndex]);

    return (
        <View style={styles.tabsContent} onLayout={(event) => setLayoutWidth(event.nativeEvent.layout.width)}>
            {tabWidth > 0 && (
                <Animated.View
                    pointerEvents="none"
                    style={[
                        styles.tabIndicator,
                        {
                            width: tabWidth,
                            borderColor: accent,
                            transform: [{
                                translateX: Animated.multiply(indicatorIndex, tabWidth + gap),
                            }],
                        },
                    ]}
                />
            )}
            {titles.map((title, index) => {
                const selected = visualIndex === index;
                return (
                    <TouchableOpacity
                        key={title.id}
                        activeOpacity={0.78}
                        onPress={() => {
                            moveIndicator(index);
                            onSelect(title);
                        }}
                        style={styles.tab}
                    >
                        <Text style={[styles.tabText, selected && styles.tabTextActive]}>{title.name}</Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

export function NobilityHeroPreview({ title, theme, reduceMotion = false }) {
    const floatY = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (reduceMotion) {
            floatY.setValue(0);
            return undefined;
        }

        const floating = Animated.loop(
            Animated.sequence([
                Animated.timing(floatY, {
                    toValue: -5,
                    duration: 2600,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
                Animated.timing(floatY, {
                    toValue: 0,
                    duration: 2600,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
            ]),
        );
        floating.start();
        return () => floating.stop();
    }, [floatY, reduceMotion]);

    return (
        <Animated.View style={[styles.heroSection, { transform: [{ translateY: floatY }] }]}>
            <View style={[
                styles.heroFrame,
                theme.isCutout && styles.heroFrameCutout,
                { borderColor: `${theme.accent}70`, shadowColor: theme.accent },
            ]}>
                {!theme.isCutout && (
                    <LinearGradient
                        colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.015)', 'rgba(0,0,0,0.34)']}
                        style={StyleSheet.absoluteFill}
                    />
                )}
                {!theme.isCutout && (
                    <>
                        <View style={[styles.heroCorner, styles.heroCornerTopLeft, { borderColor: theme.accent }]} />
                        <View style={[styles.heroCorner, styles.heroCornerTopRight, { borderColor: theme.accent }]} />
                    </>
                )}
                <Image
                    source={theme.image}
                    resizeMode={theme.isCutout ? 'contain' : 'cover'}
                    style={[
                        styles.heroImage,
                        theme.isCutout && styles.heroCutoutImage,
                        theme.imageStyle,
                    ]}
                />
                {!theme.isCutout && (
                    <LinearGradient
                        colors={['rgba(255,255,255,0.025)', 'transparent', 'rgba(4,4,6,0.16)']}
                        locations={[0, 0.52, 1]}
                        style={StyleSheet.absoluteFill}
                    />
                )}
            </View>
        </Animated.View>
    );
}

export function NobilityBenefitItem({ benefit, accent, animation }) {
    const animatedStyle = animation ? {
        opacity: animation,
        transform: [{
            translateY: animation.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }),
        }],
    } : null;

    return (
        <Animated.View style={[styles.benefitItem, animatedStyle]}>
            <View style={[
                styles.benefitCircleOuter,
                { borderColor: `${accent}42` },
            ]}>
                <LinearGradient
                    colors={['#45464B', '#292A2F', '#141519']}
                    start={{ x: 0.18, y: 0 }}
                    end={{ x: 0.82, y: 1 }}
                    style={styles.benefitCircle}
                >
                    <Ionicons name={benefit.icon} size={25} color="#D9DADD" />
                    <View style={[styles.benefitDot, { backgroundColor: accent }]} />
                </LinearGradient>
            </View>
            <Text numberOfLines={2} style={styles.benefitText}>{benefit.name}</Text>
        </Animated.View>
    );
}

export function NobilityBenefitsGrid({ theme, reduceMotion = false }) {
    const itemAnimations = useRef(theme.benefits.map(() => new Animated.Value(0))).current;

    useEffect(() => {
        itemAnimations.forEach((value) => value.setValue(reduceMotion ? 1 : 0));
        if (reduceMotion) return undefined;

        const entrance = Animated.stagger(
            55,
            itemAnimations.map((value) => Animated.timing(value, {
                toValue: 1,
                duration: 300,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            })),
        );
        entrance.start();
        return () => entrance.stop();
    }, [itemAnimations, reduceMotion, theme]);

    return (
        <View style={styles.benefitsGrid}>
            {theme.benefits.map((key, index) => (
                <NobilityBenefitItem
                    key={key}
                    benefit={COMMON_BENEFITS[key]}
                    accent={theme.accent}
                    animation={itemAnimations[index]}
                />
            ))}
        </View>
    );
}

function NobilityBenefitsHeader({ theme }) {
    return (
        <View style={styles.benefitsHeader}>
            <View
                pointerEvents="none"
                style={[styles.benefitsHeaderArc, { borderColor: `${theme.accent}42` }]}
            />
            <View style={styles.benefitsHeaderContent}>
                <View style={styles.benefitsTitlePill}>
                    <View style={[styles.headerDiamond, { backgroundColor: theme.accent }]} />
                    <Text style={styles.sectionTitle}>Özel Ayrıcalıklar</Text>
                    <View style={[styles.headerDiamond, { backgroundColor: theme.accent }]} />
                </View>
            </View>
        </View>
    );
}

export function NobilityDualActionButtons({
    disabled,
    isOwned,
    isLower,
    onGift,
    onActivate,
    reduceMotion = false,
    theme,
}) {
    const pressScalePrimary = useRef(new Animated.Value(1)).current;
    const pressScaleSecondary = useRef(new Animated.Value(1)).current;
    const borderRotate = useRef(new Animated.Value(0)).current;
    const glowPulse = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (reduceMotion) return undefined;

        // Smooth clockwise rotation for border highlight sweep – 4s loop
        const rotate = Animated.loop(
            Animated.timing(borderRotate, {
                toValue: 1,
                duration: 4000,
                easing: Easing.linear,
                useNativeDriver: true,
            }),
        );

        // Soft glow pulse behind the primary button
        const glow = Animated.loop(
            Animated.sequence([
                Animated.timing(glowPulse, {
                    toValue: 1,
                    duration: 2200,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
                Animated.timing(glowPulse, {
                    toValue: 0,
                    duration: 2200,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
            ]),
        );

        rotate.start();
        glow.start();
        return () => {
            rotate.stop();
            glow.stop();
        };
    }, [reduceMotion, borderRotate, glowPulse]);

    const animatePress = (animValue, pressed) => {
        if (reduceMotion) return;
        Animated.spring(animValue, {
            toValue: pressed ? 0.97 : 1,
            speed: 35,
            bounciness: pressed ? 0 : 5,
            useNativeDriver: true,
        }).start();
    };

    const spin = borderRotate.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    const pulseOpacity = glowPulse.interpolate({
        inputRange: [0, 1],
        outputRange: [0.2, 0.6],
    });

    // Border gradient: mostly dark base with a small bright gold highlight segment (~25%)
    // As the square rotates, only the bright part sweeps across the visible border
    const borderBaseColor = '#3D3220'; // dark muted gold — subtle base border
    const borderHighlightGradient = [
        borderBaseColor,       // 0.0 – dark
        borderBaseColor,       // 0.35 – still dark
        '#B57C1E',             // 0.42 – transition into gold
        '#D9B24C',             // 0.48 – warm gold
        '#FFF4B5',             // 0.52 – bright highlight peak
        '#F4DE7A',             // 0.56 – bright gold
        '#D9B24C',             // 0.62 – fading
        '#B57C1E',             // 0.68 – transition out
        borderBaseColor,       // 0.75 – back to dark
        borderBaseColor,       // 1.0 – dark
    ];
    const borderHighlightLocations = [0, 0.35, 0.42, 0.48, 0.52, 0.56, 0.62, 0.68, 0.75, 1];

    return (
        <View style={premiumStyles.buttonsRow}>
            {/* ── SECONDARY BUTTON: Dağıt ── */}
            <Animated.View style={[premiumStyles.btnOuter, premiumStyles.btnSecondaryOuter, { transform: [{ scale: pressScaleSecondary }] }]}>
                {/* Static subtle silver border */}
                <View style={premiumStyles.secondaryBorderFill}>
                    <LinearGradient
                        colors={['#C8C8CE', '#A8A8B0', '#C8C8CE']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                    />
                </View>
                <View style={premiumStyles.btnInner}>
                    <LinearGradient
                        colors={['#FAFAFA', '#ECEDF0', '#DCDCE0']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0.6, y: 1 }}
                        style={StyleSheet.absoluteFill}
                    />
                    <TouchableOpacity
                        activeOpacity={0.88}
                        style={premiumStyles.btnHitArea}
                        onPressIn={() => animatePress(pressScaleSecondary, true)}
                        onPressOut={() => animatePress(pressScaleSecondary, false)}
                        onPress={onGift}
                    >
                        <Text style={premiumStyles.secondaryText}>Dağıt</Text>
                    </TouchableOpacity>
                </View>
            </Animated.View>

            {/* ── PRIMARY BUTTON: Etkinleştir ── */}
            <Animated.View style={[
                premiumStyles.btnOuter,
                premiumStyles.btnPrimaryOuter,
                isLower && premiumStyles.btnDisabledOuter,
                { transform: [{ scale: pressScalePrimary }] },
            ]}>
                {/* Pulsing gold glow behind the button */}
                {!reduceMotion && !isLower && (
                    <Animated.View style={[premiumStyles.primaryGlow, { opacity: pulseOpacity }]} />
                )}

                {/* Rotating gold highlight on border — only a segment is bright */}
                {!reduceMotion && !isLower && (
                    <Animated.View style={[premiumStyles.borderSpinner, { transform: [{ rotate: spin }] }]}>
                        <LinearGradient
                            colors={borderHighlightGradient}
                            locations={borderHighlightLocations}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={StyleSheet.absoluteFill}
                        />
                    </Animated.View>
                )}

                {/* Static dark base border for lower/disabled state */}
                {isLower && (
                    <View style={premiumStyles.staticBorderFill}>
                        <LinearGradient
                            colors={['#444448', '#333338', '#444448']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={StyleSheet.absoluteFill}
                        />
                    </View>
                )}

                {/* Static dark base border for active state (visible when highlight segment is not covering) */}
                {!isLower && !reduceMotion && (
                    <View style={[premiumStyles.staticBorderFill, { zIndex: -1 }]}>
                        <LinearGradient
                            colors={['#3D3220', '#2E2518', '#3D3220']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={StyleSheet.absoluteFill}
                        />
                    </View>
                )}

                {/* Clean button surface — no overlays, no shimmer, no highlight lines */}
                <View style={[premiumStyles.btnInner, isLower && premiumStyles.btnInnerDisabled]}>
                    <LinearGradient
                        colors={isLower
                            ? ['#55555A', '#3A3B40', '#292A2F']
                            : ['#F2DEB8', '#D6A45E', '#A9742E']
                        }
                        locations={isLower ? [0, 0.5, 1] : [0, 0.45, 1]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0.7 }}
                        style={StyleSheet.absoluteFill}
                    />
                    <TouchableOpacity
                        activeOpacity={0.82}
                        disabled={disabled || isLower}
                        style={premiumStyles.btnHitArea}
                        onPressIn={() => animatePress(pressScalePrimary, true)}
                        onPressOut={() => animatePress(pressScalePrimary, false)}
                        onPress={onActivate}
                    >
                        {disabled ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <Text style={[
                                premiumStyles.primaryText,
                                isLower && premiumStyles.primaryTextDisabled,
                            ]}>
                                {isLower ? 'Aktif Değil' : isOwned ? 'Yenile' : 'Etkinleştir'}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </Animated.View>
        </View>
    );
}

const PREMIUM_BTN_HEIGHT = 58;
const PREMIUM_BTN_RADIUS = 29;
const PREMIUM_BORDER_WIDTH = 2;
const SPINNER_SIZE = width * 1.4;

const premiumStyles = StyleSheet.create({
    buttonsRow: {
        flexDirection: 'row',
        gap: 14,
        width: '100%',
    },

    // ── Outer container (clips the spinning border) ──
    btnOuter: {
        height: PREMIUM_BTN_HEIGHT,
        borderRadius: PREMIUM_BTN_RADIUS,
        overflow: 'hidden',
    },
    btnSecondaryOuter: {
        flex: 0.42,
    },
    btnPrimaryOuter: {
        flex: 0.58,
    },
    btnDisabledOuter: {
        opacity: 0.5,
    },

    // ── Inner surface (inset to reveal border ring) ──
    btnInner: {
        position: 'absolute',
        top: PREMIUM_BORDER_WIDTH,
        left: PREMIUM_BORDER_WIDTH,
        right: PREMIUM_BORDER_WIDTH,
        bottom: PREMIUM_BORDER_WIDTH,
        borderRadius: PREMIUM_BTN_RADIUS - PREMIUM_BORDER_WIDTH,
        overflow: 'hidden',
    },
    btnInnerDisabled: {
        top: 1,
        left: 1,
        right: 1,
        bottom: 1,
    },

    // ── Spinning gradient square (only bright segment visible as border highlight) ──
    borderSpinner: {
        position: 'absolute',
        width: SPINNER_SIZE,
        height: SPINNER_SIZE,
        left: -(SPINNER_SIZE - width) / 2,
        top: -(SPINNER_SIZE - PREMIUM_BTN_HEIGHT) / 2,
    },

    // ── Static border fill (base border color) ──
    staticBorderFill: {
        ...StyleSheet.absoluteFillObject,
    },

    // ── Secondary button static silver border ──
    secondaryBorderFill: {
        ...StyleSheet.absoluteFillObject,
    },

    // ── Glow behind primary button ──
    primaryGlow: {
        position: 'absolute',
        left: -5,
        right: -5,
        top: -5,
        bottom: -5,
        borderRadius: PREMIUM_BTN_RADIUS + 5,
        backgroundColor: 'rgba(255, 240, 160, 0.12)',
        shadowColor: '#D9B24C',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.45,
        shadowRadius: 14,
        elevation: 6,
    },

    // ── Hit area & text ──
    btnHitArea: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
    },
    secondaryText: {
        color: '#3A3A3E',
        fontSize: 16,
        fontWeight: '800',
    },
    primaryText: {
        color: '#FFFEF5',
        fontSize: 17,
        fontWeight: '900',
        letterSpacing: 0.3,
        textShadowColor: 'rgba(80, 45, 8, 0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    primaryTextDisabled: {
        color: 'rgba(255,255,255,0.55)',
        textShadowColor: 'transparent',
    },
});

export function NobilityBottomPurchaseBar({
    title,
    theme,
    actionLoading,
    isOwned,
    isLower,
    onGift,
    onActivate,
    bottomInset,
    reduceMotion,
    animatedStyle,
}) {
    return (
        <Animated.View style={[styles.purchaseBarPosition, { paddingBottom: Math.max(bottomInset, 10) }, animatedStyle]}>
            <BlurView intensity={42} tint="dark" style={styles.purchaseBar}>
                <LinearGradient
                    colors={['rgba(39,40,48,0.96)', 'rgba(17,18,24,0.98)', 'rgba(10,11,16,0.99)']}
                    style={StyleSheet.absoluteFill}
                />
                <View style={styles.priceRow}>
                    <View style={[styles.coinMark, { borderColor: theme.accent }]}>
                        <Ionicons name="diamond" size={12} color={theme.accent} />
                    </View>
                    <Text style={styles.priceText}>{formatPrice(title?.price)} Altın</Text>
                    <Text style={styles.durationText}>/ {title?.duration_days || 30} Gün</Text>
                    <Ionicons name="information-circle-outline" size={17} color="rgba(255,255,255,0.48)" />
                </View>
                <Text style={styles.purchaseDescription}>
                    Asalet unvanı 30 gün aktif kalır ve otomatik yenilenmez.
                </Text>
                <NobilityDualActionButtons
                    disabled={actionLoading}
                    isOwned={isOwned}
                    isLower={isLower}
                    onGift={onGift}
                    onActivate={onActivate}
                    reduceMotion={reduceMotion}
                    theme={theme}
                />
            </BlurView>
        </Animated.View>
    );
}

function PurchaseConfirmationModal({ visible, title, theme, isOwned, loading, onClose, onConfirm }) {
    return (
        <Modal visible={visible} transparent statusBarTranslucent animationType="fade" onRequestClose={onClose}>
            <View style={styles.modalRoot}>
                <Pressable style={StyleSheet.absoluteFill} onPress={loading ? undefined : onClose} />
                <BlurView pointerEvents="none" intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={[styles.modalCard, { borderColor: `${theme.accent}66` }]}>
                    <LinearGradient
                        colors={['#29272A', '#15151A', '#0B0C10']}
                        style={StyleSheet.absoluteFill}
                    />
                    <TouchableOpacity disabled={loading} style={styles.modalClose} onPress={onClose}>
                        <Ionicons name="close" size={21} color="rgba(255,255,255,0.62)" />
                    </TouchableOpacity>
                    <View style={[styles.modalCrest, { borderColor: theme.accent, backgroundColor: theme.glow }]}>
                        <Ionicons name={isOwned ? 'refresh' : 'shield-checkmark'} size={28} color={theme.accent} />
                    </View>
                    <Text style={styles.modalEyebrow}>ASALET MERKEZİ</Text>
                    <Text style={styles.modalTitle}>{isOwned ? 'Unvanı Yenile' : `${title?.name} Unvanını Etkinleştir`}</Text>
                    <Text style={styles.modalDescription}>
                        {isOwned
                            ? 'Mevcut unvan sürene 30 gün daha eklenecek.'
                            : 'Bu işlem seçili unvanı 30 gün boyunca hesabında aktif eder.'}
                    </Text>
                    <View style={styles.modalPriceLine}>
                        <Text style={[styles.modalPrice, { color: theme.accent }]}>{formatPrice(title?.price)} Altın</Text>
                        <Text style={styles.modalPriceCaption}>bakiyenden düşülecek</Text>
                    </View>
                    <View style={styles.modalActions}>
                        <TouchableOpacity disabled={loading} style={styles.modalCancel} onPress={onClose}>
                            <Text style={styles.modalCancelText}>Vazgeç</Text>
                        </TouchableOpacity>
                        <TouchableOpacity disabled={loading} style={styles.modalConfirmShell} onPress={onConfirm}>
                            <LinearGradient colors={['#F0DFC9', '#C79465', '#8A5B38']} style={styles.modalConfirm}>
                                {loading
                                    ? <ActivityIndicator size="small" color="#21150C" />
                                    : <Text style={styles.modalConfirmText}>{isOwned ? 'Yenile' : 'Onayla'}</Text>}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

export default function NobilityScreen({ navigation }) {
    const { showAlert } = useAlert();
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [titles, setTitles] = useState(DEFAULT_TITLES);
    const [selectedTitle, setSelectedTitle] = useState(DEFAULT_TITLES[0]);
    const [activeNobility, setActiveNobility] = useState(null);
    const [userBalance, setUserBalance] = useState(0);
    const [token, setToken] = useState('');
    const [confirmationVisible, setConfirmationVisible] = useState(false);
    const [reduceMotion, setReduceMotion] = useState(false);
    const chromeEntrance = useRef(new Animated.Value(0)).current;
    const contentEntrance = useRef(new Animated.Value(0)).current;
    const purchaseEntrance = useRef(new Animated.Value(0)).current;
    const contentTransitionOpacity = useRef(new Animated.Value(1)).current;
    const contentTransitionScale = useRef(new Animated.Value(1)).current;
    const titleTransition = useRef(null);

    const contentOpacity = useMemo(
        () => Animated.multiply(contentEntrance, contentTransitionOpacity),
        [contentEntrance, contentTransitionOpacity],
    );

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        let mounted = true;
        AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
            if (mounted) setReduceMotion(enabled);
        });
        const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
        return () => {
            mounted = false;
            subscription?.remove?.();
        };
    }, []);

    useEffect(() => {
        if (loading) return undefined;
        if (reduceMotion) {
            titleTransition.current?.stop?.();
            chromeEntrance.setValue(1);
            contentEntrance.setValue(1);
            purchaseEntrance.setValue(1);
            contentTransitionOpacity.setValue(1);
            contentTransitionScale.setValue(1);
            return undefined;
        }

        chromeEntrance.setValue(0);
        contentEntrance.setValue(0);
        purchaseEntrance.setValue(0);
        const entrance = Animated.stagger(90, [
            Animated.timing(chromeEntrance, {
                toValue: 1,
                duration: 360,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.spring(contentEntrance, {
                toValue: 1,
                speed: 16,
                bounciness: 4,
                useNativeDriver: true,
            }),
            Animated.spring(purchaseEntrance, {
                toValue: 1,
                speed: 18,
                bounciness: 3,
                useNativeDriver: true,
            }),
        ]);
        entrance.start();
        return () => entrance.stop();
    }, [
        chromeEntrance,
        contentEntrance,
        contentTransitionOpacity,
        contentTransitionScale,
        loading,
        purchaseEntrance,
        reduceMotion,
    ]);

    useEffect(() => () => titleTransition.current?.stop?.(), []);

    const loadData = async () => {
        try {
            const userToken = await AsyncStorage.getItem('token');
            setToken(userToken || '');
            if (!userToken) return;

            const config = { headers: { Authorization: `Bearer ${userToken}` } };
            const [meResult, balanceResult, titlesResult] = await Promise.allSettled([
                axios.get(`${API_URL}/nobility/me`, config),
                axios.get(`${API_URL}/users/balance`, config),
                axios.get(`${API_URL}/nobility/titles`, config),
            ]);

            const active = meResult.status === 'fulfilled' ? meResult.value.data : null;
            const remoteTitles = titlesResult.status === 'fulfilled' ? titlesResult.value.data : null;

            setActiveNobility(active);
            if (balanceResult.status === 'fulfilled') {
                setUserBalance(Number(balanceResult.value.data?.balance) || 0);
            }
            if (Array.isArray(remoteTitles) && remoteTitles.length) {
                setTitles(remoteTitles);
                const initial = active
                    ? remoteTitles.find((item) => Number(item.id) === Number(active.title_id))
                    : null;
                setSelectedTitle(initial || remoteTitles[0]);
            }
        } catch (error) {
            console.error('[Nobility Screen] Load Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const theme = useMemo(() => TITLE_THEMES[getTitleKey(selectedTitle)], [selectedTitle]);
    const isOwned = Boolean(activeNobility && Number(activeNobility.title_id) === Number(selectedTitle?.id));
    const isLower = Boolean(activeNobility && Number(selectedTitle?.level) < Number(activeNobility.level));

    const handleTitleSelect = (title) => {
        if (Number(title?.id) === Number(selectedTitle?.id)) return;
        if (reduceMotion) {
            setSelectedTitle(title);
            return;
        }

        titleTransition.current?.stop?.();
        titleTransition.current = Animated.parallel([
            Animated.timing(contentTransitionOpacity, {
                toValue: 0,
                duration: 120,
                easing: Easing.in(Easing.quad),
                useNativeDriver: true,
            }),
            Animated.timing(contentTransitionScale, {
                toValue: 0.985,
                duration: 120,
                easing: Easing.in(Easing.quad),
                useNativeDriver: true,
            }),
        ]);
        titleTransition.current.start(({ finished }) => {
            if (!finished) return;
            setSelectedTitle(title);
            contentTransitionScale.setValue(1.015);
            titleTransition.current = Animated.parallel([
                Animated.timing(contentTransitionOpacity, {
                    toValue: 1,
                    duration: 240,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
                Animated.spring(contentTransitionScale, {
                    toValue: 1,
                    speed: 20,
                    bounciness: 2,
                    useNativeDriver: true,
                }),
            ]);
            titleTransition.current.start();
        });
    };

    const runPurchase = async () => {
        if (!selectedTitle || actionLoading) return;
        if (userBalance < Number(selectedTitle.price)) {
            setConfirmationVisible(false);
            showAlert({
                title: 'Yetersiz Bakiye',
                message: `Bu unvan için ${formatPrice(selectedTitle.price)} altın gerekiyor.`,
                type: 'error',
            });
            return;
        }

        setActionLoading(true);
        try {
            const endpoint = isOwned ? 'renew' : 'purchase';
            const response = await axios.post(
                `${API_URL}/nobility/${endpoint}`,
                { titleId: selectedTitle.id },
                { headers: { Authorization: `Bearer ${token}` } },
            );
            setActiveNobility(response.data.nobility);
            setUserBalance(Number(response.data.new_balance) || 0);
            setConfirmationVisible(false);
            showAlert({
                title: isOwned ? 'Süre Uzatıldı' : 'Unvan Etkinleştirildi',
                message: response.data.message || `${selectedTitle.name} unvanın artık aktif.`,
                type: 'success',
            });
        } catch (error) {
            showAlert({
                title: 'İşlem Başarısız',
                message: error.response?.data?.error || 'Satın alma işlemi tamamlanamadı.',
                type: 'error',
            });
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingRoot}>
                <LinearGradient colors={['#17130F', '#080A0E', '#050505']} style={StyleSheet.absoluteFill} />
                <View style={styles.loadingCrest}><Ionicons name="shield" size={30} color="#C69A6B" /></View>
                <ActivityIndicator size="small" color="#C69A6B" />
                <Text style={styles.loadingText}>Asalet Merkezi hazırlanıyor</Text>
            </View>
        );
    }

    return (
        <View style={styles.root}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
            <LinearGradient colors={theme.gradient} style={StyleSheet.absoluteFill} />
            <ImageBackground
                source={theme.backgroundImage || require('../../assets/nobility/royal_background.png')}
                resizeMode="cover"
                imageStyle={[styles.backgroundImage, { opacity: theme.backgroundImageOpacity ?? 0.045 }]}
                style={StyleSheet.absoluteFill}
            />
            <LinearGradient
                pointerEvents="none"
                colors={[`${theme.accent}16`, 'transparent', `${theme.accentSoft}12`, 'transparent']}
                locations={[0, 0.3, 0.7, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
            />
            <PremiumParticles accentColor={theme.accent} reduceMotion={reduceMotion} />
            <SafeAreaView edges={['top']} style={styles.safeArea}>
                <Animated.View style={{
                    opacity: chromeEntrance,
                    transform: [{
                        translateY: chromeEntrance.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }),
                    }],
                }}>
                    <View style={styles.header}>
                        <TouchableOpacity activeOpacity={0.72} onPress={() => navigation.goBack()} style={styles.headerButton}>
                            <Ionicons name="chevron-back" size={24} color="#E8E8EA" />
                        </TouchableOpacity>
                        <View style={styles.headerTitleWrap}>
                            <Text style={[styles.headerEyebrow, { color: theme.accent }]}>PREMIUM STATÜ</Text>
                            <Text style={styles.headerTitle}>Asalet Merkezi</Text>
                        </View>
                        <TouchableOpacity
                            activeOpacity={0.72}
                            style={styles.headerButton}
                            onPress={() => showAlert({
                                title: 'Asalet Unvanları',
                                message: 'Unvanlar 30 gün aktif kalır. Daha yüksek bir mertebeye dilediğin zaman geçebilirsin.',
                                type: 'info',
                            })}
                        >
                            <Ionicons name="help" size={21} color="#E8E8EA" />
                        </TouchableOpacity>
                    </View>

                    <NobilityTabs
                        titles={titles}
                        selectedTitle={selectedTitle}
                        onSelect={handleTitleSelect}
                        accent={theme.accent}
                    />
                </Animated.View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                    <Animated.View style={{
                        opacity: contentOpacity,
                        transform: [
                            {
                                scale: contentEntrance.interpolate({ inputRange: [0, 1], outputRange: [0.965, 1] }),
                            },
                            { scale: contentTransitionScale },
                        ],
                    }}>
                        <NobilityHeroPreview title={selectedTitle} theme={theme} reduceMotion={reduceMotion} />
                        <NobilityBenefitsHeader theme={theme} />
                        <NobilityBenefitsGrid theme={theme} reduceMotion={reduceMotion} />
                    </Animated.View>
                </ScrollView>

                <NobilityBottomPurchaseBar
                    title={selectedTitle}
                    theme={theme}
                    actionLoading={actionLoading}
                    isOwned={isOwned}
                    isLower={isLower}
                    bottomInset={insets.bottom}
                    reduceMotion={reduceMotion}
                    animatedStyle={{
                        opacity: purchaseEntrance,
                        transform: [{
                            translateY: purchaseEntrance.interpolate({ inputRange: [0, 1], outputRange: [54, 0] }),
                        }],
                    }}
                    onGift={() => showAlert({
                        title: 'Hediye Et',
                        message: 'Unvan hediye etme seçeneği yakında kullanıma açılacak.',
                        type: 'info',
                    })}
                    onActivate={() => setConfirmationVisible(true)}
                />
            </SafeAreaView>

            <PurchaseConfirmationModal
                visible={confirmationVisible}
                title={selectedTitle}
                theme={theme}
                isOwned={isOwned}
                loading={actionLoading}
                onClose={() => setConfirmationVisible(false)}
                onConfirm={runPurchase}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#050506' },
    safeArea: { flex: 1 },
    backgroundImage: { opacity: 0.045 },
    loadingRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
    loadingCrest: {
        width: 64,
        height: 64,
        borderRadius: 32,
        borderWidth: 1,
        borderColor: 'rgba(198,154,107,0.45)',
        backgroundColor: 'rgba(198,154,107,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
    },
    loadingText: { color: 'rgba(255,255,255,0.58)', fontSize: 13, letterSpacing: 0.4 },
    header: {
        height: 62,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.13)',
        backgroundColor: 'rgba(255,255,255,0.045)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitleWrap: { alignItems: 'center' },
    headerEyebrow: { color: '#A98B67', fontSize: 8, fontWeight: '800', letterSpacing: 2.1, marginBottom: 3 },
    headerTitle: { color: '#F4F3F1', fontSize: 19, fontWeight: '700', letterSpacing: 0.4 },
    tabsContent: {
        width: '100%',
        paddingHorizontal: 14,
        paddingVertical: 7,
        flexDirection: 'row',
        gap: 4,
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    tabIndicator: {
        position: 'absolute',
        left: 14,
        top: 7,
        height: 39,
        borderRadius: 20,
        borderWidth: 1,
        backgroundColor: 'rgba(255,255,255,0.055)',
    },
    tab: {
        flex: 1,
        height: 39,
        paddingHorizontal: 3,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    tabText: { color: 'rgba(255,255,255,0.42)', fontSize: 14, fontWeight: '600' },
    tabTextActive: { color: '#FFFFFF', fontWeight: '700' },
    scrollContent: { paddingTop: 10, paddingBottom: 248 },
    heroSection: { alignItems: 'center', justifyContent: 'center', marginTop: 12 },
    heroFrame: {
        width: HERO_SIZE,
        height: HERO_SIZE,
        borderRadius: 24,
        borderWidth: 1,
        overflow: 'hidden',
        backgroundColor: '#0A0B0F',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 18 },
        shadowOpacity: 0.16,
        shadowRadius: 24,
        elevation: 16,
    },
    heroFrameCutout: {
        borderWidth: 0,
        backgroundColor: 'transparent',
        overflow: 'visible',
        shadowOpacity: 0,
        elevation: 0,
    },
    heroImage: { width: '100%', height: '100%' },
    heroCutoutImage: { transform: [{ scale: 1.8 }, { translateY: 45 }] },
    heroCorner: { position: 'absolute', zIndex: 2, top: 11, width: 28, height: 28, borderTopWidth: 1.5 },
    heroCornerTopLeft: { left: 11, borderLeftWidth: 1.5, borderTopLeftRadius: 8 },
    heroCornerTopRight: { right: 11, borderRightWidth: 1.5, borderTopRightRadius: 8 },
    benefitsHeader: {
        height: 64,
        marginTop: 17,
        marginBottom: 12,
        justifyContent: 'center',
        overflow: 'hidden',
    },
    benefitsHeaderArc: {
        position: 'absolute',
        width: width * 2.6,
        height: width * 2.6,
        borderRadius: width * 1.3,
        left: -width * 0.8,
        top: -(width * 2.6) + 36,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.11)',
    },
    benefitsHeaderContent: {
        position: 'absolute',
        top: 24,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    benefitsTitlePill: {
        minHeight: 30,
        paddingHorizontal: 14,
        borderRadius: 15,
        backgroundColor: '#080A0E',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    headerDiamond: {
        width: 5,
        height: 5,
        backgroundColor: '#D8D8DA',
        transform: [{ rotate: '45deg' }],
        shadowColor: '#FFFFFF',
        shadowOpacity: 0.35,
        shadowRadius: 3,
    },
    sectionTitle: {
        color: '#DEDEE0',
        fontSize: 15,
        fontWeight: '800',
        letterSpacing: 0.1,
        textShadowColor: 'rgba(255,255,255,0.18)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    benefitsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, rowGap: 26 },
    benefitItem: { width: '33.33%', alignItems: 'center', paddingHorizontal: 6 },
    benefitCircleOuter: {
        width: 68,
        height: 68,
        borderRadius: 34,
        borderWidth: 1,
        backgroundColor: '#202126',
        overflow: 'hidden',
    },
    benefitCircle: { flex: 1, borderRadius: 34, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    benefitDot: { position: 'absolute', width: 4, height: 4, borderRadius: 2, bottom: 8, opacity: 0.75 },
    benefitText: { color: 'rgba(236,236,238,0.69)', fontSize: 11, lineHeight: 14, fontWeight: '600', textAlign: 'center', marginTop: 8 },
    purchaseBarPosition: { position: 'absolute', left: 12, right: 12, bottom: 0 },
    purchaseBarGlow: { position: 'absolute', top: -10, left: 28, right: 28, height: 30, borderRadius: 20 },
    purchaseBar: {
        minHeight: 190,
        borderRadius: 30,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.16)',
        paddingHorizontal: 18,
        paddingTop: 19,
        paddingBottom: 15,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.5,
        shadowRadius: 18,
        elevation: 20,
    },
    panelAccent: { position: 'absolute', top: 0, left: '28%', right: '28%', height: 1, opacity: 0.7 },
    priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
    coinMark: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginRight: 2 },
    priceText: { color: '#FAFAFA', fontSize: 22, fontWeight: '800', letterSpacing: 0.2 },
    durationText: { color: 'rgba(255,255,255,0.61)', fontSize: 14, fontWeight: '600' },
    purchaseDescription: { color: 'rgba(255,255,255,0.43)', textAlign: 'center', fontSize: 11.5, marginTop: 6, marginBottom: 16 },
    dualButtonOuter: {
        width: '100%',
        height: 58,
        borderRadius: 29,
        overflow: 'hidden',
        padding: 1.8,
        backgroundColor: '#000',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.46,
        shadowRadius: 10,
        elevation: 9,
    },
    neonWrapper: {
        position: 'absolute',
        width: width * 1.3,
        height: width * 1.3,
        left: -width * 0.15,
        top: -(width * 1.3 - 58) / 2,
    },
    dualButtonInner: {
        position: 'absolute',
        top: 1.8,
        left: 1.8,
        right: 1.8,
        bottom: 1.8,
        borderRadius: 27.2,
        flexDirection: 'row',
        overflow: 'hidden',
        backgroundColor: '#111115',
    },
    buttonGlowShadow: {
        position: 'absolute',
        left: 2,
        right: 2,
        top: 2,
        bottom: 2,
        borderRadius: 29,
        backgroundColor: 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.95,
        shadowRadius: 15,
        elevation: 12,
        zIndex: -1,
    },
    dualButtonSilverSurface: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        width: '55%',
    },
    dualButtonGoldSurface: {
        position: 'absolute',
        top: -3,
        right: -5,
        bottom: -3,
        width: '54%',
        borderTopLeftRadius: 32,
        borderBottomLeftRadius: 8,
        transform: [{ skewX: '-7deg' }],
    },
    dualButtonHighlight: {
        position: 'absolute',
        top: 1,
        left: 26,
        right: 26,
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.66)',
    },
    buttonShimmer: {
        position: 'absolute',
        left: 0,
        top: -22,
        width: 46,
        height: 104,
        backgroundColor: 'rgba(255,255,255,0.14)',
    },
    dualButtonHitArea: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
    dualButtonPrimary: { paddingLeft: 8 },
    buttonDisabled: { opacity: 0.45 },
    secondaryButtonText: { color: '#343434', fontSize: 16, fontWeight: '800' },
    primaryButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '800',
        textShadowColor: 'rgba(54,30,17,0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    modalRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22, backgroundColor: 'rgba(0,0,0,0.58)' },
    modalCard: {
        width: '100%',
        maxWidth: 390,
        borderRadius: 30,
        borderWidth: 1,
        paddingHorizontal: 22,
        paddingTop: 31,
        paddingBottom: 20,
        alignItems: 'center',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 18 },
        shadowOpacity: 0.65,
        shadowRadius: 28,
        elevation: 24,
    },
    modalClose: { position: 'absolute', right: 14, top: 14, zIndex: 3, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    modalCrest: { width: 62, height: 62, borderRadius: 31, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
    modalEyebrow: { color: '#A89884', fontSize: 9, fontWeight: '800', letterSpacing: 2.1, marginBottom: 7 },
    modalTitle: { color: '#F6F5F3', fontSize: 20, fontWeight: '800', textAlign: 'center' },
    modalDescription: { color: 'rgba(255,255,255,0.52)', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 9, paddingHorizontal: 10 },
    modalPriceLine: { marginVertical: 20, alignItems: 'center' },
    modalPrice: { fontSize: 24, fontWeight: '900' },
    modalPriceCaption: { color: 'rgba(255,255,255,0.38)', fontSize: 11, marginTop: 3 },
    modalActions: { flexDirection: 'row', gap: 11, width: '100%' },
    modalCancel: { flex: 1, height: 50, borderRadius: 25, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.055)', alignItems: 'center', justifyContent: 'center' },
    modalCancelText: { color: 'rgba(255,255,255,0.72)', fontSize: 14, fontWeight: '700' },
    modalConfirmShell: { flex: 1, height: 50, borderRadius: 25, overflow: 'hidden' },
    modalConfirm: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    modalConfirmText: { color: '#21150C', fontSize: 14, fontWeight: '900' },
});
