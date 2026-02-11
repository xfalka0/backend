import React from 'react';
import { StyleSheet, View, Text, Image, Dimensions } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    useAnimatedGestureHandler,
    withSpring,
    withTiming,
    runOnJS,
    interpolate,
    Extrapolate,
} from 'react-native-reanimated';
import { PanGestureHandler } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;

const SwipeableCard = ({ profile, onSwipeLeft, onSwipeRight, isTop }) => {
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);

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
            const shouldSwipeRight = translateX.value > SWIPE_THRESHOLD;
            const shouldSwipeLeft = translateX.value < -SWIPE_THRESHOLD;

            if (shouldSwipeRight) {
                translateX.value = withTiming(SCREEN_WIDTH + 100, { duration: 300 });
                translateY.value = withTiming(event.velocityY * 0.2, { duration: 300 });
                runOnJS(onSwipeRight)(profile);
            } else if (shouldSwipeLeft) {
                translateX.value = withTiming(-SCREEN_WIDTH - 100, { duration: 300 });
                translateY.value = withTiming(event.velocityY * 0.2, { duration: 300 });
                runOnJS(onSwipeLeft)(profile);
            } else {
                translateX.value = withSpring(0, { damping: 15 });
                translateY.value = withSpring(0, { damping: 15 });
            }
        },
    });

    const cardStyle = useAnimatedStyle(() => {
        const rotate = interpolate(
            translateX.value,
            [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
            [-15, 0, 15],
            Extrapolate.CLAMP
        );

        const opacity = interpolate(
            Math.abs(translateX.value),
            [0, SWIPE_THRESHOLD],
            [1, 0.5],
            Extrapolate.CLAMP
        );

        return {
            transform: [
                { translateX: translateX.value },
                { translateY: translateY.value },
                { rotate: `${rotate}deg` },
            ],
            opacity,
        };
    });

    const likeOpacityStyle = useAnimatedStyle(() => ({
        opacity: interpolate(
            translateX.value,
            [0, SWIPE_THRESHOLD],
            [0, 1],
            Extrapolate.CLAMP
        ),
    }));

    const nopeOpacityStyle = useAnimatedStyle(() => ({
        opacity: interpolate(
            translateX.value,
            [-SWIPE_THRESHOLD, 0],
            [1, 0],
            Extrapolate.CLAMP
        ),
    }));

    return (
        <PanGestureHandler onGestureEvent={gestureHandler} enabled={isTop}>
            <Animated.View style={[styles.card, cardStyle]}>
                <Image
                    source={{ uri: profile.imageUrl }}
                    style={styles.image}
                    resizeMode="cover"
                />

                {/* Gradient Overlay */}
                <LinearGradient
                    colors={['transparent', 'rgba(0, 0, 0, 0.8)']}
                    style={styles.gradient}
                />

                {/* Like Indicator */}
                <Animated.View style={[styles.likeIndicator, styles.likeRight, likeOpacityStyle]}>
                    <View style={[styles.badge, styles.likeBadge]}>
                        <Ionicons name="heart" size={32} color="#10B981" />
                        <Text style={styles.badgeText}>LIKE</Text>
                    </View>
                </Animated.View>

                {/* Nope Indicator */}
                <Animated.View style={[styles.likeIndicator, styles.likeLeft, nopeOpacityStyle]}>
                    <View style={[styles.badge, styles.nopeBadge]}>
                        <Ionicons name="close" size={32} color="#EF4444" />
                        <Text style={styles.badgeText}>NOPE</Text>
                    </View>
                </Animated.View>

                {/* Profile Info */}
                <View style={styles.info}>
                    <Text style={styles.name}>{profile.name}, {profile.age}</Text>
                    <Text style={styles.bio}>{profile.bio}</Text>
                    <View style={styles.tags}>
                        {profile.interests?.slice(0, 3).map((interest, index) => (
                            <View key={index} style={styles.tag}>
                                <Text style={styles.tagText}>{interest}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            </Animated.View>
        </PanGestureHandler>
    );
};

const styles = StyleSheet.create({
    card: {
        position: 'absolute',
        width: SCREEN_WIDTH - 40,
        height: SCREEN_HEIGHT * 0.7,
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: '#1E293B',
        shadowColor: '#8B5CF6',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.4,
        shadowRadius: 20,
        elevation: 10,
    },
    image: {
        width: '100%',
        height: '100%',
    },
    gradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '50%',
    },
    likeIndicator: {
        position: 'absolute',
        top: 50,
        zIndex: 10,
    },
    likeRight: {
        right: 30,
    },
    likeLeft: {
        left: 30,
    },
    badge: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 16,
        borderWidth: 3,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    likeBadge: {
        borderColor: '#10B981',
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
    },
    nopeBadge: {
        borderColor: '#EF4444',
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
    },
    badgeText: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '900',
        letterSpacing: 2,
    },
    info: {
        position: 'absolute',
        bottom: 30,
        left: 20,
        right: 20,
    },
    name: {
        fontSize: 32,
        fontWeight: '900',
        color: '#fff',
        marginBottom: 8,
    },
    bio: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.8)',
        marginBottom: 16,
    },
    tags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    tag: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(139, 92, 246, 0.3)',
        borderWidth: 1,
        borderColor: 'rgba(139, 92, 246, 0.5)',
    },
    tagText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
});

export default SwipeableCard;
