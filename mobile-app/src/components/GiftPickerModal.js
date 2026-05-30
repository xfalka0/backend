import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, FlatList, Dimensions, Image, ScrollView, Animated } from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import { GIFTS } from '../constants/gifts';

const { width } = Dimensions.get('window');

export default function GiftPickerModal({ visible, onClose, onSelectGift, userBalance }) {
    const { theme, themeMode } = useTheme();
    const [activeTab, setActiveTab] = useState('Popüler');
    const [selectedGift, setSelectedGift] = useState(null);
    const [quantity, setQuantity] = useState(1);
    const [showQuantityPicker, setShowQuantityPicker] = useState(false);
    const tabs = ['Popüler', 'Etkinlik', 'Özel', 'Bağ'];

    const [pulseAnim] = useState(new Animated.Value(1));

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
        if (selectedGift) {
            onSelectGift(selectedGift, quantity);
            setSelectedGift(null);
            setQuantity(1);
        }
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
                                style={[styles.sendButtonWrap, (!selectedGift || userBalance < totalCost) && { opacity: 0.5 }]}
                                onPress={handleSend}
                                disabled={!selectedGift || userBalance < totalCost}
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
    }
});
