import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { STORE_THEME } from '../../constants/storeTheme';

export default function PremiumSuccessModal({ visible, onClose, planMonths }) {
    const scaleAnim = useRef(new Animated.Value(0.5)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            // Reset
            scaleAnim.setValue(0.5);
            opacityAnim.setValue(0);
            rotateAnim.setValue(0);

            // Pop in
            Animated.parallel([
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    friction: 5,
                    tension: 40,
                    useNativeDriver: true
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 400,
                    useNativeDriver: true
                }),
                Animated.loop(
                    Animated.timing(rotateAnim, {
                        toValue: 1,
                        duration: 8000,
                        easing: Easing.linear,
                        useNativeDriver: true
                    })
                )
            ]).start();
        }
    }, [visible]);

    if (!visible) return null;

    const spin = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg']
    });

    return (
        <Modal transparent visible={visible} animationType="fade" statusBarTranslucent>
            <View style={styles.container}>
                <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />

                <Animated.View style={[styles.modalContent, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
                    {/* Glowing Background Effect behind the crown */}
                    <View style={styles.glowContainer}>
                        <Animated.View style={[styles.glowRing, { transform: [{ rotate: spin }] }]} />
                        <LinearGradient
                            colors={['#FACC15', '#EAB308']}
                            style={styles.crownCircle}
                        >
                            <Ionicons name="diamond" size={48} color="#FFFFFF" />
                        </LinearGradient>
                    </View>

                    <Text style={styles.title}>Tebrikler! 👑</Text>
                    
                    <Text style={styles.message}>
                        <Text style={{ fontWeight: 'bold', color: '#FACC15' }}>{planMonths} Aylık Premium</Text> paketiniz başarıyla aktifleştirildi.
                    </Text>

                    <Text style={styles.subMessage}>
                        Artık tüm sınırları kaldırdınız. Görüntülü aramalar, konum gönderme ve VIP ayrıcalıklarının tadını çıkarın!
                    </Text>

                    <TouchableOpacity activeOpacity={0.8} style={styles.buttonContainer} onPress={onClose}>
                        <LinearGradient
                            colors={STORE_THEME.colors.primaryGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.button}
                        >
                            <Text style={styles.buttonText}>Ayrıcalıkları Keşfet</Text>
                            <Ionicons name="arrow-forward" size={20} color="#FFF" style={{ marginLeft: 8 }} />
                        </LinearGradient>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)'
    },
    modalContent: {
        width: '85%',
        backgroundColor: '#1E1B24',
        borderRadius: 28,
        padding: 32,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(250, 204, 21, 0.2)',
        shadowColor: '#FACC15',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 10
    },
    glowContainer: {
        width: 120,
        height: 120,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    glowRing: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 2,
        borderColor: 'rgba(250, 204, 21, 0.3)',
        borderStyle: 'dashed',
    },
    crownCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#FACC15',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.6,
        shadowRadius: 12,
        elevation: 8,
    },
    title: {
        fontSize: 28,
        fontWeight: '900',
        color: '#FFFFFF',
        marginBottom: 12,
        textAlign: 'center',
        letterSpacing: 0.5,
    },
    message: {
        fontSize: 16,
        color: '#E2E8F0',
        textAlign: 'center',
        marginBottom: 12,
        lineHeight: 24,
    },
    subMessage: {
        fontSize: 13,
        color: '#94A3B8',
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 20,
    },
    buttonContainer: {
        width: '100%',
        borderRadius: 16,
        overflow: 'hidden',
    },
    button: {
        flexDirection: 'row',
        paddingVertical: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    }
});
