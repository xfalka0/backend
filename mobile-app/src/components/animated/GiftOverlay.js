import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Image, Vibration, ActivityIndicator } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withDelay,
    withSpring,
    withRepeat,
    interpolate,
    runOnJS,
    Easing
} from 'react-native-reanimated';
import LottieView from 'lottie-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, ResizeMode } from 'expo-av';

const { width, height } = Dimensions.get('window');

const CONFETTI_LOTTIE = require('../../assets/lottie/vip_confetti.json');

// Premium Gifts - Supporting both transparent GIFs/WebPs and standard MP4 Videos
// (To make your custom drifting car fully transparent, convert yarisarabasi.mp4 to transparent yarisarabasi.gif, save it, and set type to 'gif'!)
const PREMIUM_VIDEOS = {
    6: {
        type: 'gif', // Change to 'gif' and change source file to yarisarabasi.gif for 100% transparency!
        source: require('../../../assets/yarisarabasi.webp')
    },
    7: {
        type: 'gif',
        source: require('../../../assets/sato.webp')
    },
    8: {
        type: 'video',
        source: { uri: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4' }
    },
    9: {
        type: 'video',
        source: { uri: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4' }
    },
    10: {
        type: 'video',
        source: { uri: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4' }
    }
};

// Particles Component for the standard "Wow" effect (non-premium gifts)
const Particle = ({ delay, index }) => {
    const y = useSharedValue(0);
    const x = useSharedValue(0);
    const opacity = useSharedValue(0);
    const scale = useSharedValue(0);

    useEffect(() => {
        const angle = (index * 45) * (Math.PI / 180);
        const radius = 120 + Math.random() * 60;
        
        opacity.value = withSequence(
            withDelay(delay, withTiming(1, { duration: 200 })),
            withTiming(0, { duration: 1000 })
        );
        
        scale.value = withSequence(
            withDelay(delay, withTiming(Math.random() * 0.8 + 0.4, { duration: 300 })),
            withTiming(0, { duration: 1000 })
        );

        x.value = withDelay(delay, withSpring(Math.cos(angle) * radius, { damping: 10 }));
        y.value = withDelay(delay, withSpring(Math.sin(angle) * radius, { damping: 10 }));
    }, []);

    const style = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [
            { translateX: x.value },
            { translateY: y.value },
            { scale: scale.value }
        ]
    }));

    return (
        <Animated.View style={[styles.particle, style]}>
            <LinearGradient
                colors={['#fbbf24', '#f59e0b']}
                style={StyleSheet.absoluteFill}
            />
        </Animated.View>
    );
};

export default function GiftOverlay({ gift, receiver, onFinish }) {
    // Shared values for animations
    const scale = useSharedValue(0);
    const opacity = useSharedValue(0);
    const contentOpacity = useSharedValue(0);
    const logoPulse = useSharedValue(1);
    const rotateY = useSharedValue(0);
    const textY = useSharedValue(50);
    const glowScale = useSharedValue(1);

    const [videoLoading, setVideoLoading] = useState(true);

    const isPremium = useMemo(() => gift && [6, 7, 8, 9, 10].includes(Number(gift.id)), [gift]);

    // Unconditional Top-Level Animated Styles Declarations (strict hook compliance)
    const backdropStyle = useAnimatedStyle(() => ({
        opacity: opacity.value
    }));

    const logoStyle = useAnimatedStyle(() => ({
        opacity: contentOpacity.value,
        transform: [
            { scale: scale.value * logoPulse.value },
            { rotateY: `${rotateY.value}rad` }
        ]
    }));

    const glowStyle = useAnimatedStyle(() => ({
        transform: [{ scale: glowScale.value }],
        opacity: interpolate(glowScale.value, [1, 1.2], [0.3, 0.1])
    }));

    const textStyle = useAnimatedStyle(() => ({
        opacity: contentOpacity.value,
        transform: [{ translateY: textY.value }]
    }));

    useEffect(() => {
        if (gift) {
            // Screen entry fade
            opacity.value = withTiming(1, { duration: 400 });

            // Content entry fade
            contentOpacity.value = withDelay(200, withTiming(1, { duration: 500 }));
            scale.value = withDelay(200, withSpring(1, { damping: 12, stiffness: 100 }));
            textY.value = withDelay(400, withSpring(0, { damping: 15 }));

            // 3D spinning logo for normal gifts
            if (!isPremium) {
                rotateY.value = withDelay(300, withRepeat(withTiming(Math.PI * 2, { duration: 4000, easing: Easing.linear }), -1));
                logoPulse.value = withDelay(800, withRepeat(withTiming(1.08, { duration: 1200 }), -1, true));
                glowScale.value = withRepeat(withTiming(1.2, { duration: 2000 }), -1, true);
            }

            Vibration.vibrate(150);

            // Auto Close Timer (Fallback close if loading hangs)
            let duration = 4000;
            if (gift) {
                const giftId = Number(gift.id);
                if (giftId === 6) duration = 6000;
                else if (giftId === 7) duration = 5000;
                else if (isPremium) duration = 12000;
            }
            const timer = setTimeout(() => {
                opacity.value = withTiming(0, { duration: 500 }, () => {
                    runOnJS(onFinish)();
                });
            }, duration);

            return () => clearTimeout(timer);
        }
    }, [gift]);

    const particles = useMemo(() => 
        Array.from({ length: 12 }).map((_, i) => (
            <Particle key={i} index={i} delay={400 + (i * 50)} />
        )),
    []);

    if (!gift) return null;

    // --- RENDER FOR PREMIUM VIRTUAL BOTTOM-OVERLAY VIDEOS ---
    if (isPremium) {
        const premiumAsset = PREMIUM_VIDEOS[Number(gift.id)];
        const isGif = premiumAsset && premiumAsset.type === 'gif';

        return (
            <Animated.View style={[styles.container, backdropStyle]} pointerEvents="box-none">
                {/* Fully transparent backdrop to overlay cleanly on top of the live chat screen */}
                <View style={styles.backdrop} />

                <View style={styles.premiumVideoWrapper}>
                    {isGif ? (
                        <Image
                            source={premiumAsset.source}
                            style={styles.premiumVideoPlayer}
                            resizeMode="contain"
                            onLoad={() => setVideoLoading(false)}
                        />
                    ) : (
                        <Video
                            source={
                                typeof premiumAsset.source === 'number'
                                    ? premiumAsset.source
                                    : {
                                        ...premiumAsset.source,
                                        headers: {
                                            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Mobile Safari/537.36'
                                        }
                                      }
                            }
                            rate={1.0}
                            volume={1.0}
                            isMuted={false}
                            resizeMode={ResizeMode.COVER}
                            shouldPlay
                            style={styles.premiumVideoPlayer}
                            onPlaybackStatusUpdate={(status) => {
                                if (status.isLoaded) {
                                    setVideoLoading(false);
                                }
                                if (status.didJustFinish) {
                                    opacity.value = withTiming(0, { duration: 400 }, () => {
                                        runOnJS(onFinish)();
                                    });
                                }
                            }}
                            onError={(error) => {
                                console.log('[VIDEO ERROR]', error);
                                setVideoLoading(false);
                                opacity.value = withTiming(0, { duration: 400 }, () => {
                                    runOnJS(onFinish)();
                                });
                            }}
                        />
                    )}

                    {/* Edge Blending Gradients to achieve a "PNG/Alpha" look (only needed for black-background videos) */}
                    {!isGif && (
                        <>
                            <LinearGradient
                                colors={['#0f051a', 'transparent']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 0, y: 1 }}
                                style={styles.topMask}
                            />
                            <LinearGradient
                                colors={['transparent', '#0f051a']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 0, y: 1 }}
                                style={styles.bottomMask}
                            />
                            <LinearGradient
                                colors={['#0f051a', 'transparent']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.leftMask}
                            />
                            <LinearGradient
                                colors={['transparent', '#0f051a']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.rightMask}
                            />
                        </>
                    )}
                </View>

                {videoLoading && (
                    <View style={styles.premiumLoadingContainer}>
                        <ActivityIndicator size="large" color="#fbbf24" />
                        <Text style={styles.loadingText}>Yükleniyor...</Text>
                    </View>
                )}

                {/* Breathtaking overlay info styled compactly right below the bottom video banner */}
                <Animated.View style={[styles.videoOverlay, textStyle]}>
                    <View style={styles.receiverBadge}>
                        <Text style={styles.receiverText}>{(receiver.display_name || receiver.username).toUpperCase()}</Text>
                    </View>
                    <Text style={styles.videoHeaderText}>HEDİYE GÖNDERİLDİ!</Text>
                    <View style={styles.videoGiftBadge}>
                        <Text style={styles.videoGiftName}>{gift.name.toUpperCase()}</Text>
                    </View>
                </Animated.View>
            </Animated.View>
        );
    }

    // --- RENDER FOR STANDARD GIFTS (Lottie & particles) ---
    return (
        <Animated.View style={[styles.container, backdropStyle]} pointerEvents="box-none">
            <View style={styles.backdropSolid} />

            <View style={styles.content}>
                <LottieView
                    source={CONFETTI_LOTTIE}
                    autoPlay
                    loop
                    style={styles.fullLottie}
                    resizeMode="cover"
                />

                <View style={styles.centerStage}>
                    {particles}
                    <Animated.View style={[styles.glowRing, glowStyle]} />
                    
                    <Animated.View style={[styles.logoContainer, logoStyle]}>
                        <View style={styles.glow} />
                        <Image
                            source={gift.image || require('../../assets/gift_icon.webp')}
                            style={styles.mainLogo}
                            resizeMode="contain"
                        />
                    </Animated.View>

                    <Animated.View style={[styles.receiverBadge, textStyle]}>
                        <Text style={styles.receiverText}>{(receiver.display_name || receiver.username).toUpperCase()}</Text>
                    </Animated.View>
                </View>

                <Animated.View style={[styles.textWrapper, textStyle]}>
                    <Text style={styles.headerText}>HEDİYE GÖNDERİLDİ!</Text>
                    <View style={styles.giftBadge}>
                        <Text style={styles.giftName}>{gift.name.toUpperCase()}</Text>
                    </View>
                </Animated.View>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 99999,
        justifyContent: 'flex-end', // Align premium contents towards the bottom
        alignItems: 'center',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.55)', // Dim background to make the animation pop
        zIndex: 1,
    },
    backdropSolid: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(11, 15, 25, 0.94)',
        zIndex: 1,
    },
    content: {
        flex: 1,
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2,
    },
    fullLottie: {
        ...StyleSheet.absoluteFillObject,
        width: width,
        height: height,
        zIndex: 1,
    },
    centerStage: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 300,
        height: 300,
        zIndex: 10,
    },
    logoContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        perspective: 1000,
    },
    glow: {
        position: 'absolute',
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: 'rgba(251, 191, 36, 0.2)',
        shadowColor: '#fbbf24',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 40,
        elevation: 10,
    },
    glowRing: {
        position: 'absolute',
        width: 280,
        height: 280,
        borderRadius: 140,
        borderWidth: 2,
        borderColor: 'rgba(251, 191, 36, 0.3)',
    },
    particle: {
        position: 'absolute',
        width: 6,
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
    },
    mainLogo: {
        width: 160,
        height: 160,
    },
    receiverBadge: {
        backgroundColor: '#1e293b',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 25,
        borderWidth: 1.5,
        borderColor: '#fbbf24',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
    },
    receiverText: {
        color: '#fbbf24',
        fontWeight: '950',
        fontSize: 16,
        letterSpacing: 1,
        textAlign: 'center',
    },
    textWrapper: {
        marginTop: 60,
        alignItems: 'center',
        zIndex: 10,
    },
    headerText: {
        color: 'white',
        fontSize: 32,
        fontWeight: '950',
        letterSpacing: 1,
        textShadowColor: 'rgba(251, 191, 36, 0.6)',
        textShadowOffset: { width: 0, height: 4 },
        textShadowRadius: 20,
    },
    giftBadge: {
        marginTop: 15,
        paddingHorizontal: 25,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: 'rgba(251, 191, 36, 0.1)',
        borderWidth: 1.5,
        borderColor: 'rgba(251, 191, 36, 0.5)',
    },
    giftName: {
        color: '#fbbf24',
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 2,
    },
    // Premium Video bottom fullscreen placement styles
    premiumVideoWrapper: {
        position: 'absolute',
        bottom: -140, // Offset the scaled transparent space at the bottom of the WebP file
        left: -width * 0.1, // Center the wider component horizontally
        width: width * 1.2, // Make it 20% wider
        height: width * 1.7, // Make it taller proportionally
        zIndex: 2,
        backgroundColor: 'transparent',
        justifyContent: 'flex-end',
        alignItems: 'center',
    },
    premiumVideoPlayer: {
        width: width * 1.2,
        height: width * 1.7,
        backgroundColor: 'transparent',
    },
    topMask: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 40,
        zIndex: 3,
    },
    bottomMask: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 40,
        zIndex: 3,
    },
    leftMask: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        width: 40,
        zIndex: 3,
    },
    rightMask: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        right: 0,
        width: 40,
        zIndex: 3,
    },
    videoOverlay: {
        position: 'absolute',
        top: 80, // Float beautifully at the top of the screen
        width: '100%',
        alignItems: 'center',
        zIndex: 10,
    },
    videoHeaderText: {
        color: 'white',
        fontSize: 22,
        fontWeight: '950',
        letterSpacing: 1.5,
        marginTop: 10,
        textShadowColor: '#fbbf24',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 10,
    },
    videoGiftBadge: {
        marginTop: 10,
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 18,
        backgroundColor: 'rgba(251, 191, 36, 0.15)',
        borderWidth: 1.5,
        borderColor: '#fbbf24',
    },
    videoGiftName: {
        color: '#fbbf24',
        fontSize: 15,
        fontWeight: '900',
        letterSpacing: 2,
    },
    premiumLoadingContainer: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        width: width,
        height: height,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(11, 15, 25, 0.4)',
        zIndex: 5,
    },
    loadingText: {
        color: '#fbbf24',
        marginTop: 10,
        fontWeight: 'bold',
        fontSize: 16,
    }
});
