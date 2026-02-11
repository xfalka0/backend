import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeOut, SlideInDown } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

export default function ModernAlert({
    visible,
    title,
    message,
    onClose,
    type = 'info',
    showCancel = false,
    cancelText = 'İPTAL',
    confirmText = 'TAMAM',
    onConfirm,
    onCancel
}) {
    if (!visible) return null;

    const handleConfirm = () => {
        if (onConfirm) onConfirm();
        onClose();
    };

    const handleCancel = () => {
        if (onCancel) onCancel();
        onClose();
    };

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View
                style={styles.overlay}
            >
                <TouchableOpacity
                    style={StyleSheet.absoluteFill}
                    activeOpacity={1}
                    onPress={onClose}
                />

                <Animated.View
                    entering={SlideInDown.springify().damping(15)}
                    style={styles.alertContainer}
                >
                    <View style={styles.content}>
                        <Text style={styles.title}>{title}</Text>
                        <Text style={styles.message}>{message}</Text>

                        <View style={styles.buttonContainer}>
                            {showCancel && (
                                <TouchableOpacity onPress={handleCancel} style={[styles.button, styles.cancelButton]}>
                                    <Text style={styles.cancelButtonText}>{cancelText}</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity onPress={handleConfirm} style={[styles.button, showCancel && { flex: 1 }]}>
                                <LinearGradient
                                    colors={['#8b5cf6', '#ec4899']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.buttonGradient}
                                >
                                    <Text style={styles.buttonText}>{confirmText}</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30,
    },
    alertContainer: {
        width: width - 80,
        maxWidth: 340,
        backgroundColor: '#1e293b',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(139, 92, 246, 0.2)',
        overflow: 'hidden',
    },
    content: {
        padding: 24,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: 'white',
        marginBottom: 8,
        textAlign: 'center',
    },
    message: {
        fontSize: 15,
        color: 'rgba(255, 255, 255, 0.7)',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 20,
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: 12,
    },
    button: {
        borderRadius: 12,
        overflow: 'hidden',
        flex: 1,
    },
    cancelButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cancelButtonText: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 14,
        fontWeight: '600',
    },
    buttonGradient: {
        paddingVertical: 14,
        alignItems: 'center',
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
});
