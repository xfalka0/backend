import React, { useEffect, useRef } from 'react';
import {
    Modal, View, Text, StyleSheet, FlatList, TouchableOpacity,
    Dimensions, Animated, PanResponder, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useGiftStore } from '../../store/useGiftStore';
import { useAppStore } from '../../store/useAppStore';
import SocketService from '../../services/SocketService';

const { width, height } = Dimensions.get('window');

const GIFT_CATEGORIES = [
    { key: 'all',     label: 'Hepsi' },
    { key: 'basic',   label: 'Temel' },
    { key: 'special', label: 'Özel' },
    { key: 'premium', label: 'Premium' },
    { key: 'luxury',  label: 'Lüks' },
];

export default function GiftPickerBottomSheet({ room }) {
    const {
        isVisible, targetSeat, gifts, selectedCategory,
        isSending, setCategory, closeGiftPicker, sendGift, filteredGifts,
        loadGiftsFromServer,
    } = useGiftStore();
    const { balance, setBalance } = useAppStore();

    const slideAnim = useRef(new Animated.Value(height)).current;
    const backdropOpacity = useRef(new Animated.Value(0)).current;

    // Slide in/out animation
    useEffect(() => {
        if (isVisible) {
            loadGiftsFromServer();
            Animated.parallel([
                Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 12, useNativeDriver: true }),
                Animated.timing(backdropOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(slideAnim, { toValue: height, duration: 300, useNativeDriver: true }),
                Animated.timing(backdropOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
            ]).start();
        }
    }, [isVisible]);

    // Swipe down to close
    const panResponder = useRef(PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 8,
        onPanResponderMove: (_, gestureState) => {
            if (gestureState.dy > 0) slideAnim.setValue(gestureState.dy);
        },
        onPanResponderRelease: (_, gestureState) => {
            if (gestureState.dy > 100) {
                closeGiftPicker();
            } else {
                Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 12, useNativeDriver: true }).start();
            }
        },
    })).current;

    const handleGiftPress = async (gift) => {
        const result = await sendGift(gift, balance, setBalance, SocketService, room);
        if (!result.success && result.error === 'insufficient_balance') {
            // Could dispatch navigation to shop – let parent handle via alert
        }
    };

    const displayed = filteredGifts();

    if (!isVisible) return null;

    return (
        <Modal transparent visible={isVisible} animationType="none" onRequestClose={closeGiftPicker}>
            {/* Backdrop */}
            <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
                <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeGiftPicker} />
            </Animated.View>

            <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
                {/* Drag Handle */}
                <View {...panResponder.panHandlers} style={styles.dragHandleArea}>
                    <View style={styles.dragHandle} />
                </View>

                {/* Header */}
                <View style={styles.sheetHeader}>
                    <View>
                        <Text style={styles.sheetTitle}>Hediye Gönder</Text>
                        {targetSeat?.user_id && (
                            <Text style={styles.sheetSubtitle}>
                                → {targetSeat.display_name || targetSeat.username}
                            </Text>
                        )}
                    </View>
                    <View style={styles.balanceBadge}>
                        <Text style={styles.balanceIcon}>🪙</Text>
                        <Text style={styles.balanceValue}>{balance?.toLocaleString?.() ?? balance}</Text>
                    </View>
                </View>

                {/* Category Tabs */}
                <View style={styles.categoryRow}>
                    {GIFT_CATEGORIES.map(cat => {
                        const isSelected = selectedCategory === cat.key;
                        return (
                            <TouchableOpacity
                                key={cat.key}
                                style={[styles.catTab, isSelected && styles.catTabActive]}
                                onPress={() => setCategory(cat.key)}
                            >
                                <Text style={[styles.catTabText, isSelected && styles.catTabTextActive]}>
                                    {cat.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Gift Grid */}
                <FlatList
                    data={displayed}
                    keyExtractor={item => item.id.toString()}
                    numColumns={4}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.giftGrid}
                    renderItem={({ item }) => {
                        const canAfford = balance >= item.cost;
                        return (
                            <TouchableOpacity
                                style={[styles.giftCell, !canAfford && styles.giftCellDisabled]}
                                onPress={() => handleGiftPress(item)}
                                disabled={isSending || !canAfford}
                                activeOpacity={0.75}
                            >
                                <View style={styles.giftEmojiBox}>
                                    <Text style={styles.giftEmoji}>{item.icon}</Text>
                                </View>
                                <Text style={styles.giftName} numberOfLines={1}>{item.name}</Text>
                                <LinearGradient
                                    colors={canAfford ? ['#fbbf24', '#f59e0b'] : ['#4b5563', '#374151']}
                                    style={styles.giftCostBadge}
                                >
                                    <Text style={styles.giftCostText}>🪙 {item.cost >= 1000 ? `${(item.cost / 1000).toFixed(item.cost % 1000 === 0 ? 0 : 1)}K` : item.cost}</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        );
                    }}
                />

                {isSending && (
                    <View style={styles.sendingOverlay}>
                        <ActivityIndicator color="#ec4899" size="small" />
                        <Text style={styles.sendingText}>Gönderiliyor...</Text>
                    </View>
                )}
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
        paddingBottom: 30,
        maxHeight: height * 0.65,
    },
    dragHandleArea: {
        alignItems: 'center',
        paddingTop: 10,
        paddingBottom: 6,
    },
    dragHandle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    sheetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 12,
    },
    sheetTitle: {
        fontSize: 17,
        fontWeight: 'bold',
        color: '#fff',
    },
    sheetSubtitle: {
        fontSize: 12,
        color: '#ec4899',
        marginTop: 2,
    },
    balanceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(251, 191, 36, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(251, 191, 36, 0.3)',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 5,
        gap: 4,
    },
    balanceIcon: { fontSize: 14 },
    balanceValue: {
        fontSize: 14,
        color: '#fbbf24',
        fontWeight: 'bold',
    },
    categoryRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        gap: 8,
        marginBottom: 10,
    },
    catTab: {
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    catTabActive: {
        backgroundColor: 'rgba(236, 72, 153, 0.25)',
        borderColor: '#ec4899',
    },
    catTabText: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.5)',
        fontWeight: '600',
    },
    catTabTextActive: {
        color: '#ec4899',
    },
    giftGrid: {
        paddingHorizontal: 12,
        paddingBottom: 10,
    },
    giftCell: {
        width: (width - 24) / 4,
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 4,
    },
    giftCellDisabled: {
        opacity: 0.4,
    },
    giftEmojiBox: {
        width: 52,
        height: 52,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.06)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        marginBottom: 5,
    },
    giftEmoji: {
        fontSize: 28,
    },
    giftName: {
        fontSize: 10,
        color: '#fff',
        fontWeight: '600',
        marginBottom: 4,
        textAlign: 'center',
    },
    giftCostBadge: {
        borderRadius: 10,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    giftCostText: {
        fontSize: 9,
        color: '#fff',
        fontWeight: 'bold',
    },
    sendingOverlay: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    sendingText: {
        color: '#ec4899',
        fontSize: 14,
        fontWeight: '600',
    },
});
