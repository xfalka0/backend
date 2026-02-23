import React, { createContext, useContext, useState, useEffect } from 'react';
import { Dimensions, StyleSheet, View, TouchableOpacity, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS, Easing } from 'react-native-reanimated';
import { DARK_THEME, LIGHT_THEME } from '../theme';

const { width, height } = Dimensions.get('window');
const RADIUS = Math.sqrt(width * width + height * height);

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    const [themeMode, setThemeMode] = useState('dark'); // Default to dark

    // Ripple State
    const [rippleConfig, setRippleConfig] = useState(null);
    const rippleScale = useSharedValue(0);
    const rippleOpacity = useSharedValue(0);

    useEffect(() => {
        loadTheme();
    }, []);

    const loadTheme = async () => {
        try {
            const savedTheme = await AsyncStorage.getItem('theme_mode');
            if (savedTheme) {
                setThemeMode(savedTheme);
            }
        } catch (error) {
            console.error('Failed to load theme:', error);
        }
    };

    const toggleTheme = async () => {
        // Centered ripple since Switch doesn't easily provide coordinates
        const x = width / 2;
        const y = height / 2;

        const nextMode = themeMode === 'dark' ? 'light' : 'dark';
        const nextTheme = nextMode === 'dark' ? DARK_THEME : LIGHT_THEME;

        // Save immediately but update state after ripple covers the screen
        try {
            await AsyncStorage.setItem('theme_mode', nextMode);
        } catch (error) {
            console.error('Failed to save theme:', error);
        }

        // Start Ripple
        setRippleConfig({ x, y, color: nextTheme.colors.background });
        rippleOpacity.value = 1;

        rippleScale.value = withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }, () => {
            runOnJS(setThemeMode)(nextMode);

            // Fade out the overlay smoothly
            rippleOpacity.value = withTiming(0, { duration: 400 }, () => {
                rippleScale.value = 0;
                runOnJS(setRippleConfig)(null);
            });
        });
    };

    const setTheme = async (mode) => {
        setThemeMode(mode);
        try {
            await AsyncStorage.setItem('theme_mode', mode);
        } catch (error) {
            console.error('Failed to set theme:', error);
        }
    };

    const theme = themeMode === 'dark' ? DARK_THEME : LIGHT_THEME;

    const animatedRippleStyle = useAnimatedStyle(() => {
        if (!rippleConfig) return {};
        return {
            transform: [{ scale: rippleScale.value }],
            opacity: rippleOpacity.value,
        };
    });

    return (
        <ThemeContext.Provider value={{ theme, themeMode, toggleTheme, setTheme }}>
            {children}
            {rippleConfig && (
                <Animated.View
                    pointerEvents="none"
                    style={[
                        StyleSheet.absoluteFill,
                        {
                            backgroundColor: rippleConfig.color,
                            borderRadius: RADIUS,
                            width: RADIUS * 2,
                            height: RADIUS * 2,
                            left: rippleConfig.x - RADIUS,
                            top: rippleConfig.y - RADIUS,
                            zIndex: 999999,
                        },
                        animatedRippleStyle
                    ]}
                />
            )}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
