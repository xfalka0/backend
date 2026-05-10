import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions, Image, TouchableOpacity, Modal, StatusBar } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    runOnJS,
} from 'react-native-reanimated';
import {
    GestureHandlerRootView,
    Gesture,
    GestureDetector,
} from 'react-native-gesture-handler';

const { width, height } = Dimensions.get('window');

export default function ImageLightbox({ visible, imageUri, onClose }) {
    const scale = useSharedValue(1);
    const savedScale = useSharedValue(1);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const savedTranslateX = useSharedValue(0);
    const savedTranslateY = useSharedValue(0);
    const opacity = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            opacity.value = withTiming(1, { duration: 300 });
            scale.value = withSpring(1);
            translateX.value = 0;
            translateY.value = 0;
        } else {
            opacity.value = withTiming(0, { duration: 250 });
        }
    }, [visible]);

    const pinchGesture = Gesture.Pinch()
        .onUpdate((e) => {
            scale.value = savedScale.value * e.scale;
        })
        .onEnd(() => {
            if (scale.value < 1) {
                scale.value = withSpring(1);
                savedScale.value = 1;
            } else {
                savedScale.value = scale.value;
            }
        });

    const panGesture = Gesture.Pan()
        .onUpdate((e) => {
            if (scale.value > 1) {
                translateX.value = savedTranslateX.value + e.translationX;
                translateY.value = savedTranslateY.value + e.translationY;
            }
        })
        .onEnd(() => {
            savedTranslateX.value = translateX.value;
            savedTranslateY.value = translateY.value;
            
            // Boundary checks could be added here
        });

    const tapGesture = Gesture.Tap()
        .numberOfTaps(2)
        .onEnd(() => {
            if (scale.value > 1) {
                scale.value = withSpring(1);
                translateX.value = withSpring(0);
                translateY.value = withSpring(0);
                savedScale.value = 1;
                savedTranslateX.value = 0;
                savedTranslateY.value = 0;
            } else {
                scale.value = withSpring(2.5);
                savedScale.value = 2.5;
            }
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { scale: scale.value },
        ],
    }));

    const backdropStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    const composed = Gesture.Race(pinchGesture, panGesture, tapGesture);

    if (!visible) return null;

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onClose}
        >
            <StatusBar hidden />
            <GestureHandlerRootView style={{ flex: 1 }}>
                <Animated.View style={[styles.container, backdropStyle]}>
                    <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
                    
                    <TouchableOpacity 
                        style={styles.closeButton} 
                        onPress={onClose}
                        activeOpacity={0.7}
                    >
                        <BlurView intensity={30} tint="light" style={styles.closeBlur}>
                            <Ionicons name="close" size={28} color="#fff" />
                        </BlurView>
                    </TouchableOpacity>

                    <GestureDetector gesture={composed}>
                        <Animated.View style={[styles.imageWrapper, animatedStyle]}>
                            <Image
                                source={{ uri: imageUri }}
                                style={styles.image}
                                resizeMode="contain"
                            />
                        </Animated.View>
                    </GestureDetector>

                    <View style={styles.footer}>
                        <View style={styles.hintContainer}>
                            <Ionicons name="move" size={12} color="rgba(255,255,255,0.5)" />
                            <Text style={styles.hintText}>Yakınlaştırmak için kaydırın</Text>
                        </View>
                    </View>
                </Animated.View>
            </GestureHandlerRootView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeButton: {
        position: 'absolute',
        top: 50,
        right: 25,
        zIndex: 100,
    },
    closeBlur: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    imageWrapper: {
        width: width,
        height: height,
        justifyContent: 'center',
        alignItems: 'center',
    },
    image: {
        width: width,
        height: height * 0.8,
    },
    footer: {
        position: 'absolute',
        bottom: 40,
        width: '100%',
        alignItems: 'center',
    },
    hintContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 6,
    },
    hintText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
        fontWeight: '500',
    }
});
