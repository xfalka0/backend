import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Modal, TextInput, ActivityIndicator, Dimensions, Image, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { API_URL } from '../config';
import { useTheme } from '../contexts/ThemeContext';
import { useAlert } from '../contexts/AlertContext';
import GlassCard from '../components/ui/GlassCard';
import { resolveImageUrl } from '../utils/imageUtils';

const { width } = Dimensions.get('window');

const SUB_TABS = ['Önerilen', 'Video', 'Eğlence', 'Etkileşimli', 'Oyun'];

export default function PartyRoomsListScreen({ navigation }) {
    const { theme, themeMode } = useTheme();
    const { showAlert } = useAlert();
    
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    
    const [mainTab, setMainTab] = useState('Parti'); // 'Takip et' | 'Parti'
    const [subTab, setSubTab] = useState('Önerilen'); // Sub categories
    
    const [createModalVisible, setCreateModalVisible] = useState(false);
    const [roomTitle, setRoomTitle] = useState('');
    const [creatingRoom, setCreatingRoom] = useState(false);

    const fetchRooms = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            const res = await axios.get(`${API_URL}/party-rooms`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setRooms(res.data);
        } catch (err) {
            console.error('[RoomsList] Fetch error:', err.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchRooms();
        }, [])
    );

    const handleCreateRoom = async () => {
        if (!roomTitle.trim()) {
            showAlert({ title: 'Hata', message: 'Lütfen bir oda başlığı yazın.', type: 'error' });
            return;
        }

        setCreatingRoom(true);
        try {
            const token = await AsyncStorage.getItem('token');
            const res = await axios.post(`${API_URL}/party-rooms`, {
                title: roomTitle.trim()
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setRoomTitle('');
            setCreateModalVisible(false);
            fetchRooms();
            navigation.navigate('PartyRoom', { room: res.data });
        } catch (err) {
            console.error('[RoomsList] Create error:', err.message);
            showAlert({ title: 'Hata', message: 'Oda oluşturulamadı.', type: 'error' });
        } finally {
            setCreatingRoom(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchRooms();
    };

    const renderRoomItem = ({ item }) => {
        const hasParticipants = item.participants && item.participants.length > 0;
        // Display up to 6 participant avatars in the pile
        const facePile = hasParticipants ? item.participants.slice(0, 6) : [];
        const isDark = themeMode === 'dark';

        return (
            <TouchableOpacity
                activeOpacity={0.9}
                style={styles.cardContainer}
                onPress={() => navigation.navigate('PartyRoom', { room: item })}
            >
                <View style={[
                    styles.roomCard,
                    { 
                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                        shadowColor: '#000',
                        shadowOpacity: isDark ? 0.3 : 0.05,
                        shadowRadius: 10,
                        elevation: 3
                    }
                ]}>
                    {isDark && (
                        <LinearGradient
                            colors={['rgba(255, 255, 255, 0.03)', 'rgba(255, 255, 255, 0.005)']}
                            style={StyleSheet.absoluteFill}
                        />
                    )}

                    {/* Left Rounded Square Thumbnail */}
                    <View style={styles.thumbnailContainer}>
                        <Image
                            source={{ uri: resolveImageUrl(item.host_avatar || 'https://via.placeholder.com/100') }}
                            style={styles.thumbnail}
                        />
                    </View>

                    {/* Right Info Section */}
                    <View style={styles.infoSection}>
                        {/* Title & Level Badge Row */}
                        <View style={styles.titleRow}>
                            <Text style={[styles.roomTitle, { color: theme.colors.text }]} numberOfLines={1}>
                                {item.title}
                            </Text>
                            <LinearGradient
                                colors={['#f43f5e', '#ec4899']}
                                style={styles.levelBadge}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <Text style={styles.levelText}>Lv.{item.room_level || 6}</Text>
                            </LinearGradient>
                        </View>

                        {/* Country Flag & Tag Row */}
                        <View style={styles.tagRow}>
                            <Text style={styles.flag}>🇹🇷</Text>
                            <View style={styles.categoryBadge}>
                                <Text style={styles.categoryText}>👍 Video Etkileşimi</Text>
                            </View>
                        </View>

                        {/* Avatars pile, user count & Soundwave Indicator */}
                        <View style={styles.footerRow}>
                            {/* Pile of avatars & Count side by side */}
                            <View style={styles.avatarAndCount}>
                                <View style={styles.avatarPile}>
                                    {facePile.length > 0 ? (
                                        facePile.map((p, index) => (
                                            <Image
                                                key={p.id || index}
                                                source={{ uri: resolveImageUrl(p.avatar_url || 'https://via.placeholder.com/50') }}
                                                style={[styles.pileAvatar, { marginLeft: index === 0 ? 0 : -8, zIndex: 10 - index }]}
                                            />
                                        ))
                                    ) : (
                                        <Image
                                            source={{ uri: resolveImageUrl(item.host_avatar || 'https://via.placeholder.com/50') }}
                                            style={styles.pileAvatar}
                                        />
                                    )}
                                </View>
                                <View style={styles.countBadge}>
                                    <Ionicons name="person" size={10} color="rgba(156, 163, 175, 0.8)" style={{ marginRight: 2 }} />
                                    <Text style={styles.countText}>{item.active_speakers || 1}</Text>
                                </View>
                            </View>

                            {/* Soundwave equalizer indicator */}
                            <View style={styles.soundwaveContainer}>
                                <View style={[styles.soundwaveBar, { height: 14 }]} />
                                <View style={[styles.soundwaveBar, { height: 8 }]} />
                                <View style={[styles.soundwaveBar, { height: 18 }]} />
                                <View style={[styles.soundwaveBar, { height: 11 }]} />
                            </View>
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const isDark = themeMode === 'dark';

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {isDark && (
                <LinearGradient
                    colors={['#0D1429', '#151A36', '#111730']}
                    style={StyleSheet.absoluteFill}
                />
            )}

            {/* Top Navigation & Tabs (Follow / Party) */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}>
                    <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>

                <View style={styles.mainTabsContainer}>
                    {['Takip et', 'Parti'].map(tab => {
                        const isActive = mainTab === tab;
                        return (
                            <TouchableOpacity
                                key={tab}
                                style={styles.mainTabItem}
                                onPress={() => setMainTab(tab)}
                            >
                                <Text style={[
                                    styles.mainTabText,
                                    isActive && styles.mainTabTextActive
                                ]}>
                                    {tab}
                                </Text>
                                {isActive && (
                                    <View style={styles.mainTabIndicator} />
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>
                
                {/* Crown Icon on Right */}
                <TouchableOpacity style={[styles.backButton, { backgroundColor: 'transparent' }]}>
                    <Ionicons name="ribbon-outline" size={22} color="#fbbf24" />
                </TouchableOpacity>
            </View>

            {/* Sub Categories Horizontal Bar */}
            <View style={[styles.subTabsContainer, { borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subTabsScroll}>
                    {SUB_TABS.map(tab => {
                        const isActive = subTab === tab;
                        return (
                            <TouchableOpacity
                                key={tab}
                                style={styles.subTabItem}
                                onPress={() => setSubTab(tab)}
                            >
                                <Text style={[
                                    styles.subTabText,
                                    isActive && styles.subTabTextActive
                                ]}>
                                    {tab}
                                </Text>
                                {isActive && (
                                    <View style={styles.subTabIndicator} />
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* Party Rooms List */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#ec4899" />
                </View>
            ) : (
                <FlatList
                    data={rooms}
                    keyExtractor={item => item.id}
                    renderItem={renderRoomItem}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ec4899" />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="mic-off-outline" size={64} color="rgba(255,255,255,0.2)" />
                            <Text style={styles.emptyText}>Aktif parti odası bulunamadı.</Text>
                        </View>
                    }
                />
            )}

            {/* Pill-shaped FAB: Oda Oluştur */}
            <TouchableOpacity
                style={styles.fabButton}
                activeOpacity={0.85}
                onPress={() => setCreateModalVisible(true)}
            >
                <LinearGradient
                    colors={['#ec4899', '#f43f5e']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.fabGradient}
                >
                    <Ionicons name="add-circle" size={20} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.fabText}>Oda Oluştur</Text>
                </LinearGradient>
            </TouchableOpacity>

            {/* Create Room Modal */}
            <Modal
                visible={createModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setCreateModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setCreateModalVisible(false)} />
                    <GlassCard style={styles.createModal} intensity={40} tint="dark">
                        <Text style={styles.modalTitle}>Oda Başlat 🎙️</Text>
                        <TextInput
                            placeholder="Odanız için eğlenceli bir başlık yazın..."
                            placeholderTextColor="rgba(255,255,255,0.4)"
                            style={styles.input}
                            value={roomTitle}
                            onChangeText={setRoomTitle}
                            maxLength={40}
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity 
                                style={[styles.modalBtn, styles.cancelBtn]} 
                                onPress={() => setCreateModalVisible(false)}
                            >
                                <Text style={styles.cancelBtnText}>Vazgeç</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={styles.modalBtn}
                                onPress={handleCreateRoom}
                                disabled={creatingRoom}
                            >
                                <LinearGradient
                                    colors={['#8b5cf6', '#ec4899']}
                                    style={styles.modalBtnGradient}
                                >
                                    {creatingRoom ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <Text style={styles.confirmBtnText}>Başlat</Text>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </GlassCard>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
        paddingTop: 50,
        paddingBottom: 10,
    },
    backButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
    },
    mainTabsContainer: {
        flexDirection: 'row',
        gap: 20,
    },
    mainTabItem: {
        alignItems: 'center',
        paddingVertical: 6,
    },
    mainTabText: {
        fontSize: 16,
        color: 'rgba(156, 163, 175, 0.6)',
        fontWeight: 'bold',
    },
    mainTabTextActive: {
        color: '#22c55e', // Green active tab matching screenshot
    },
    mainTabIndicator: {
        width: 12,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: '#22c55e',
        marginTop: 4,
    },
    subTabsContainer: {
        borderBottomWidth: 1,
        paddingBottom: 8,
    },
    subTabsScroll: {
        paddingHorizontal: 15,
        gap: 24,
    },
    subTabItem: {
        alignItems: 'center',
        paddingVertical: 6,
    },
    subTabText: {
        fontSize: 14,
        color: 'rgba(156, 163, 175, 0.5)',
        fontWeight: 'bold',
    },
    subTabTextActive: {
        color: '#22c55e', // Green active subtab
    },
    subTabIndicator: {
        width: 14,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: '#22c55e',
        marginTop: 4,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    listContent: {
        padding: 15,
        paddingBottom: 120,
    },
    cardContainer: {
        marginBottom: 12,
    },
    roomCard: {
        flexDirection: 'row',
        borderRadius: 20,
        padding: 12,
        borderWidth: 1,
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
    },
    thumbnailContainer: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 4,
    },
    thumbnail: {
        width: 76,
        height: 76,
        borderRadius: 16,
    },
    infoSection: {
        flex: 1,
        marginLeft: 14,
        justifyContent: 'space-between',
        height: 76,
    },
    titleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    roomTitle: {
        fontSize: 15,
        fontWeight: 'bold',
        flex: 1,
        marginRight: 10,
    },
    levelBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 0.5,
        borderColor: 'rgba(255,255,255,0.25)',
    },
    levelText: {
        fontSize: 9,
        fontWeight: 'bold',
        color: '#fff',
    },
    tagRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 2,
    },
    flag: {
        fontSize: 14,
    },
    categoryBadge: {
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
        borderWidth: 0.5,
        borderColor: 'rgba(245, 158, 11, 0.25)',
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 1.5,
    },
    categoryText: {
        fontSize: 10,
        color: '#fbbf24',
        fontWeight: '600',
    },
    footerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 4,
    },
    avatarAndCount: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatarPile: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    pileAvatar: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#151A36',
    },
    countBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(156, 163, 175, 0.1)',
        borderRadius: 8,
        paddingHorizontal: 6,
        paddingVertical: 2,
        marginLeft: 8,
    },
    countText: {
        fontSize: 10,
        color: 'rgba(156, 163, 175, 0.9)',
        fontWeight: 'bold',
    },
    soundwaveContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 2,
        height: 18,
    },
    soundwaveBar: {
        width: 2.2,
        backgroundColor: '#ec4899',
        borderRadius: 1,
    },
    fabButton: {
        position: 'absolute',
        bottom: 30,
        right: 20,
        borderRadius: 28,
        shadowColor: '#ec4899',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 8,
        overflow: 'hidden',
    },
    fabGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    fabText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 120,
    },
    emptyText: {
        color: 'rgba(255,255,255,0.35)',
        marginTop: 15,
        fontSize: 14,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    createModal: {
        width: width - 40,
        borderRadius: 28,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 20,
        textAlign: 'center',
    },
    input: {
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 14,
        color: '#fff',
        fontSize: 15,
        marginBottom: 20,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
    },
    modalBtn: {
        flex: 1,
        height: 48,
        borderRadius: 16,
        overflow: 'hidden',
    },
    modalBtnGradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelBtn: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
    },
    cancelBtnText: {
        color: 'rgba(255,255,255,0.7)',
        fontWeight: 'bold',
    },
    confirmBtnText: {
        color: '#fff',
        fontWeight: 'bold',
    },
});

