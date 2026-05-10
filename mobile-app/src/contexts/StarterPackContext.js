import React, { createContext, useState, useContext, useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Animated, Easing } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import InsufficientCoinsModal from '../components/InsufficientCoinsModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

const StarterPackContext = createContext();

export const useStarterPack = () => useContext(StarterPackContext);

export const StarterPackProvider = ({ children }) => {
    const [showModal, setShowModal] = useState(false);
    const [showBubble, setShowBubble] = useState(false);
    const pulseAnim = useRef(new Animated.Value(1)).current;

    // Load persisted state on mount
    useEffect(() => {
        const loadState = async () => {
            try {
                const saved = await AsyncStorage.getItem('starter_pack_bubble_visible');
                if (saved === 'true') {
                    setShowBubble(true);
                }
            } catch (e) {
                console.error('[StarterPack] Error loading state:', e);
            }
        };
        loadState();
    }, []);

    // Save state whenever showBubble changes
    useEffect(() => {
        const saveState = async () => {
            try {
                await AsyncStorage.setItem('starter_pack_bubble_visible', showBubble ? 'true' : 'false');
            } catch (e) {
                console.error('[StarterPack] Error saving state:', e);
            }
        };
        saveState();
        
        if (showBubble) {
            let animation = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.15, duration: 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: true })
                ])
            );
            animation.start();
            return () => animation.stop();
        } else {
            pulseAnim.setValue(1);
        }
    }, [showBubble]);

    const openStarterPack = () => {
        setShowModal(true);
        setShowBubble(false);
    };

    const closeStarterPack = () => {
        setShowModal(false);
        setShowBubble(true);
    };

    const completeStarterPack = () => {
        setShowModal(false);
        setShowBubble(false);
    };

    return (
        <StarterPackContext.Provider value={{ openStarterPack, closeStarterPack, completeStarterPack, setShowBubble }}>
            {children}
            
            {/* GLOBAL BUBBLE */}
            {showBubble && (
                <View style={styles.fabContainer} pointerEvents="box-none">
                    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                        <TouchableOpacity
                            style={styles.bubble}
                            onPress={openStarterPack}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={['#f59e0b', '#ea580c']}
                                style={styles.gradient}
                            >
                                <MaterialCommunityIcons 
                                    name="rocket-launch" 
                                    size={24} 
                                    color="#fff" 
                                    style={{
                                        textShadowColor: 'rgba(255, 255, 255, 0.8)',
                                        textShadowOffset: { width: 0, height: 0 },
                                        textShadowRadius: 10,
                                    }}
                                />
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>%80</Text>
                                </View>
                            </LinearGradient>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            )}

            {/* GLOBAL MODAL */}
            <InsufficientCoinsModal
                visible={showModal}
                onClose={closeStarterPack}
                onPurchaseSuccess={completeStarterPack}
                onBuyCoins={() => {
                    setShowModal(false);
                }}
            />
        </StarterPackContext.Provider>
    );
};

const styles = StyleSheet.create({
    fabContainer: {
        position: 'absolute',
        bottom: 150, 
        right: 20,
        zIndex: 9999,
    },
    bubble: {
        width: 52,
        height: 52,
        borderRadius: 26,
        elevation: 12,
        shadowColor: '#ea580c',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.6,
        shadowRadius: 12,
        borderWidth: 2,
        borderColor: 'rgba(251, 191, 36, 0.5)', // Subtle gold border
    },
    gradient: {
        flex: 1,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    badge: {
        position: 'absolute',
        top: -6,
        right: -6,
        backgroundColor: '#ec4899',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: '#fff',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
    },
    badgeText: {
        color: '#fff',
        fontSize: 9,
        fontWeight: '900',
    }
});
