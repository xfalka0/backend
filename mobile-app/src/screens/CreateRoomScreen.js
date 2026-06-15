import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { API_URL } from '../config';

import { canCreateRoom } from '../utils/permissions';
import { useAlert } from '../contexts/AlertContext';

// Components
import RoomCoverUploader from '../components/rooms/RoomCoverUploader';
import RoomTitleInput from '../components/rooms/RoomTitleInput';
import RoomCategorySelector from '../components/rooms/RoomCategorySelector';
import SeatCountSelector from '../components/rooms/SeatCountSelector';
import CreateRoomButton from '../components/rooms/CreateRoomButton';
import NoPermissionCreateRoomView from '../components/rooms/NoPermissionCreateRoomView';
import GlassCard from '../components/ui/GlassCard';

const { width } = Dimensions.get('window');

export default function CreateRoomScreen({ navigation }) {
    const { showAlert } = useAlert();
    const insets = useSafeAreaInsets();

    const [user, setUser] = useState(null);
    const [checkingAuth, setCheckingAuth] = useState(true);
    const [hasPermission, setHasPermission] = useState(false);

    // Form states
    const [roomTitle, setRoomTitle] = useState('');
    const [roomCategory, setRoomCategory] = useState('chat');
    const [seatCount, setSeatCount] = useState(8);
    const [roomImage, setRoomImage] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        checkPermission();
    }, []);

    const checkPermission = async () => {
        try {
            const userData = await AsyncStorage.getItem('user');
            if (userData) {
                const parsedUser = JSON.parse(userData);
                setUser(parsedUser);
                const allowed = canCreateRoom(parsedUser);
                setHasPermission(allowed);
            } else {
                setHasPermission(false);
            }
        } catch (err) {
            console.error('[CreateRoomScreen] Auth check error:', err);
            setHasPermission(false);
        } finally {
            setCheckingAuth(false);
        }
    };

    const handlePickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            showAlert({
                title: 'İzin Gerekli',
                message: 'Galerinize erişmek için izin vermeniz gerekiyor.',
                type: 'warning'
            });
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [16, 9],
            quality: 0.7,
        });

        if (!result.canceled) {
            setRoomImage(result.assets[0].uri);
        }
    };

    const handleCreateRoom = async () => {
        if (!roomTitle.trim()) {
            showAlert({
                title: 'Eksik Bilgi',
                message: 'Lütfen odanız için bir başlık girin.',
                type: 'warning'
            });
            return;
        }

        setLoading(true);
        try {
            const token = await AsyncStorage.getItem('token');
            let backgroundUrl = null;

            if (roomImage) {
                const formData = new FormData();
                formData.append('file', {
                    uri: Platform.OS === 'ios' ? roomImage.replace('file://', '') : roomImage,
                    type: 'image/jpeg',
                    name: 'party_background.jpg'
                });

                console.log('[CreateRoomScreen] Uploading room cover image...');
                const uploadRes = await axios.post(`${API_URL}/upload`, formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                        'Authorization': `Bearer ${token}`
                    }
                });
                backgroundUrl = uploadRes.data.url;
            }

            console.log('[CreateRoomScreen] Creating room on server...');
            const res = await axios.post(`${API_URL}/party-rooms`, {
                title: roomTitle.trim(),
                category: roomCategory,
                max_speakers: seatCount,
                background_url: backgroundUrl
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            showAlert({
                title: 'Oda Başlatıldı! 🎙️',
                message: `"${roomTitle.trim()}" başlıklı canlı oda başarıyla oluşturuldu.`,
                type: 'success',
                onConfirm: () => {
                    navigation.goBack();
                    navigation.navigate('PartyRoom', { room: res.data });
                }
            });
        } catch (err) {
            console.error('[CreateRoomScreen] Create room error:', err.message);
            showAlert({
                title: 'Hata',
                message: 'Oda oluşturulurken bir hata meydana geldi.',
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    if (checkingAuth) {
        return (
            <View style={styles.loadingContainer}>
                <LinearGradient colors={['#0B1028', '#101632']} style={StyleSheet.absoluteFill} />
                <ActivityIndicator size="large" color="#FF3F86" />
            </View>
        );
    }

    if (!hasPermission) {
        return (
            <NoPermissionCreateRoomView
                onApplyPress={() => {
                    // Navigate to Agency Application or show alert
                    navigation.navigate('AgencyApplication');
                }}
                onInfoPress={() => {
                    showAlert({
                        title: 'Ajanslar Hakkında',
                        message: 'Ajansa katılarak yayın açabilir, özel etkinlikler düzenleyebilir ve gelir elde edebilirsiniz.',
                        type: 'info'
                    });
                }}
                onBackPress={() => navigation.goBack()}
            />
        );
    }

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#0B1028', '#101632', '#0B1028']} style={StyleSheet.absoluteFill} />
            
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Oda Kur 🎙️</Text>
                <View style={styles.headerSpacer} />
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <ScrollView 
                    contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 30 }]}
                    showsVerticalScrollIndicator={false}
                >
                    <GlassCard style={styles.formCard} intensity={25} tint="dark">
                        {/* Cover Image */}
                        <RoomCoverUploader 
                            imageUri={roomImage}
                            onPickImage={handlePickImage}
                            onRemoveImage={() => setRoomImage(null)}
                        />

                        {/* Title Input */}
                        <RoomTitleInput 
                            value={roomTitle}
                            onChangeText={setRoomTitle}
                        />

                        {/* Category Selector */}
                        <RoomCategorySelector 
                            selectedCategory={roomCategory}
                            onSelectCategory={setRoomCategory}
                        />

                        {/* Seat Count Selector */}
                        <SeatCountSelector 
                            selectedSeats={seatCount}
                            onSelectSeats={setSeatCount}
                        />

                        {/* Create Button */}
                        <CreateRoomButton 
                            onPress={handleCreateRoom}
                            loading={loading}
                        />
                    </GlassCard>
                </ScrollView>
            </KeyboardAvoidingView>
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
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 16,
        borderBottomWidth: 1.2,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    headerSpacer: {
        width: 40,
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
    },
    formCard: {
        borderRadius: 28,
        padding: 20,
        borderWidth: 1.2,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
});
