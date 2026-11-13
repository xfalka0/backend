import React from 'react';
import Animated, {
    FadeIn,
    FadeInDown,
    FadeInUp,
    FadeOut,
    SlideInRight,
    Layout,
    ZoomIn,
    ZoomOut
} from 'react-native-reanimated';

import { PERFORMANCE } from '../../config';
import { useMotionPreferences } from '../../utils/useScreenActive';

const useMotionDisabled = () => {
    const { isLowPerf, reducedMotion } = useMotionPreferences();
    return PERFORMANCE.reduceMotion || isLowPerf || reducedMotion;
};

/**
 * Reusable Motion wrappers to maintain consistency across the app.
 */
export const Motion = {
    Fade: ({ children, delay = 0 }) => {
        if (useMotionDisabled()) return <>{children}</>;
        return (
            <Animated.View entering={FadeIn.delay(delay)} exiting={FadeOut}>
                {children}
            </Animated.View>
        );
    },

    SlideUp: ({ children, delay = 0 }) => {
        if (useMotionDisabled()) return <>{children}</>;
        const entering = PERFORMANCE.simpleAnimations 
            ? FadeInDown.delay(delay).duration(400)
            : FadeInDown.delay(delay).springify();
            
        return (
            <Animated.View entering={entering} exiting={FadeOut}>
                {children}
            </Animated.View>
        );
    },

    SlideDown: ({ children, delay = 0 }) => {
        if (useMotionDisabled()) return <>{children}</>;
        const entering = PERFORMANCE.simpleAnimations
            ? FadeInUp.delay(delay).duration(400)
            : FadeInUp.delay(delay).springify();

        return (
            <Animated.View entering={entering} exiting={FadeOut}>
                {children}
            </Animated.View>
        );
    },

    SlideRight: ({ children, delay = 0 }) => {
        if (useMotionDisabled()) return <>{children}</>;
        const entering = PERFORMANCE.simpleAnimations
            ? SlideInRight.delay(delay).duration(400)
            : SlideInRight.delay(delay).springify();

        return (
            <Animated.View entering={entering} exiting={FadeOut}>
                {children}
            </Animated.View>
        );
    },

    List: ({ children }) => {
        if (useMotionDisabled()) return <>{children}</>;
        return (
            <Animated.View layout={PERFORMANCE.simpleAnimations ? Layout.duration(300) : Layout.springify().damping(15)}>
                {children}
            </Animated.View>
        );
    },

    Bounce: ({ children, visible, delay = 0 }) => {
        const disabled = useMotionDisabled();
        if (!visible) return null;
        if (disabled) return <>{children}</>;
        
        const entering = PERFORMANCE.simpleAnimations
            ? ZoomIn.delay(delay).duration(300)
            : ZoomIn.delay(delay).springify().damping(12);

        return (
            <Animated.View
                entering={entering}
                exiting={ZoomOut.duration(200)}
            >
                {children}
            </Animated.View>
        );
    },

    Scale: ({ children, delay = 0 }) => {
        if (useMotionDisabled()) return <>{children}</>;
        
        const entering = PERFORMANCE.simpleAnimations
            ? ZoomIn.delay(delay).duration(300)
            : ZoomIn.delay(delay).springify();

        return (
            <Animated.View
                entering={entering}
                exiting={ZoomOut}
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
