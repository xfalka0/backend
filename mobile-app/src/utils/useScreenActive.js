import { useCallback, useContext, useEffect, useState } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';
import { NavigationContext } from '@react-navigation/native';
import { useReducedMotion } from 'react-native-reanimated';
import { PERFORMANCE } from '../config';
import { useAppStore } from '../store/useAppStore';

/**
 * Live accessibility & performance motion preferences hook.
 * Listens dynamically to OS reduce-motion changes (including while app stays open),
 * re-checks on foreground resume, and combines with user/device performanceMode.
 */
export function useMotionPreferences() {
    const reanimatedReduced = useReducedMotion();
    const performanceMode = useAppStore(state => state.performanceMode);
    const [sysReduceMotion, setSysReduceMotion] = useState(false);

    const refreshReduceMotion = useCallback(() => {
        if (typeof AccessibilityInfo?.isReduceMotionEnabled === 'function') {
            AccessibilityInfo.isReduceMotionEnabled()
                .then(enabled => setSysReduceMotion(!!enabled))
                .catch(() => {});
        }
    }, []);

    useEffect(() => {
        refreshReduceMotion();
        const accessSub = typeof AccessibilityInfo?.addEventListener === 'function'
            ? AccessibilityInfo.addEventListener('reduceMotionChanged', enabled => {
                setSysReduceMotion(!!enabled);
            })
            : null;
        const appSub = AppState.addEventListener('change', nextState => {
            if (nextState === 'active') refreshReduceMotion();
        });
        return () => {
            accessSub?.remove?.();
            appSub?.remove?.();
        };
    }, [refreshReduceMotion]);

    const reducedMotion = Boolean(PERFORMANCE.reduceMotion || reanimatedReduced || sysReduceMotion);
    const isLowPerf = Boolean(reducedMotion || performanceMode === 'low');

    return {
        performanceMode,
        reducedMotion,
        sysReduceMotion,
        isLowPerf,
        refreshReduceMotion,
    };
}

/**
 * Tracks whether the host screen is focused, the app is active in the foreground,
 * and continuous animations are allowed under current performance/accessibility settings.
 * Safe to call even outside a React Navigation screen (defaults to focused).
 */
export function useScreenActive() {
    const navigation = useContext(NavigationContext);
    const {
        performanceMode,
        reducedMotion,
        sysReduceMotion,
        isLowPerf,
        refreshReduceMotion,
    } = useMotionPreferences();

    const [isFocused, setIsFocused] = useState(() => {
        if (navigation && typeof navigation.isFocused === 'function') {
            return navigation.isFocused();
        }
        return true;
    });
    const [isAppActive, setIsAppActive] = useState(() => AppState.currentState === 'active');

    useEffect(() => {
        if (!navigation || typeof navigation.addListener !== 'function') {
            setIsFocused(true);
            return;
        }

        if (typeof navigation.isFocused === 'function') {
            setIsFocused(navigation.isFocused());
        }

        const unsubFocus = navigation.addListener('focus', () => {
            setIsFocused(true);
            refreshReduceMotion();
        });
        const unsubBlur = navigation.addListener('blur', () => setIsFocused(false));

        return () => {
            if (typeof unsubFocus === 'function') unsubFocus();
            if (typeof unsubBlur === 'function') unsubBlur();
        };
    }, [navigation, refreshReduceMotion]);

    useEffect(() => {
        const sub = AppState.addEventListener('change', nextState => {
            setIsAppActive(nextState === 'active');
        });
        return () => sub?.remove?.();
    }, []);

    const isActive = isFocused && isAppActive;

    return {
        isFocused,
        isAppActive,
        isActive,
        performanceMode,
        reducedMotion,
        sysReduceMotion,
        isLowPerf,
        shouldAnimate: isActive && !isLowPerf,
    };
}

