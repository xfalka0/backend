import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, Dimensions } from 'react-native';
import { PanGestureHandler } from 'react-native-gesture-handler';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    useAnimatedGestureHandler,
    withSpring,
    withTiming,
    interpolate,
    Extrapolate,
    runOnJS
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import GlassCard from '../ui/GlassCard';
import * as Haptics from 'expo-haptics';

const { width, height } = Dimensions.get('window');
const SWIPE_THRESHOLD = width * 0.25;

export default function SwipeDeck({ data = [], onSwipeLeft, onSwipeRight, onCardPress }) {
    const [currentIndex, setCurrentIndex] = useState(0);

    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);

    // Reset everything when data changes
    useEffect(() => {
        setCurrentIndex(0);
    }, [data]);

    const handleSwipeComplete = (direction) => {
        const item = data[currentIndex];

        // Notify parent
        if (direction === 'right' && onSwipeRight) {
            onSwipeRight(item);
        } else if (direction === 'left' && onSwipeLeft) {
            onSwipeLeft(item);
        }

        setCurrentIndex(prev => prev + 1);

        // Reset translation silently for the next card
        translateX.value = 0;
        translateY.value = 0;
    };

    const gestureHandler = useAnimatedGestureHandler({
        onStart: (_, ctx) => {
            ctx.startX = translateX.value;
            ctx.startY = translateY.value;
        },
        onActive: (event, ctx) => {
            translateX.value = ctx.startX + event.translationX;
            translateY.value = ctx.startY + event.translationY;
        },
        onEnd: (event) => {
            if (event.translationX > SWIPE_THRESHOLD) {
                // Swipe Right
                translateX.value = withTiming(width + 100, { duration: 250 }, () => {
                    runOnJS(Haptics.notificationAsync)(Haptics.NotificationFeedbackType.Success);
                    runOnJS(handleSwipeComplete)('right');
                });
            } else if (event.translationX < -SWIPE_THRESHOLD) {
                // Swipe Left
                translateX.value = withTiming(-width - 100, { duration: 250 }, () => {
                    runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
                    runOnJS(handleSwipeComplete)('left');
                });
            } else {
                // Reset (Bounce back)
                translateX.value = withSpring(0, { damping: 15 });
                translateY.value = withSpring(0, { damping: 15 });
            }
        },
    });

    const renderCard = (item, index) => {
        const isFirst = index === currentIndex;
        const isSecond = index === currentIndex + 1;
        const zIndex = data.length - index;

        // Sadece ilk 2 kartı render ediyoruz performans için
        if (index < currentIndex || index > currentIndex + 1) return null;

        const animatedCardStyle = useAnimatedStyle(() => {
            if (isFirst) {
                const rotate = interpolate(translateX.value, [-width / 2, width / 2], [-15, 15], Extrapolate.CLAMP);
                return {
                    transform: [
                        { translateX: translateX.value },
                        { translateY: translateY.value },
                        { rotate: `${rotate}deg` }
                    ],
                    zIndex,
                };
            }

            if (isSecond) {
                const scale = interpolate(Math.abs(translateX.value), [0, width / 2], [0.95, 1], Extrapolate.CLAMP);
                const translateYAnim = interpolate(Math.abs(translateX.value), [0, width / 2], [-20, 0], Extrapolate.CLAMP);
                return {
                    transform: [
                        { scale },
                        { translateY: translateYAnim }
                    ],
                    opacity: interpolate(Math.abs(translateX.value), [0, width / 2], [0.8, 1], Extrapolate.CLAMP),
                    zIndex,
                };
            }

            return { zIndex, opacity: 0 };
        });

        // Nope / Like Opacity Styles
        const likeOpacity = useAnimatedStyle(() => {
            return {
                opacity: isFirst ? interpolate(translateX.value, [0, width / 4], [0, 1], Extrapolate.CLAMP) : 0,
            };
        });

        const nopeOpacity = useAnimatedStyle(() => {
            return {
                opacity: isFirst ? interpolate(translateX.value, [0, -width / 4], [0, 1], Extrapolate.CLAMP) : 0,
            };
        });

        const cardContent = (
            <Animated.View style={[styles.card, animatedCardStyle]}>
                <Image source={{ uri: item.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=random&color=fff` }} style={styles.image} />
                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.8)']}
                    style={styles.gradient}
                />
                <View style={styles.infoContainer}>
                    <View style={styles.nameRow}>
                        <Text style={styles.name}>{item.name}</Text>
                        {item.vip_level > 0 && (
                            <View style={styles.vipBadge}>
                                <Ionicons name="star" size={12} color="#fbbf24" />
                            </View>
                        )}
                        {item.is_online && <View style={styles.onlineDot} />}
                    </View>
                    <Text style={styles.jobText}>{item.job || 'Kullanıcı'}</Text>
                </View>

                {/* LIKE Stamp */}
                <Animated.View style={[styles.stampContainer, styles.likeStamp, likeOpacity]}>
                    <Text style={[styles.stampText, styles.likeStampText]}>BEĞEN</Text>
                </Animated.View>

                {/* NOPE Stamp */}
                <Animated.View style={[styles.stampContainer, styles.nopeStamp, nopeOpacity]}>
                    <Text style={[styles.stampText, styles.nopeStampText]}>GEÇ</Text>
                </Animated.View>
            </Animated.View>
        );

        if (isFirst) {
            return (
                <PanGestureHandler key={item.id?.toString() || index.toString()} onGestureEvent={gestureHandler}>
                    <Animated.View style={StyleSheet.absoluteFillObject}>
                        {cardContent}
                    </Animated.View>
                </PanGestureHandler>
            );
        }

        return (
            <View key={item.id?.toString() || index.toString()} style={StyleSheet.absoluteFillObject} pointerEvents="none">
                {cardContent}
            </View>
        );
    };

    if (data.length === 0 || currentIndex >= data.length) {
        return (
            <View style={styles.emptyContainer}>
                <Ionicons name="albums-outline" size={64} color="rgba(255,255,255,0.4)" />
                <Text style={styles.emptyText}>Gösterilecek başka kimse kalmadı.</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.deckContainer}>
                {data.map((item, index) => renderCard(item, index)).reverse()}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    deckContainer: {
        width: width * 0.9,
        height: height * 0.65,
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
    },
    card: {
        width: '100%',
        height: '100%',
        borderRadius: 24,
        position: 'absolute',
        backgroundColor: '#1e293b',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        overflow: 'hidden',
    },
    image: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    gradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '40%',
    },
    infoContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 20,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    name: {
        color: 'white',
        fontSize: 32,
        fontWeight: '900',
        marginRight: 8,
    },
    vipBadge: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        padding: 4,
        borderRadius: 12,
        marginRight: 6,
    },
    onlineDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#10b981',
        borderWidth: 2,
        borderColor: '#1e293b',
    },
    jobText: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: 16,
        fontWeight: '500',
    },
    stampContainer: {
        position: 'absolute',
        top: 50,
        paddingHorizontal: 15,
        paddingVertical: 5,
        borderRadius: 10,
        borderWidth: 4,
        transform: [{ rotate: '-15deg' }],
    },
    stampText: {
        fontSize: 36,
        fontWeight: '900',
        letterSpacing: 2,
    },
    likeStamp: {
        left: 40,
        borderColor: '#10b981',
    },
    likeStampText: {
        color: '#10b981',
    },
    nopeStamp: {
        right: 40,
        borderColor: '#ef4444',
        transform: [{ rotate: '15deg' }],
    },
    nopeStampText: {
        color: '#ef4444',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 16,
        marginTop: 16,
        textAlign: 'center',
    }
});
