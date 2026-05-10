import React, { useEffect } from 'react';
import { StyleSheet, View, Text, Image, TouchableOpacity, Dimensions, Platform } from 'react-native';
import Animated, { 
    useSharedValue, 
    useAnimatedStyle, 
    withSpring, 
    withTiming,
    runOnJS 
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';

const { width } = Dimensions.get('window');

export default function InAppNotification({ title, body, icon, onPress, onClose }) {
    const insets = useSafeAreaInsets();
    const { theme, themeMode } = useTheme();
    const translateY = useSharedValue(-100);
    const opacity = useSharedValue(0);

    useEffect(() => {
        translateY.value = withSpring(insets.top > 0 ? insets.top + 10 : 20, {
            damping: 15,
            stiffness: 100
        });
        opacity.value = withTiming(1, { duration: 300 });
    }, [insets.top]);

    const handlePress = () => {
        if (onPress) {
            onPress();
        }
        close();
    };

    const close = () => {
        translateY.value = withTiming(-150, { duration: 300 }, () => {
            runOnJS(onClose)();
        });
        opacity.value = withTiming(0, { duration: 250 });
    };

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
        opacity: opacity.value,
    }));

    return (
        <Animated.View style={[styles.container, animatedStyle]}>
            <TouchableOpacity 
                activeOpacity={0.9} 
                onPress={handlePress}
                style={styles.touchable}
            >
                <BlurView intensity={90} tint={themeMode === 'dark' ? 'dark' : 'light'} style={styles.blurContainer}>
                    <View style={styles.content}>
                        <View style={styles.iconContainer}>
                            {icon ? (
                                <Image source={{ uri: icon }} style={styles.icon} />
                            ) : (
                                <View style={[styles.defaultIcon, { backgroundColor: theme.colors.primary }]}>
                                    <Ionicons name="chatbubble" size={18} color="#fff" />
                                </View>
                            )}
                        </View>
                        <View style={styles.textContainer}>
                            <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={1}>
                                {title}
                            </Text>
                            <Text style={[styles.body, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                                {body}
                            </Text>
                        </View>
                        <TouchableOpacity style={styles.closeBtn} onPress={close}>
                            <Ionicons name="close" size={20} color={theme.colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.indicator} />
                </BlurView>
            </TouchableOpacity>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 20,
        right: 20,
        zIndex: 9999,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.2,
                shadowRadius: 15,
            },
            android: {
                elevation: 10,
            },
        }),
    },
    touchable: {
        borderRadius: 20,
        overflow: 'hidden',
    },
    blurContainer: {
        padding: 12,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        marginRight: 12,
    },
    icon: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    defaultIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    textContainer: {
        flex: 1,
    },
    title: {
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    body: {
        fontSize: 13,
    },
    closeBtn: {
        padding: 4,
        marginLeft: 8,
    },
    indicator: {
        width: 30,
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: 8,
        marginBottom: -4,
    }
});
