import React, { useState, useEffect } from 'react';
import { View, TextInput, StyleSheet, Animated as RNAnimated, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
    interpolateColor,
    interpolate
} from 'react-native-reanimated';

export default function GlassInput({
    label,
    value,
    onChangeText,
    secureTextEntry,
    autoCapitalize = 'none',
    keyboardType = 'default'
}) {
    const [isFocused, setIsFocused] = useState(false);
    const focusAnim = useSharedValue(0);

    const labelAnim = useSharedValue(value ? 1 : 0);

    useEffect(() => {
        focusAnim.value = withTiming(isFocused ? 1 : 0, { duration: 200 });
        if (!value) {
            labelAnim.value = withTiming(isFocused ? 1 : 0, { duration: 200 });
        }
    }, [isFocused]);

    const containerStyle = useAnimatedStyle(() => {
        return {
            borderColor: interpolateColor(
                focusAnim.value,
                [0, 1],
                ['rgba(255, 255, 255, 0.2)', 'rgba(139, 92, 246, 0.8)']
            ),
            backgroundColor: 'transparent',
            shadowOpacity: interpolate(focusAnim.value, [0, 1], [0, 0.3]),
            shadowRadius: interpolate(focusAnim.value, [0, 1], [0, 10]),
        };
    });

    const labelStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { translateY: interpolate(labelAnim.value, [0, 1], [0, -14]) },
                { translateX: interpolate(labelAnim.value, [0, 1], [0, -15]) }, // Keeps label at the start
                { scale: interpolate(labelAnim.value, [0, 1], [1, 0.82]) }
            ],
            color: interpolateColor(
                labelAnim.value,
                [0, 1],
                ['rgba(255, 255, 255, 0.5)', 'rgba(255, 255, 255, 0.9)']
            )
        };
    });

    return (
        <View style={styles.outerContainer} >
            <Animated.View style={[styles.container, containerStyle]}>
                <BlurView intensity={20} style={styles.blur} tint="dark">
                    <View style={styles.labelWrapper}>
                        <Animated.Text style={[styles.label, labelStyle]}>
                            {label}
                        </Animated.Text>
                    </View>
                    <TextInput
                        style={styles.input}
                        value={value}
                        onChangeText={onChangeText}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        secureTextEntry={secureTextEntry}
                        autoCapitalize={autoCapitalize}
                        keyboardType={keyboardType}
                        placeholderTextColor="transparent"
                        underlineColorAndroid="transparent"
                    />
                </BlurView>
            </Animated.View>
        </View >
    );
}

const styles = StyleSheet.create({
    outerContainer: {
        marginBottom: 24,
    },
    container: {
        height: 60,
        borderRadius: 16,
        borderWidth: 1,
        overflow: 'hidden',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        ...Platform.select({
            ios: {
                shadowColor: '#8b5cf6',
                shadowOffset: { width: 0, height: 4 },
            },
            android: {
                elevation: 0,
            },
        }),
    },
    blur: {
        flex: 1,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
    },
    labelWrapper: {
        position: 'absolute',
        left: 16,
        top: 0,
        bottom: 0,
        justifyContent: 'center',
    },
    label: {
        fontSize: 16,
        fontWeight: '500',
    },
    input: {
        flex: 1,
        color: 'white',
        fontSize: 16,
        height: '100%',
        paddingTop: 12, // Reduced padding for better vertical balance
        backgroundColor: 'transparent',
    },
});
