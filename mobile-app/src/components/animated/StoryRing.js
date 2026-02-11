import React, { useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, Image } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

const StoryRing = ({ children, onPress, hasNewStory = true, size = 76 }) => {
    const rotation = useSharedValue(0);

    useEffect(() => {
        if (hasNewStory) {
            rotation.value = withRepeat(
                withTiming(360, {
                    duration: 3000,
                    easing: Easing.linear,
                }),
                -1, // Infinite
                false
            );
        } else {
            rotation.value = 0;
        }
    }, [hasNewStory]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${rotation.value}deg` }],
    }));

    const ringSize = size;
    const innerPadding = 4;
    const innerSize = ringSize - innerPadding;

    return (
        <TouchableOpacity
            onPress={onPress}
            style={[styles.container, { width: size, height: size }]}
            activeOpacity={onPress ? 0.7 : 1}
            disabled={!onPress}
        >
            {hasNewStory ? (
                <>
                    {/* Rotating Gradient Ring */}
                    <Animated.View
                        style={[
                            styles.gradientContainer,
                            animatedStyle,
                            {
                                position: 'absolute',
                                width: ringSize,
                                height: ringSize,
                                borderRadius: ringSize / 2
                            }
                        ]}
                    >
                        <LinearGradient
                            colors={['#8B5CF6', '#EC4899', '#F59E0B']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={{ width: ringSize, height: ringSize, borderRadius: ringSize / 2 }}
                        />
                    </Animated.View>

                    {/* Static Content (Profile Picture) */}
                    <View
                        style={[
                            styles.innerCircle,
                            {
                                width: innerSize,
                                height: innerSize,
                                borderRadius: innerSize / 2,
                                // Center content over the ring
                                position: 'absolute',
                            }
                        ]}
                    >
                        {children}
                    </View>
                </>
            ) : (
                <View style={[styles.staticContainer, { width: ringSize, height: ringSize, borderRadius: ringSize / 2 }]}>
                    {children}
                </View>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    gradientContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    gradient: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    innerCircle: {
        backgroundColor: '#0F172A',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    staticContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default StoryRing;
