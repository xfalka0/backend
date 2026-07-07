import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, SafeAreaView, Dimensions, StatusBar, Platform, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { API_URL } from '../config';
import { useTheme } from '../contexts/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Motion } from '../components/motion/MotionSystem';
import VipFrame from '../components/ui/VipFrame';

const { width } = Dimensions.get('window');

export default function BagScreen({ navigation }) {
    const { theme, themeMode } = useTheme();
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState([]);

    useEffect(() => {
        const fetchInventory = async () => {
            try {
                const token = await AsyncStorage.getItem('token');
                const res = await axios.get(`${API_URL}/store/my-inventory`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setItems(res.data || []);
            } catch (err) {
                console.error('[BAG] Fetch inventory error:', err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchInventory();
    }, []);

    const renderItemCard = (item, index) => {
        // Render item depending on category
        return (
            <Motion.SlideUp key={item.id} delay={index * 50} style={styles.cardWrapper}>
                <LinearGradient
                    colors={themeMode === 'dark' ? ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)'] : ['#ffffff', '#f8fafc']}
                    style={styles.itemCard}
                >
                    {/* Rarity Badge */}
                    <View style={[styles.rarityBadge, { backgroundColor: getRarityColor(item.rarity) }]}>
                        <Text style={styles.rarityText}>{item.rarity?.toUpperCase()}</Text>
                    </View>

                    {/* Content Preview */}
                    <View style={styles.previewContainer}>
                        {item.category === 'avatar_frame' ? (
                            <VipFrame 
                                level={item.key.includes('dealer') ? 'dealer' : parseInt(item.key.replace(/\D/g, '')) || 1} 
                                avatar="https://via.placeholder.com/150" 
                                size={55}
                                isStatic={true}
                            />
                        ) : (
                            <Image 
                                source={require('../assets/gift_icon.webp')} 
                                style={styles.previewImage}
                                resizeMode="contain"
                            />
                        )}
                    </View>

                    <Text style={[styles.itemName, { color: theme.colors.text }]} numberOfLines={1}>
                        {item.name}
                    </Text>

                    <Text style={[styles.itemExpiry, { color: theme.colors.textSecondary }]}>
                        {item.expires_at ? `Süre: ${new Date(item.expires_at).toLocaleDateString('tr-TR')}` : 'Süre: Süresiz'}
                    </Text>

                    <TouchableOpacity 
                        style={[styles.actionBtn, { backgroundColor: theme.colors.primary }]}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.actionBtnText}>Kullan</Text>
                    </TouchableOpacity>
                </LinearGradient>
            </Motion.SlideUp>
        );
    };

    const getRarityColor = (rarity) => {
        switch (rarity) {
            case 'limited': return '#ef4444';
            case 'legendary': return '#eab308';
            case 'epic': return '#a855f7';
            case 'rare': return '#06b6d4';
            default: return '#64748b';
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <LinearGradient
                colors={['#070B1F', '#0D153A']}
                style={StyleSheet.absoluteFill}
            />

            <SafeAreaView style={styles.safeArea}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={24} color="#ffffff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Çantam</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('Store')} style={styles.storeLink}>
                        <Ionicons name="cart-outline" size={24} color="#FF4FA3" />
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#FF4FA3" />
                    </View>
                ) : items.length > 0 ? (
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
                        <Text style={styles.sectionTitle}>Sahip Olduğun Ürünler</Text>
                        <View style={styles.grid}>
                            {items.map((item, idx) => renderItemCard(item, idx))}
                        </View>
                    </ScrollView>
                ) : (
                    <View style={styles.emptyContainer}>
                        <View style={styles.emptyIconCircle}>
                            <Ionicons name="briefcase-outline" size={50} color="rgba(255, 255, 255, 0.2)" />
                        </View>
                        <Text style={styles.emptyTitle}>Çantan Boş</Text>
                        <Text style={styles.emptyDesc}>
                            Profil çerçeveleri, giriş efektleri, unvanlar ve çok daha fazlasını alarak profilini renklendir!
                        </Text>
                        <TouchableOpacity 
                            style={styles.goStoreBtn}
                            onPress={() => navigation.navigate('Store')}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={['#FF4FA3', '#8B5CFF']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.goStoreGradient}
                            >
                                <Text style={styles.goStoreText}>Mağazaya Git</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                )}
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        height: 70,
        marginTop: Platform.OS === 'ios' ? 0 : 25,
    },
    backBtn: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    headerTitle: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    storeLink: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scroll: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    sectionTitle: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 16,
        opacity: 0.6,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        rowGap: 12,
    },
    cardWrapper: {
        width: (width - 52) / 2,
    },
    itemCard: {
        borderRadius: 20,
        padding: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    rarityBadge: {
        position: 'absolute',
        top: 8,
        left: 8,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        zIndex: 10,
    },
    rarityText: {
        color: '#ffffff',
        fontSize: 8,
        fontWeight: '900',
    },
    previewContainer: {
        height: 75,
        justifyContent: 'center',
        alignItems: 'center',
        marginVertical: 10,
    },
    previewImage: {
        width: 60,
        height: 60,
    },
    itemName: {
        fontSize: 13,
        fontWeight: 'bold',
        marginBottom: 3,
        textAlign: 'center',
        width: '100%',
    },
    itemExpiry: {
        fontSize: 10,
        opacity: 0.7,
        marginBottom: 10,
    },
    actionBtn: {
        width: '90%',
        paddingVertical: 7,
        borderRadius: 10,
        alignItems: 'center',
    },
    actionBtnText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    emptyContainer: {
        flex: 0.8,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    emptyIconCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    emptyTitle: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    emptyDesc: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 12,
        textAlign: 'center',
        lineHeight: 18,
        marginBottom: 30,
    },
    goStoreBtn: {
        width: 180,
        height: 48,
        borderRadius: 24,
        overflow: 'hidden',
    },
    goStoreGradient: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    goStoreText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: 'bold',
    },
});
