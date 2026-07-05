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
        setThemeMode('dark');
        try {
            await AsyncStorage.setItem('theme_mode', 'dark');
        } catch (error) {
            console.error('Failed to load theme:', error);
        }
    };

    const toggleTheme = async () => {
        // Toggle theme is disabled since the app is dark-only
    };

    const setTheme = async (mode) => {
        setThemeMode('dark');
        try {
            await AsyncStorage.setItem('theme_mode', 'dark');
        } catch (error) {
            console.error('Failed to set theme:', error);
        }
    };

    const theme = DARK_THEME;

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
