import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, FlatList, Dimensions, Image, ScrollView, Animated, Alert } from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import { GIFTS } from '../constants/gifts';

const { width } = Dimensions.get('window');

export default function GiftPickerModal({ visible, onClose, onSelectGift, userBalance, roomUsers, targetSeat }) {
    const { theme, themeMode } = useTheme();
    const [activeTab, setActiveTab] = useState('Popüler');
    const [selectedGift, setSelectedGift] = useState(null);
    const [quantity, setQuantity] = useState(1);
    const [showQuantityPicker, setShowQuantityPicker] = useState(false);
    const [selectedRecipient, setSelectedRecipient] = useState(null);
    const tabs = ['Popüler', 'Etkinlik', 'Özel', 'Bağ'];

    const [pulseAnim] = useState(new Animated.Value(1));

    useEffect(() => {
        if (visible) {
            if (targetSeat && (targetSeat.user_id || targetSeat.id)) {
                const targetId = (targetSeat.user_id || targetSeat.id)?.toString();
                const found = roomUsers?.find(u => u.id?.toString() === targetId);
                setSelectedRecipient(found || {
                    id: targetId,
                    display_name: targetSeat.display_name || targetSeat.username || 'Kullanıcı',
                    avatar_url: targetSeat.avatar_url,
                    seat_number: targetSeat.seat_number
                });
            } else if (roomUsers && roomUsers.length === 1) {
                setSelectedRecipient(roomUsers[0]);
            } else {
                setSelectedRecipient(null);
            }
        }
    }, [visible, targetSeat, roomUsers]);

    useEffect(() => {
        if (selectedGift) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.05,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 800,
                        useNativeDriver: true,
                    })
                ])
            ).start();
        } else {
            pulseAnim.setValue(1);
        }
    }, [selectedGift]);

    const glowOpacity = pulseAnim.interpolate({
        inputRange: [1, 1.05],
        outputRange: [0.3, 1]
    });

    const totalCost = selectedGift ? (selectedGift.price || 0) * quantity : 0;

    const handleSend = () => {
        if (!selectedGift) return;

        if (roomUsers && roomUsers.length > 0 && !selectedRecipient) {
            Alert.alert('Alıcı Seçin', 'Lütfen hediyeyi göndereceğiniz kişiyi alttaki listeden seçin.');
            return;
        }

        onSelectGift(selectedGift, quantity, selectedRecipient);
        setSelectedGift(null);
        setQuantity(1);
        setSelectedRecipient(null);
    };

    const renderItem = ({ item, index }) => {
        const isSelected = selectedGift?.id === item.id;
        
        return (
            <TouchableOpacity
                style={{ width: (width - 20) / 4, padding: 2 }}
                onPress={() => setSelectedGift(item)}
                disabled={userBalance < (item.price || 0)}
                activeOpacity={0.9}
            >
                <View
                    style={[
                        styles.giftItem,
                        isSelected && { backgroundColor: theme.colors.primary + '1A' },
                        userBalance < (item.price || 0) && styles.disabledGift
                    ]}
                >
                    {isSelected && (
                        <Animated.View 
                            style={[
                                StyleSheet.absoluteFill, 
                                { 
                                    borderColor: theme.colors.primary, 
                                    borderWidth: 2, 
                                    borderRadius: 14, 
                                    opacity: glowOpacity,
                                }
                            ]} 
                            pointerEvents="none" 
                        />
                    )}
                    {/* Fake badges matching app theme */}
                    {index % 3 === 1 && (
                        <LinearGradient colors={theme.gradients.primary} style={styles.badgeNew} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                            <Text style={styles.badgeNewText}>YENİ</Text>
                        </LinearGradient>
                    )}
                    {index % 4 === 2 && (
                        <LinearGradient colors={theme.gradients.vip} style={styles.badgeMusic} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                            <Ionicons name="musical-note" size={8} color="#fff" />
                        </LinearGradient>
                    )}

                    <Animated.View style={[styles.iconContainer, isSelected && { transform: [{ scale: pulseAnim }] }]}>
                        <Image
                            source={item.image || require('../assets/gift_icon.webp')}
                            style={styles.giftImage}
                            resizeMode="contain"
                        />
                    </Animated.View>
                    <Text style={[styles.giftName, { color: theme.colors.text }]} numberOfLines={1}>{item.name}</Text>
                    <View style={styles.priceTag}>
                        <FontAwesome5 name="coins" size={10} color={theme.colors.accent} />
                        <Text style={[styles.priceText, { color: theme.colors.accent }]}>{item.price || 0}</Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const isSendDisabled = !selectedGift || userBalance < totalCost || (roomUsers && roomUsers.length > 0 && !selectedRecipient);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
                
                <LinearGradient 
                    colors={themeMode === 'dark' ? theme.gradients.dark : ['#ffffff', '#f8fafc']}
                    style={[styles.container, { borderTopColor: theme.colors.border, borderTopWidth: 1 }]}
                >
                    {/* Header Tabs */}
                    <View style={styles.header}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
                            {tabs.map(tab => (
                                <TouchableOpacity 
                                    key={tab} 
                                    style={styles.tabItem}
                                    onPress={() => setActiveTab(tab)}
                                >
                                    <Text style={[styles.tabText, { color: theme.colors.textSecondary }, activeTab === tab && { color: theme.colors.text, fontWeight: 'bold' }]}>
                                        {tab}
                                    </Text>
                                    {activeTab === tab && <View style={[styles.activeTabIndicator, { backgroundColor: theme.colors.primary }]} />}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <TouchableOpacity onPress={onClose} style={{ padding: 4, marginLeft: 10 }}>
                            <Ionicons name="close" size={26} color={theme.colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Gifts Grid */}
                    <FlatList
                        data={GIFTS}
                        renderItem={renderItem}
                        keyExtractor={item => item.id.toString()}
                        numColumns={4}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                    />

                    {/* Recipient Selection Bar (Mandatory for Voice Rooms) */}
                    {roomUsers && roomUsers.length > 0 && (
                        <View style={styles.recipientContainer}>
                            <View style={styles.recipientHeader}>
                                <Ionicons name="person" size={13} color="#ec4899" />
                                <Text style={styles.recipientHeaderTitle}>HEDİYENİN GÖNDERİLECEĞİ KİŞİ (ZORUNLU)</Text>
                                {!selectedRecipient && (
                                    <Text style={styles.requiredBadge}>* Kişi Seçilmedi</Text>
                                )}
                            </View>

                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recipientScroll}>
                                {roomUsers.map(user => {
                                    const isSelected = selectedRecipient?.id?.toString() === user.id?.toString();
                                    const displayName = user.display_name || user.username || 'Kullanıcı';
                                    const initial = displayName.charAt(0).toUpperCase();

                                    return (
                                        <TouchableOpacity
                                            key={user.id?.toString()}
                                            style={[
                                                styles.recipientItem,
                                                isSelected && styles.recipientItemSelected
                                            ]}
                                            onPress={() => setSelectedRecipient(user)}
                                            activeOpacity={0.8}
                                        >
                                            {user.avatar_url ? (
                                                <Image source={{ uri: user.avatar_url }} style={styles.recipientAvatar} />
                                            ) : (
                                                <View style={styles.recipientAvatarPlaceholder}>
                                                    <Text style={styles.recipientInitial}>{initial}</Text>
                                                </View>
                                            )}

                                            <Text
                                                style={[
                                                    styles.recipientName,
                                                    isSelected && styles.recipientNameSelected
                                                ]}
                                                numberOfLines={1}
                                            >
                                                {displayName}
                                            </Text>

                                            {user.seat_number ? (
                                                <View style={styles.seatPill}>
                                                    <Text style={styles.seatPillText}>#{user.seat_number}</Text>
                                                </View>
                                            ) : (
                                                <View style={[styles.seatPill, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
                                                    <Text style={[styles.seatPillText, { color: 'rgba(255,255,255,0.4)' }]}>Dinleyici</Text>
                                                </View>
                                            )}

                                            {isSelected && (
                                                <View style={styles.selectedCheckCircle}>
                                                    <Ionicons name="checkmark" size={10} color="#fff" />
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    )}

                    {/* Bottom Action Bar */}
                    <View style={[styles.bottomBar, { borderTopColor: theme.colors.border }]}>
                        <TouchableOpacity style={styles.balanceContainer}>
                            <FontAwesome5 name="coins" size={16} color={theme.colors.accent} />
                            <Text style={[styles.balanceValue, { color: theme.colors.text }]}>{userBalance}</Text>
                            <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
                        </TouchableOpacity>

                        <View style={styles.actionsRight}>
                            {/* Quantity Popover */}
                            {showQuantityPicker && (
                                <View style={[styles.quantityPopover, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                                    {[1, 2, 3, 4, 5].map(q => (
                                        <TouchableOpacity 
                                            key={q} 
                                            style={styles.quantityOption}
                                            onPress={() => {
                                                setQuantity(q);
                                                setShowQuantityPicker(false);
                                            }}
                                        >
                                            <Text style={[{ color: theme.colors.text }, quantity === q && { color: theme.colors.primary, fontWeight: 'bold' }]}>{q}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}

                            <TouchableOpacity 
                                style={[styles.quantitySelector, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                                onPress={() => setShowQuantityPicker(!showQuantityPicker)}
                            >
                                <Text style={[styles.quantityText, { color: theme.colors.text }]}>{quantity}</Text>
                                <Ionicons name={showQuantityPicker ? "chevron-up" : "chevron-down"} size={14} color={theme.colors.textSecondary} />
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={[styles.sendButtonWrap, isSendDisabled && { opacity: 0.5 }]}
                                onPress={handleSend}
                            >
                                <LinearGradient
                                    colors={theme.gradients.primary}
                                    style={styles.sendButtonGradient}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                >
                                    <Text style={styles.sendButtonText}>{totalCost > 0 ? `${totalCost} C ` : ''}Gönder</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </LinearGradient>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    container: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        height: '55%',
        paddingTop: 15,
        paddingBottom: 25,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -5 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 10,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        marginBottom: 15,
    },
    tabsScroll: {
        flex: 1,
    },
    tabItem: {
        marginRight: 20,
        alignItems: 'center',
        paddingVertical: 5,
    },
    tabText: {
        fontSize: 15,
        fontWeight: '600',
    },
    activeTabIndicator: {
        width: 12,
        height: 3,
        borderRadius: 2,
        marginTop: 4,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 10,
    },
    headerDivider: {
        width: 1,
        height: 15,
        marginRight: 10,
    },
    backpackText: {
        fontSize: 14,
        fontWeight: '600',
    },
    listContent: {
        paddingHorizontal: 10,
        paddingBottom: 20,
    },
    giftItem: {
        width: '100%',
        alignItems: 'center',
        paddingVertical: 12,
        borderRadius: 14,
        position: 'relative',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    disabledGift: {
        opacity: 0.3,
    },
    badgeNew: {
        position: 'absolute',
        top: 6,
        left: 6,
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 6,
        zIndex: 2,
    },
    badgeNewText: {
        color: '#fff',
        fontSize: 8,
        fontWeight: 'bold',
    },
    badgeMusic: {
        position: 'absolute',
        top: 22,
        left: 6,
        width: 18,
        height: 18,
        borderRadius: 9,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2,
    },
    iconContainer: {
        width: 60,
        height: 60,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    giftImage: {
        width: '100%',
        height: '100%',
    },
    giftName: {
        fontSize: 12,
        marginBottom: 4,
        fontWeight: '500',
    },
    priceTag: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    priceText: {
        fontSize: 11,
        fontWeight: 'bold',
        marginLeft: 4,
    },
    bottomBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
        paddingTop: 12,
        borderTopWidth: 1,
    },
    balanceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16,
    },
    balanceValue: {
        fontWeight: 'bold',
        fontSize: 15,
        marginHorizontal: 8,
    },
    actionsRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    askButton: {
        paddingHorizontal: 16,
        paddingVertical: 9,
        borderRadius: 20,
        marginRight: 10,
        borderWidth: 1,
    },
    askButtonText: {
        fontWeight: 'bold',
        fontSize: 13,
    },
    quantitySelector: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 9,
        borderTopLeftRadius: 20,
        borderBottomLeftRadius: 20,
        marginRight: 1,
        borderWidth: 1,
        borderRightWidth: 0,
        width: 60,
        justifyContent: 'center',
    },
    quantityPopover: {
        position: 'absolute',
        bottom: 50,
        left: 0,
        width: 60,
        borderRadius: 12,
        borderWidth: 1,
        paddingVertical: 5,
        alignItems: 'center',
        zIndex: 100,
    },
    quantityOption: {
        paddingVertical: 8,
        width: '100%',
        alignItems: 'center',
    },
    quantityText: {
        marginRight: 6,
        fontSize: 14,
        fontWeight: '600',
    },
    sendButtonWrap: {
        overflow: 'hidden',
        borderTopRightRadius: 20,
        borderBottomRightRadius: 20,
    },
    sendButtonGradient: {
        paddingHorizontal: 18,
        paddingVertical: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 13,
    },
    recipientContainer: {
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.08)',
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
    },
    recipientHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    recipientHeaderTitle: {
        fontSize: 10.5,
        fontWeight: 'bold',
        color: '#ec4899',
        marginLeft: 5,
        letterSpacing: 0.5,
    },
    requiredBadge: {
        fontSize: 10,
        color: '#ef4444',
        marginLeft: 'auto',
        fontWeight: 'bold',
    },
    recipientScroll: {
        flexDirection: 'row',
    },
    recipientItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.1)',
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 6,
        marginRight: 10,
        position: 'relative',
    },
    recipientItemSelected: {
        borderColor: '#ec4899',
        backgroundColor: 'rgba(236, 72, 153, 0.18)',
    },
    recipientAvatar: {
        width: 26,
        height: 26,
        borderRadius: 13,
        marginRight: 7,
    },
    recipientAvatarPlaceholder: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: '#7b2cff',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 7,
    },
    recipientInitial: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    recipientName: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
        fontWeight: '600',
        maxWidth: 90,
        marginRight: 6,
    },
    recipientNameSelected: {
        color: '#fff',
        fontWeight: 'bold',
    },
    seatPill: {
        backgroundColor: 'rgba(236, 72, 153, 0.3)',
        borderRadius: 8,
        paddingHorizontal: 5,
        paddingVertical: 1.5,
    },
    seatPillText: {
        color: '#ec4899',
        fontSize: 9,
        fontWeight: 'bold',
    },
    selectedCheckCircle: {
        position: 'absolute',
        top: -4,
        right: -4,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#ec4899',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#0f172a',
    }
});
