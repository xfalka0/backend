import React from 'react';
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

const VoiceCallScreen = ({ route, navigation }) => {
    const { name, avatar_url } = route.params || {};
    const callerName = name || 'Biri';
    const callerImage = avatar_url || 'https://via.placeholder.com/150';

    const overlayOpacity = useSharedValue(0);
    const scale = useSharedValue(0.9);
    const ringScale = useSharedValue(1);

    React.useEffect(() => {
        overlayOpacity.value = withTiming(1, { duration: 800 });
        scale.value = withSpring(1, { damping: 12 });
        ringScale.value = withRepeat(withTiming(1.5, { duration: 2000 }), -1, true);
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: overlayOpacity.value,
        transform: [{ scale: scale.value }],
    }));

    const ringStyle = useAnimatedStyle(() => ({
        transform: [{ scale: ringScale.value }],
        opacity: interpolate(ringScale.value, [1, 1.5], [0.6, 0]),
    }));

    const handleDecline = () => {
        navigation.goBack();
    };

    return (
        <View style={styles.container}>
            {/* Background with Blur */}
            <Image source={{ uri: callerImage }} style={StyleSheet.absoluteFill} blurRadius={20} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(15, 23, 42, 0.8)' }]} />

            <Animated.View style={[styles.content, animatedStyle]}>
                <View style={styles.topSection}>
                    <View style={styles.avatarWrapper}>
                        <Animated.View style={[styles.ring, ringStyle]} />
                        <View style={styles.avatarContainer}>
                            <Image source={{ uri: callerImage }} style={styles.avatar} />
                        </View>
                    </View>
                    <Text style={styles.callerName}>{callerName}</Text>
                    <Text style={styles.status}>Yakında Gelecek 🎧</Text>
                    <Text style={{
                        color: 'rgba(255,255,255,0.6)',
                        textAlign: 'center',
                        paddingHorizontal: 40,
                        marginTop: 15,
                        fontSize: 14,
                        lineHeight: 20
                    }}>
                        Sesli arama özelliği geliştirme aşamasındadır. Takipte kalın!
                    </Text>
                </View>

                <View style={[styles.middleSection, { marginTop: 40 }]}>
                    <View style={styles.micIconContainer}>
                        <LinearGradient
                            colors={['#8B5CF6', '#6366f1']}
                            style={styles.micGradient}
                        >
                            <Ionicons name="mic" size={40} color="white" />
                        </LinearGradient>
                    </View>
                </View>

                <View style={styles.controls}>
                    <TouchableOpacity onPress={handleDecline} style={[styles.button, styles.decline, { width: 160, borderRadius: 20, flexDirection: 'row', gap: 10, height: 56 }]}>
                        <Ionicons name="arrow-back" size={24} color="white" />
                        <Text style={styles.buttonText}>Geri Dön</Text>
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
    avatarWrapper: {
        width: 140,
        height: 140,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    avatarContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 4,
        borderColor: 'rgba(255,255,255,0.1)',
        overflow: 'hidden',
        zIndex: 2,
    },
    avatar: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    ring: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 2,
        borderColor: '#8B5CF6',
        zIndex: 1,
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
    middleSection: {
        alignItems: 'center',
    },
    micIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        overflow: 'hidden',
    },
    micGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    controls: {
        flexDirection: 'row',
        gap: 60,
        alignItems: 'center',
    },
    button: {
        alignItems: 'center',
    },
    buttonCircle: {
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
        marginBottom: 10,
    },
    decline: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: '#EF4444',
        justifyContent: 'center',
        alignItems: 'center',
    },
    accept: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonText: {
        color: 'white',
        marginTop: 8,
        fontSize: 14,
        fontWeight: '600',
    }
});

export default VoiceCallScreen;
