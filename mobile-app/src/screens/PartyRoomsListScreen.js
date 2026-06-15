import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, ActivityIndicator, Dimensions, TouchableOpacity, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { API_URL } from '../config';
import { useAlert } from '../contexts/AlertContext';

// Import Modular Components
import PartyTopHeader from '../components/rooms/PartyTopHeader';
import PartyCategoryTabs from '../components/rooms/PartyCategoryTabs';
import PartyFilterChips from '../components/rooms/PartyFilterChips';
import RoomCard from '../components/rooms/RoomCard';
import CreateRoomFloatingButton from '../components/rooms/CreateRoomFloatingButton';
import EmptyRoomState from '../components/rooms/EmptyRoomState';

import { canCreateRoom } from '../utils/permissions';

const { width, height } = Dimensions.get('window');

const DEMO_ROOMS = [
    {
        id: 'demo-1',
        title: 'Gece Muhabbeti 🎙️',
        host_name: 'melis',
        agency_name: 'Diamond Agency',
        category: 'Önerilen',
        country: 'TR',
        onlineCount: 124,
        active_speakers: 5,
        max_speakers: 8,
        diamond_count: '2.4K',
        room_level: 3,
        host_avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
    },
    {
        id: 'demo-2',
        title: 'Yeni İnsanlar & Sohbet 💫',
        host_name: 'aylin',
        agency_name: 'Star Agency',
        category: 'Önerilen',
        country: 'TR',
        onlineCount: 89,
        active_speakers: 4,
        max_speakers: 8,
        diamond_count: '1.2K',
        room_level: 2,
        host_avatar: 'https://randomuser.me/api/portraits/women/68.jpg',
    },
    {
        id: 'demo-3',
        title: 'Canlı Müzik & İstek 🎵',
        host_name: 'deniz',
        agency_name: 'Moon Agency',
        category: 'Video',
        country: 'TR',
        onlineCount: 210,
        active_speakers: 6,
        max_speakers: 8,
        diamond_count: '5.6K',
        room_level: 5,
        host_avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
    },
    {
        id: 'demo-4',
        title: 'Eğlence Masası DC 🎮',
        host_name: 'ece',
        agency_name: 'Diamond Agency',
        category: 'Eğlence',
        country: 'TR',
        onlineCount: 45,
        active_speakers: 8,
        max_speakers: 8,
        diamond_count: '850',
        room_level: 1,
        host_avatar: 'https://randomuser.me/api/portraits/women/33.jpg',
    },
    {
        id: 'demo-5',
        title: 'İki Kalp Tek Oda ❤️',
        host_name: 'gamze',
        agency_name: 'Star Agency',
        category: 'Etkileşimli',
        country: 'TR',
        onlineCount: 312,
        active_speakers: 2,
        max_speakers: 4,
        diamond_count: '12.5K',
        room_level: 6,
        host_avatar: 'https://randomuser.me/api/portraits/women/12.jpg',
    }
];

export default function PartyRoomsListScreen({ navigation }) {
    const { showAlert } = useAlert();
    const insets = useSafeAreaInsets();
    
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    
    const [mainTab, setMainTab] = useState('Parti'); // 'Takip et' | 'Parti'
    const [subTab, setSubTab] = useState('Önerilen'); // Sub categories
    const [activeFeaturedChip, setActiveFeaturedChip] = useState('popular');
    
    const [userPermission, setUserPermission] = useState(false);

    const fetchRooms = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            const res = await axios.get(`${API_URL}/party-rooms`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setRooms(res.data);

            // Fetch user permissions too
            const userData = await AsyncStorage.getItem('user');
            if (userData) {
                const userObj = JSON.parse(userData);
                setUserPermission(canCreateRoom(userObj));
            }
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

    const onRefresh = () => {
        setRefreshing(true);
        fetchRooms();
    };

    // Filter rooms based on selected category & active featured chip
    const getFilteredRooms = () => {
        const baseRooms = rooms.length > 0 ? rooms.map((r, index) => ({
            ...r,
            onlineCount: r.onlineCount || (10 + (index * 12)),
            active_speakers: r.active_speakers || 3,
            max_speakers: r.max_speakers || 8,
            diamond_count: r.diamond_count || `${((index + 1) * 0.7).toFixed(1)}K`,
            room_level: r.room_level || (index % 4) + 1,
            category: r.category || 'Önerilen',
            host_name: r.host_name || r.username || 'Yayıncı',
            agency_name: r.agency_name || 'Star Agency',
            host_avatar: r.host_avatar || null,
        })) : DEMO_ROOMS;

        // 1. Filter by categories: Önerilen, Video, Eğlence, Etkileşimli, Oyun
        let categoryFiltered = baseRooms;
        if (subTab !== 'Önerilen') {
            categoryFiltered = baseRooms.filter(r => r.category === subTab);
        }

        // 2. Filter or sort by featured chips: popular, vip, new, tr
        if (activeFeaturedChip === 'popular') {
            return categoryFiltered.sort((a, b) => parseInt(b.onlineCount) - parseInt(a.onlineCount));
        } else if (activeFeaturedChip === 'vip') {
            return categoryFiltered.filter(r => r.room_level >= 3);
        } else if (activeFeaturedChip === 'new') {
            return categoryFiltered.filter(r => r.room_level <= 2);
        }

        return categoryFiltered;
    };

    const displayRooms = getFilteredRooms();

    return (
        <View style={styles.container}>
            {/* Background Premium Dark Cosmic Gradient */}
            <LinearGradient
                colors={['#070B24', '#12002E', '#210035']}
                style={StyleSheet.absoluteFill}
            />

            {/* Radial Glows */}
            <View style={[styles.radialGlow, styles.glowTopRight]} />
            <View style={[styles.radialGlow, styles.glowBottomLeft]} />

            {/* Top Navigation & Tabs (Follow / Party) */}
            <PartyTopHeader
                activeTab={mainTab}
                onTabChange={setMainTab}
                onBack={() => navigation.goBack()}
                insets={insets}
            />



            {/* Yatay Featured Highlight Chips */}
            <PartyFilterChips
                activeChip={activeFeaturedChip}
                onChipChange={setActiveFeaturedChip}
            />

            {/* Party Rooms List */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#FF2F8B" />
                </View>
            ) : (
                <FlatList
                    data={displayRooms}
                    keyExtractor={item => item.id?.toString()}
                    renderItem={({ item }) => (
                        <RoomCard
                            room={item}
                            onPress={() => navigation.navigate('PartyRoom', { room: item })}
                        />
                    )}
                    contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 90 }]}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF2F8B" />
                    }
                    ListEmptyComponent={
                        <EmptyRoomState 
                            roomCount={0} 
                            onCreatePress={() => navigation.navigate('CreateRoom')} 
                        />
                    }
                />
            )}

            {/* Floating Action Button (Only show if user has permission) */}
            {userPermission && (
                <CreateRoomFloatingButton onPress={() => navigation.navigate('CreateRoom')} />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#070B24',
    },
    radialGlow: {
        position: 'absolute',
        width: width * 0.8,
        height: width * 0.8,
        borderRadius: (width * 0.8) / 2,
        opacity: 0.08, // Much softer glow to keep it extremely premium
        ...Platform.select({
            ios: {
                shadowColor: '#7B2CFF',
                shadowRadius: 120,
                shadowOpacity: 0.8,
            },
            android: {
                backgroundColor: 'rgba(123, 44, 255, 0.25)',
                filter: 'blur(100px)',
            }
        })
    },
    glowTopRight: {
        top: -100,
        right: -100,
        backgroundColor: 'rgba(255, 47, 139, 0.25)',
        ...Platform.select({
            ios: { shadowColor: '#FF2F8B' }
        })
    },
    glowBottomLeft: {
        bottom: -100,
        left: -100,
        backgroundColor: 'rgba(123, 44, 255, 0.25)',
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    listContent: {
        paddingTop: 4,
    },
});
