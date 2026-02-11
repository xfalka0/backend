import React from 'react';
import Animated, {
    FadeIn,
    FadeInDown,
    FadeInUp,
    FadeOut,
    SlideInRight,
    SlideInLeft,
    Layout,
    ZoomIn,
    ZoomOut
} from 'react-native-reanimated';

/**
 * Reusable Motion wrappers to maintain consistency across the app.
 */
export const Motion = {
    Fade: ({ children, delay = 0 }) => (
        <Animated.View entering={FadeIn.delay(delay)} exiting={FadeOut}>
            {children}
        </Animated.View>
    ),

    SlideUp: ({ children, delay = 0 }) => (
        <Animated.View entering={FadeInDown.delay(delay).springify()} exiting={FadeOut}>
            {children}
        </Animated.View>
    ),

    SlideDown: ({ children, delay = 0 }) => (
        <Animated.View entering={FadeInUp.delay(delay).springify()} exiting={FadeOut}>
            {children}
        </Animated.View>
    ),

    SlideRight: ({ children, delay = 0 }) => (
        <Animated.View entering={SlideInRight.delay(delay).springify()} exiting={FadeOut}>
            {children}
        </Animated.View>
    ),

    List: ({ children }) => (
        <Animated.View layout={Layout.springify().damping(15)}>
            {children}
        </Animated.View>
    ),

    Bounce: ({ children, visible, delay = 0 }) => {
        if (!visible) return null;
        return (
            <Animated.View
                entering={ZoomIn.delay(delay).springify().damping(12)}
                exiting={ZoomOut.duration(200)}
            >
                {children}
            </Animated.View>
        );
    },
};

export const SpringConfig = {
    damping: 15,
    stiffness: 120,
    mass: 0.8,
};

export const Colors = {
    primary: ['#8B5CF6', '#EC4899'],
    background: '#0F172A',
    card: 'rgba(255, 255, 255, 0.1)',
    glass: 'rgba(255, 255, 255, 0.05)',
};
