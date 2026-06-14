import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Modal, TextInput, ActivityIndicator, Dimensions, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { API_URL } from '../config';
import { useAlert } from '../contexts/AlertContext';
import GlassCard from '../components/ui/GlassCard';

// Import New Modular Components
import RoomListHeader from '../components/rooms/RoomListHeader';
import RoomCategoryTabs from '../components/rooms/RoomCategoryTabs';
import RoomCard from '../components/rooms/RoomCard';
import CreateRoomFloatingButton from '../components/rooms/CreateRoomFloatingButton';
import EmptyRoomState from '../components/rooms/EmptyRoomState';

const { width } = Dimensions.get('window');

export default function PartyRoomsListScreen({ navigation }) {
    const { showAlert } = useAlert();
    const insets = useSafeAreaInsets();
    
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

    return (
        <View style={styles.container}>
            {/* Background Premium Dark Gradient */}
            <LinearGradient
                colors={['#0B1028', '#101632', '#0B1028']}
                style={StyleSheet.absoluteFill}
            />

            {/* Top Navigation & Tabs (Follow / Party) */}
            <RoomListHeader
                activeTab={mainTab}
                onTabChange={setMainTab}
                onBack={() => navigation.goBack()}
                insets={insets}
            />

            {/* Sub Categories Horizontal Bar */}
            <RoomCategoryTabs
                activeCategory={subTab}
                onCategoryChange={setSubTab}
            />

            {/* Party Rooms List */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#FF3F86" />
                </View>
            ) : (
                <FlatList
                    data={rooms}
                    keyExtractor={item => item.id?.toString()}
                    renderItem={({ item }) => (
                        <RoomCard
                            room={item}
                            onPress={() => navigation.navigate('PartyRoom', { room: item })}
                        />
                    )}
                    contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 85 }]}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF3F86" />
                    }
                    ListFooterComponent={
                        rooms.length === 1 ? (
                            <EmptyRoomState 
                                roomCount={rooms.length} 
                                onCreatePress={() => setCreateModalVisible(true)} 
                            />
                        ) : null
                    }
                    ListEmptyComponent={
                        <EmptyRoomState 
                            roomCount={0} 
                            onCreatePress={() => setCreateModalVisible(true)} 
                        />
                    }
                />
            )}

            {/* Pill-shaped FAB: Oda Oluştur */}
            <CreateRoomFloatingButton onPress={() => setCreateModalVisible(true)} />

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
        backgroundColor: '#0B1028',
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    listContent: {
        paddingTop: 10,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    createModal: {
        width: width - 36,
        borderRadius: 28,
        padding: 24,
        borderWidth: 1.2,
        borderColor: 'rgba(255, 255, 255, 0.12)',
        backgroundColor: '#171D3A',
        shadowColor: '#FF3F86',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 20,
        textAlign: 'center',
        letterSpacing: 0.5,
    },
    input: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 14,
        color: '#FFFFFF',
        fontSize: 14.5,
        marginBottom: 22,
        fontWeight: '500',
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
    },
    modalBtn: {
        flex: 1,
        height: 46,
        borderRadius: 16,
        overflow: 'hidden',
    },
    modalBtnGradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelBtn: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.2,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    cancelBtnText: {
        color: '#9DA3B8',
        fontWeight: 'bold',
        fontSize: 13,
    },
    confirmBtnText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 13,
    },
});

