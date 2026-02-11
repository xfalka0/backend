import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

export default function GlassCard({ children, style }) {
    const { theme } = useTheme();

    return (
        <View style={[
            styles.container,
            {
                backgroundColor: theme.colors.glass,
                borderColor: theme.colors.glassBorder
            },
            style
        ]}>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        borderWidth: 1,
        borderRadius: 24,
        padding: 20,
        overflow: 'hidden',
    }
});
