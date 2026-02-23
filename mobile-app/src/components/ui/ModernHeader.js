import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../contexts/ThemeContext';

const ModernHeader = ({
    title,
    onBack,
    rightIcon,
    onRightPress,
    showBlur = true,
    transparent = false
}) => {
    const insets = useSafeAreaInsets();
    const { theme, themeMode } = useTheme();

    const Container = showBlur ? BlurView : View;
    const containerProps = showBlur ? { intensity: 80, tint: themeMode === 'dark' ? 'dark' : 'light' } : {};

    return (
        <View style={[
            styles.wrapper,
            { paddingTop: insets.top },
            transparent && styles.transparent
        ]}>
            <Container {...containerProps} style={styles.container}>
                <View style={styles.content}>
                    {onBack ? (
                        <TouchableOpacity onPress={onBack} style={styles.backButton}>
                            <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.spacer} />
                    )}

                    <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={1}>
                        {title}
                    </Text>

                    {rightIcon ? (
                        <TouchableOpacity onPress={onRightPress} style={styles.rightButton}>
                            <Ionicons name={rightIcon} size={24} color={theme.colors.text} />
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.spacer} />
                    )}
                </View>
                {!transparent && <View style={[styles.border, { backgroundColor: theme.colors.glassBorder }]} />}
            </Container>
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
    },
    transparent: {
        backgroundColor: 'transparent',
    },
    container: {
        width: '100%',
    },
    content: {
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: '900',
        textAlign: 'center',
        flex: 1,
        letterSpacing: -0.5,
    },
    backButton: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rightButton: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    spacer: {
        width: 44,
    },
    border: {
        height: 1,
        width: '100%',
        opacity: 0.5,
    }
});

export default ModernHeader;
