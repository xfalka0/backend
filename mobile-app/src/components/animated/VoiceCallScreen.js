import React, { useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence,
    Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

const WaveformBar = ({ index }) => {
    const height = useSharedValue(10);

    useEffect(() => {
        const delay = index * 100;
        setTimeout(() => {
            height.value = withRepeat(
                withSequence(
                    withTiming(40 + Math.random() * 40, { duration: 400, easing: Easing.inOut(Easing.ease) }),
                    withTiming(10 + Math.random() * 20, { duration: 400, easing: Easing.inOut(Easing.ease) })
                ),
                -1,
                true
            );
        }, delay);
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        height: height.value,
    }));

    return <Animated.View style={[styles.bar, animatedStyle]} />;
};

const VoiceCallScreen = ({ callerName, callerImage, onEndCall }) => {
    return (
        <View style={styles.container}>
            <View style={styles.content}>
                <View style={styles.avatarContainer}>
                    <Image source={{ uri: callerImage }} style={styles.avatar} />
                </View>
                <Text style={styles.callerName}>{callerName}</Text>
                <Text style={styles.status}>Sesli Arama...</Text>

                <View style={styles.waveform}>
                    {[...Array(15)].map((_, i) => (
                        <WaveformBar key={i} index={i} />
                    ))}
                </View>

                <TouchableOpacity onPress={onEndCall} style={styles.endCallButton}>
                    <Ionicons name="call-outline" size={32} color="white" style={{ transform: [{ rotate: '135deg' }] }} />
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F172A',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        alignItems: 'center',
        width: '100%',
    },
    avatarContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 4,
        borderColor: '#EC4899',
        marginBottom: 20,
        overflow: 'hidden',
    },
    avatar: {
        width: '100%',
        height: '100%',
    },
    callerName: {
        fontSize: 28,
        fontWeight: 'bold',
        color: 'white',
    },
    status: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.5)',
        marginTop: 5,
    },
    waveform: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 100,
        gap: 4,
        marginVertical: 40,
    },
    bar: {
        width: 4,
        backgroundColor: '#8B5CF6',
        borderRadius: 2,
    },
    endCallButton: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: '#EF4444',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 20,
    },
});

export default VoiceCallScreen;
