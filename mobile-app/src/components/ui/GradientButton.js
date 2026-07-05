import React from 'react';
import { Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';

export default function GradientButton({ onPress, title, loading, style, icon, disabled }) {
    const { theme } = useTheme();
    const isDisabled = disabled || loading;

    return (
        <TouchableOpacity 
            onPress={onPress} 
            activeOpacity={0.8} 
            disabled={isDisabled} 
            style={[
                styles.container, 
                isDisabled && styles.disabledContainer,
                style
            ]}
        >
            <LinearGradient
                colors={isDisabled ? ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.06)'] : theme.gradients.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradient}
            >
                {loading ? (
                    <ActivityIndicator color="white" />
                ) : (
                    <>
                        {icon && icon}
                        <Text style={[styles.text, isDisabled && styles.disabledText]}>{title}</Text>
                    </>
                )}
            </LinearGradient>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        height: 56,
        borderRadius: 28,
        shadowColor: '#8b5cf6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    disabledContainer: {
        shadowColor: 'transparent',
        shadowOpacity: 0,
        elevation: 0,
        borderColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
    },
    gradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 28,
        flexDirection: 'row',
        gap: 8
    },
    text: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    disabledText: {
        color: 'rgba(255,255,255,0.25)',
    }
});
