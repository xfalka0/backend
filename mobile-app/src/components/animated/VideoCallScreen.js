import React, { useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image, Dimensions } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withRepeat,
    withSpring,
    interpolate,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

const VideoCallScreen = ({ callerName, callerImage, onAccept, onDecline }) => {
    const overlayOpacity = useSharedValue(0);
    const scale = useSharedValue(0.9);
    const blurIntensity = useSharedValue(0);

    useEffect(() => {
        overlayOpacity.value = withTiming(1, { duration: 800 });
        scale.value = withSpring(1, { damping: 12 });
        blurIntensity.value = withTiming(20, { duration: 1000 });
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: overlayOpacity.value,
        transform: [{ scale: scale.value }],
    }));

    const blurStyle = useAnimatedStyle(() => ({
        intensity: blurIntensity.value,
    }));

    return (
        <View style={styles.container}>
            {/* Background with Blur */}
            <Image source={{ uri: callerImage }} style={StyleSheet.absoluteFill} blurRadius={10} />
            <Animated.View style={StyleSheet.absoluteFill}>
                <BlurView intensity={30} style={StyleSheet.absoluteFill} tint="dark" />
            </Animated.View>

            <Animated.View style={[styles.content, animatedStyle]}>
                <View style={styles.topSection}>
                    <View style={styles.avatarContainer}>
                        <Image source={{ uri: callerImage }} style={styles.avatar} />
                        <View style={styles.ring} />
                    </View>
                    <Text style={styles.callerName}>{callerName}</Text>
                    <Text style={styles.status}>Yakında Gelecek 🚀</Text>
                    <Text style={{
                        color: 'rgba(255,255,255,0.6)',
                        textAlign: 'center',
                        paddingHorizontal: 40,
                        marginTop: 20,
                        fontSize: 14,
                        lineHeight: 20
                    }}>
                        Görüntülü arama özelliği üzerinde çalışıyoruz. Çok yakında sizlerle!
                    </Text>
                </View>

                <View style={styles.controls}>
                    <TouchableOpacity onPress={onDecline} style={[styles.button, styles.decline, { width: 140, borderRadius: 20, flexDirection: 'row', gap: 10 }]}>
                        <Ionicons name="close-circle-outline" size={24} color="white" />
                        <Text style={{ color: 'white', fontWeight: 'bold' }}>Vazgeç</Text>
                    </TouchableOpacity>
                </View>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F172A',
    },
    content: {
        flex: 1,
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingVertical: 100,
    },
    topSection: {
        alignItems: 'center',
    },
    avatarContainer: {
        width: 150,
        height: 150,
        borderRadius: 75,
        padding: 5,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginBottom: 20,
    },
    avatar: {
        width: '100%',
        height: '100%',
        borderRadius: 75,
    },
    callerName: {
        fontSize: 32,
        fontWeight: '900',
        color: 'white',
        letterSpacing: 1,
    },
    status: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.6)',
        marginTop: 10,
        fontWeight: '600',
    },
    controls: {
        flexDirection: 'row',
        gap: 60,
    },
    button: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
        elevation: 10,
    },
    decline: {
        backgroundColor: '#EF4444',
    },
    accept: {
        backgroundColor: '#10B981',
    },
});

export default VideoCallScreen;
