import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DARK_THEME, LIGHT_THEME } from '../theme';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    const [themeMode, setThemeMode] = useState('dark'); // Default to dark

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
        const newMode = themeMode === 'dark' ? 'light' : 'dark';
        setThemeMode(newMode);
        try {
            await AsyncStorage.setItem('theme_mode', newMode);
        } catch (error) {
            console.error('Failed to save theme:', error);
        }
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

    return (
        <ThemeContext.Provider value={{ theme, themeMode, toggleTheme, setTheme }}>
            {children}
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
