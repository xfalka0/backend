import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Dimensions, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';

const { width } = Dimensions.get('window');

export default function InsufficientCoinsModal({ visible, onClose, onBuyCoins }) {
    const [loading, setLoading] = useState(false);
    const [starterPack, setStarterPack] = useState(null);
    const [isEligible, setIsEligible] = useState(false);

    useEffect(() => {
        if (visible) {
            checkEligibility();
        }
    }, [visible]);

    const checkEligibility = async () => {
        setLoading(true);
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) return;

            const res = await axios.get(`${API_URL}/starter-pack/check`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.eligible) {
                setStarterPack(res.data.pack);
                setIsEligible(true);
            } else {
                setIsEligible(false);
            }
        } catch (error) {
            console.error('[StarterPack] Eligibility check failed:', error);
            setIsEligible(false);
        } finally {
            setLoading(false);
        }
    };

    const handleStarterPurchase = async () => {
        setLoading(true);
        try {
            const token = await AsyncStorage.getItem('token');
            // Note: In a real app, this would trigger the actual IAP flow (RevenueCat/Apple/Google)
            // For now, we simulate the backend purchase update
            const res = await axios.post(`${API_URL}/starter-pack/purchase`, {
                transactionId: `starter_${Date.now()}`
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success) {
                Alert.alert("Başarılı!", res.data.message);
                onClose();
            }
        } catch (error) {
            Alert.alert("Hata", "Satın alma işlemi sırasında bir hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    const renderStarterPack = () => (
        <LinearGradient
            colors={['#4c1d95', '#1e1b4b']}
            style={styles.gradient}
        >
            <View style={styles.specialBadge}>
                <Text style={styles.specialBadgeText}>%80 İNDİRİM</Text>
            </View>

            <View style={styles.iconContainerSpecial}>
                <Ionicons name="flash" size={40} color="#fcd34d" />
            </View>

            <Text style={styles.titleSpecial}>Yarım Kalmasın!</Text>
            <Text style={styles.messageSpecial}>
                Sohbetin en heyecanlı yerinde durma! Sadece senin için hazırladığımız bu özel paketi kaçırma.
            </Text>

            <View style={styles.priceContainer}>
                <Text style={styles.oldPrice}>9.99 TL</Text>
                <Text style={styles.newPrice}>2.99 TL</Text>
            </View>

            <View style={styles.coinCountContainer}>
                <Ionicons name="heart" size={24} color="#f43f5e" />
                <Text style={styles.coinCountText}>{starterPack?.coins || 200} Coin</Text>
            </View>

            <TouchableOpacity 
                onPress={handleStarterPurchase} 
                style={{ width: '100%' }}
                disabled={loading}
            >
                <LinearGradient
                    colors={['#f59e0b', '#d97706']}
                    style={styles.buyBtn}
                >
                    {loading ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <>
                            <Ionicons name="rocket" size={20} color="white" style={{ marginRight: 8 }} />
                            <Text style={styles.buyBtnText}>Fırsatı Yakala</Text>
                        </>
                    )}
                </LinearGradient>
            </TouchableOpacity>

            <Text style={styles.limitText}>* Teklif sadece 24 saat geçerlidir ve 1 kez alınabilir.</Text>

            <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Daha sonra</Text>
            </TouchableOpacity>
        </LinearGradient>
    );

    const renderNormalInsufficient = () => (
        <LinearGradient
            colors={['#1e293b', '#0f172a']}
            style={styles.gradient}
        >
            <View style={styles.iconContainer}>
                <Ionicons name="alert-circle" size={50} color="#f59e0b" />
            </View>

            <Text style={styles.title}>Yetersiz Bakiye</Text>
            <Text style={styles.message}>
                Mesaj göndermek için yeterli coininiz bulunmamaktadır. Sohbet etmeye devam etmek için lütfen yükleme yapın.
            </Text>

            <TouchableOpacity onPress={onBuyCoins} style={{ width: '100%' }}>
                <LinearGradient
                    colors={['#f59e0b', '#d97706']}
                    style={styles.buyBtn}
                >
                    <Ionicons name="cart" size={20} color="white" style={{ marginRight: 8 }} />
                    <Text style={styles.buyBtnText}>Coin Yükle</Text>
                </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Vazgeç</Text>
            </TouchableOpacity>
        </LinearGradient>
    );

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={[styles.container, isEligible && styles.containerSpecial]}>
                    {loading && !starterPack ? (
                        <View style={[styles.gradient, { minHeight: 200, justifyContent: 'center' }]}>
                            <ActivityIndicator size="large" color="#f59e0b" />
                        </View>
                    ) : (
                        isEligible ? renderStarterPack() : renderNormalInsufficient()
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    container: {
        width: width * 0.85,
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)'
    },
    containerSpecial: {
        borderColor: '#f59e0b',
        borderWidth: 2,
    },
    gradient: {
        padding: 24,
        alignItems: 'center'
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16
    },
    iconContainerSpecial: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(252, 211, 77, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 2,
        borderColor: '#fcd34d'
    },
    title: {
        color: 'white',
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 10
    },
    titleSpecial: {
        color: 'white',
        fontSize: 24,
        fontWeight: '900',
        marginBottom: 10,
        textAlign: 'center'
    },
    message: {
        color: '#94a3b8',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22
    },
    messageSpecial: {
        color: '#e2e8f0',
        textAlign: 'center',
        marginBottom: 16,
        lineHeight: 20,
        fontSize: 14
    },
    specialBadge: {
        position: 'absolute',
        top: 15,
        right: -30,
        backgroundColor: '#ef4444',
        paddingHorizontal: 40,
        paddingVertical: 5,
        transform: [{ rotate: '45deg' }],
        zIndex: 10
    },
    specialBadgeText: {
        color: 'white',
        fontWeight: '900',
        fontSize: 10
    },
    priceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
        gap: 10
    },
    oldPrice: {
        color: '#94a3b8',
        textDecorationLine: 'line-through',
        fontSize: 18
    },
    newPrice: {
        color: '#fcd34d',
        fontSize: 28,
        fontWeight: '900'
    },
    coinCountContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
        marginBottom: 20,
        gap: 8
    },
    coinCountText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold'
    },
    buyBtn: {
        flexDirection: 'row',
        paddingVertical: 14,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
        width: '100%'
    },
    buyBtnText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold'
    },
    cancelBtn: {
        paddingVertical: 10
    },
    cancelBtnText: {
        color: '#64748b',
        fontSize: 14,
        fontWeight: '600'
    },
    limitText: {
        color: '#64748b',
        fontSize: 10,
        textAlign: 'center',
        fontStyle: 'italic',
        marginBottom: 5
    }
});
