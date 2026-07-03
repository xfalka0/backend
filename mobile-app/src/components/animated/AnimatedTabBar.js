import React, { useEffect } from 'react';
import { StyleSheet, View, Pressable, Dimensions, Text } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withSequence,
    withTiming,
    Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import GlassCard from '../ui/GlassCard';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

const AnimatedTab = ({ state, descriptors, navigation }) => {
    // Equal-width slots keep the rooms action exactly in the center.
    const tabWidth = (width - 60) / state.routes.length;

    const indicatorPos = useSharedValue(0);

    useEffect(() => {
        indicatorPos.value = withSpring(state.index * tabWidth, {
            damping: 14,
            stiffness: 120,
        });
    }, [state.index]);

    const indicatorStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: indicatorPos.value },
            { translateY: 15 } // Move even further down
        ],
    }));

    return (
        <View style={styles.container} pointerEvents="box-none">
            <GlassCard style={styles.tabBar} intensity={80} tint="dark" pointerEvents="auto">
                {/* Sliding Indicator */}
                <Animated.View style={[styles.indicatorWrapper, { width: tabWidth }, indicatorStyle]}>
                    <LinearGradient
                        colors={['#EC4899', '#FFFFFF']}
                        style={styles.slidingIndicator}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    />
                </Animated.View>

                {state.routes.map((route, index) => {
                    const { options } = descriptors[route.key];
                    const isFocused = state.index === index;

                    const onPress = () => {
                        const event = navigation.emit({
                            type: 'tabPress',
                            target: route.key,
                            canPreventDefault: true,
                        });

                        if (!isFocused && !event.defaultPrevented) {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            navigation.navigate(route.name);
                        }
                    };

                    return (
                        <TabItem
                            key={route.key}
                            isFocused={isFocused}
                            onPress={onPress}
                            icon={options.tabBarIconName || 'home'}
                            isCenter={options.tabBarCenterButton === true}
                        />
                    );
                })}
            </GlassCard>
        </View>
    );
};

import { useChat } from '../../contexts/ChatContext';

const TabItem = ({ isFocused, onPress, icon, isCenter = false }) => {
    const scale = useSharedValue(1);
    const translateY = useSharedValue(0);
    const activeProgress = useSharedValue(isFocused ? 1 : 0);
    const { unreadCount } = useChat();

    useEffect(() => {
        if (isFocused) {
            scale.value = withSpring(1.2, { damping: 10 });
            translateY.value = withSequence(
                withTiming(-8, { duration: 150, easing: Easing.out(Easing.ease) }),
                withSpring(-4, { damping: 8, stiffness: 200 })
            );
            activeProgress.value = withTiming(1, { duration: 250 });
        } else {
            scale.value = withSpring(1, { damping: 10 });
            translateY.value = withSpring(0, { damping: 10 });
            activeProgress.value = withTiming(0, { duration: 250 });
        }
    }, [isFocused]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: scale.value },
            { translateY: translateY.value + (isCenter ? -9 : 0) }
        ],
    }));

    const activeIconStyle = useAnimatedStyle(() => ({
        opacity: activeProgress.value,
    }));

    const inactiveIconStyle = useAnimatedStyle(() => ({
        opacity: 1 - activeProgress.value,
        position: 'absolute',
    }));

    return (
        <Pressable onPress={onPress} style={[styles.tabItem, isCenter && styles.centerTabItem]}>
            <Animated.View style={animatedStyle}>
                {isCenter ? (
                    <LinearGradient
                        colors={isFocused ? ['#A78BFA', '#EC4899'] : ['#6D5AA8', '#9D467B']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.centerButton, isFocused && styles.centerButtonFocused]}
                    >
                        <Ionicons name="mic" size={25} color="#FFFFFF" />
                        <Text style={styles.centerButtonLabel}>Odalar</Text>
                    </LinearGradient>
                ) : (
                    <View style={{ position: 'relative', width: 28, height: 28, justifyContent: 'center', alignItems: 'center' }}>
                        {/* Active state (Solid Pink-White Blend) */}
                        <Animated.View style={activeIconStyle}>
                            <Ionicons name={icon} size={26} color="#FFA3E3" />
                        </Animated.View>
                        {/* Inactive state (Outline, Gray) */}
                        <Animated.View style={inactiveIconStyle}>
                            <Ionicons
                                name={`${icon}-outline`}
                                size={26}
                                color="rgba(255, 255, 255, 0.4)"
                            />
                        </Animated.View>
                        {icon === 'chatbubbles' && unreadCount > 0 && (
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                            </View>
                        )}
                    </View>
                )}
            </Animated.View>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 25,
        left: 20,
        right: 20,
        alignItems: 'center',
        paddingBottom: 5, // For shadow visibility
    },
    tabBar: {
        flexDirection: 'row',
        overflow: 'visible',
        paddingVertical: 18,
        paddingHorizontal: 10,
        borderRadius: 40,
        width: width - 40,
        justifyContent: 'flex-start',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        shadowColor: '#EC4899',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 15,
    },
    indicatorWrapper: {
        position: 'absolute',
        left: 10,
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center', // Center vertically first
    },
    slidingIndicator: {
        width: 12, // Shorten it
        height: 3, // Thinner
        borderRadius: 1.5,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        height: 30,
    },
    centerTabItem: {
        zIndex: 20,
    },
    centerButton: {
        width: 58,
        height: 58,
        borderRadius: 29,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: '#17152B',
        shadowColor: '#EC4899',
        shadowOffset: { width: 0, height: 7 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 12,
    },
    centerButtonFocused: {
        borderColor: 'rgba(255,255,255,0.32)',
    },
    centerButtonLabel: {
        color: '#FFFFFF',
        fontSize: 8,
        lineHeight: 9,
        fontWeight: '800',
        marginTop: 1,
    },
    badge: {
        position: 'absolute',
        right: -8,
        top: -6,
        backgroundColor: '#ef4444',
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#0f172a',
        paddingHorizontal: 2,
        zIndex: 10,
    },
    badgeText: {
        color: 'white',
        fontSize: 9,
        fontWeight: '900',
    },
});

export default AnimatedTab;
