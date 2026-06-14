import React, { useEffect, useRef } from 'react';
import {
    Modal, View, Text, StyleSheet, TouchableOpacity,
    Dimensions, Animated, Switch, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_URL } from '../../config';

const { height } = Dimensions.get('window');

export default function RoomSettingsBottomSheet({ visible, room, isHost, onClose, onCloseRoom, navigation }) {
    const slideAnim = useRef(new Animated.Value(height)).current;

    useEffect(() => {
        if (visible) {
            Animated.spring(slideAnim, {
                toValue: 0, tension: 65, friction: 12, useNativeDriver: true
            }).start();
        } else {
            Animated.timing(slideAnim, {
                toValue: height, duration: 300, useNativeDriver: true
            }).start();
        }
    }, [visible]);

    if (!visible) return null;

    const handleShareRoom = () => {
        onClose();
        Alert.alert('Oda Paylaş', `Oda ID: ${room?.id?.slice?.(0, 8)?.toUpperCase?.()}\nBağlantı kopyalandı.`);
    };

    const handleClearChat = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            await axios.delete(`${API_URL}/rooms/${room?.id}/messages`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            onClose();
        } catch (err) {
            Alert.alert('Hata', 'Sohbet temizlenemedi.');
        }
    };

    const handleClearChatConfirm = () => {
        Alert.alert(
            'Sohbeti Temizle',
            'Tüm mesajları silmek istediğinize emin misiniz?',
            [
                { text: 'Evet', style: 'destructive', onPress: handleClearChat },
                { text: 'Vazgeç', style: 'cancel' },
            ]
        );
    };

    const handleCloseRoomConfirm = () => {
        Alert.alert(
            'Odayı Kapat',
            'Odayı tamamen kapatıp sonlandırmak istiyor musunuz?',
            [
                { text: 'Kapat', style: 'destructive', onPress: () => { onCloseRoom?.(); onClose(); } },
                { text: 'Vazgeç', style: 'cancel' },
            ]
        );
    };

    const MENU_ITEMS = [
        {
            icon: 'share-social-outline',
            label: 'Odayı Paylaş',
            color: '#60a5fa',
            onPress: handleShareRoom,
            hostOnly: false,
        },
        {
            icon: 'people-outline',
            label: 'Üye Listesi',
            color: '#a78bfa',
            onPress: () => { onClose(); },
            hostOnly: false,
        },
        {
            icon: 'chatbubbles-outline',
            label: 'Sohbeti Temizle',
            color: '#fbbf24',
            onPress: handleClearChatConfirm,
            hostOnly: true,
        },
        {
            icon: 'settings-outline',
            label: 'Oda Ayarları',
            color: '#34d399',
            onPress: () => { onClose(); navigation?.navigate?.('CreateRoom', { editRoom: room }); },
            hostOnly: true,
        },
        {
            icon: 'power-outline',
            label: 'Odayı Kapat',
            color: '#ef4444',
            onPress: handleCloseRoomConfirm,
            hostOnly: true,
            danger: true,
        },
    ];

    const visibleItems = MENU_ITEMS.filter(item => !item.hostOnly || isHost);

    return (
        <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
            <View style={styles.backdrop}>
                <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
            </View>
            <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
                <View style={styles.handle} />

                <Text style={styles.title}>Oda Menüsü</Text>
                <Text style={styles.subtitle}>
                    {room?.title || 'Parti Odası'} · ID: {room?.id?.slice?.(0, 6)?.toUpperCase?.()}
                </Text>

                <View style={styles.menuGrid}>
                    {visibleItems.map((item, idx) => (
                        <TouchableOpacity
                            key={idx}
                            style={[styles.menuItem, item.danger && styles.menuItemDanger]}
                            onPress={item.onPress}
                        >
                            <View style={[styles.menuIconBg, { backgroundColor: `${item.color}20` }]}>
                                <Ionicons name={item.icon} size={22} color={item.color} />
                            </View>
                            <Text style={[styles.menuLabel, item.danger && { color: '#ef4444' }]}>
                                {item.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.65)',
    },
    sheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#0f0720',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        paddingBottom: 34,
        paddingHorizontal: 20,
        paddingTop: 8,
    },
    handle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignSelf: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.4)',
        marginBottom: 20,
    },
    menuGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    menuItem: {
        width: '30%',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        gap: 8,
    },
    menuItemDanger: {
        borderColor: 'rgba(239,68,68,0.3)',
        backgroundColor: 'rgba(239,68,68,0.06)',
    },
    menuIconBg: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    menuLabel: {
        fontSize: 11,
        color: '#fff',
        fontWeight: '600',
        textAlign: 'center',
    },
});
