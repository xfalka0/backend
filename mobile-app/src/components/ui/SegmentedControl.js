import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import Animated, {
    useAnimatedStyle,
    withSpring
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');
const CONTAINER_WIDTH = width - 60; // 30px padding on each side

export default function SegmentedControl({ activeIndex, onChange }) {
    const underlineStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { translateX: withSpring(activeIndex === 0 ? 0 : CONTAINER_WIDTH / 2) }
            ]
        };
    });

    return (
        <View style={styles.container}>
            <TouchableOpacity
                style={styles.option}
                onPress={() => onChange(0)}
                activeOpacity={0.7}
            >
                <Text style={[styles.text, activeIndex === 0 && styles.activeText]}>
                    Kayıt Ol
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.option}
                onPress={() => onChange(1)}
                activeOpacity={0.7}
            >
                <Text style={[styles.text, activeIndex === 1 && styles.activeText]}>
                    Giriş Yap
                </Text>
            </TouchableOpacity>

            <Animated.View style={[styles.underline, underlineStyle]} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        width: CONTAINER_WIDTH,
        height: 50,
        marginBottom: 30,
        position: 'relative',
    },
    option: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    text: {
        fontSize: 18,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.4)',
    },
    activeText: {
        color: 'white',
    },
    underline: {
        position: 'absolute',
        bottom: 0,
        height: 3,
        width: CONTAINER_WIDTH / 2,
        backgroundColor: '#8b5cf6',
        borderRadius: 3,
    }
});
