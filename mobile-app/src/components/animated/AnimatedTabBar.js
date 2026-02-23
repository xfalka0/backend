import React, { useEffect } from 'react';
import { StyleSheet, View, Pressable, Dimensions } from 'react-native';
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
    // 4 tabs + padding calculations
    const tabWidth = (width - 60) / state.routes.length;

    const indicatorPos = useSharedValue(0);

    useEffect(() => {
        indicatorPos.value = withSpring(state.index * tabWidth, {
            damping: 14,
            stiffness: 120,
        });
    }, [state.index]);

    const indicatorStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: indicatorPos.value }],
    }));

    return (
        <View style={styles.container} pointerEvents="box-none">
            <GlassCard style={styles.tabBar} intensity={80} tint="dark" pointerEvents="auto">
                {/* Sliding Indicator */}
                <Animated.View style={[styles.indicatorWrapper, { width: tabWidth }, indicatorStyle]}>
                    <LinearGradient
                        colors={['#8B5CF6', '#EC4899']}
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
                        />
                    );
                })}
            </GlassCard>
        </View>
    );
};

const TabItem = ({ isFocused, onPress, icon }) => {
    const scale = useSharedValue(1);
    const translateY = useSharedValue(0);

    useEffect(() => {
        if (isFocused) {
            scale.value = withSpring(1.2, { damping: 10 });
            translateY.value = withSequence(
                withTiming(-8, { duration: 150, easing: Easing.out(Easing.ease) }),
                withSpring(-4, { damping: 8, stiffness: 200 })
            );
        } else {
            scale.value = withSpring(1, { damping: 10 });
            translateY.value = withSpring(0, { damping: 10 });
        }
    }, [isFocused]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: scale.value },
            { translateY: translateY.value }
        ],
    }));

    return (
        <Pressable onPress={onPress} style={styles.tabItem}>
            <Animated.View style={animatedStyle}>
                <Ionicons
                    name={icon}
                    size={26}
                    color={isFocused ? '#ffffff' : 'rgba(255,255,255,0.4)'}
                />
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
        justifyContent: 'flex-end',
        paddingBottom: 2,
    },
    slidingIndicator: {
        width: 16,
        height: 4,
        borderRadius: 2,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        height: 30,
    },
});

export default AnimatedTab;
