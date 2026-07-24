import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { API_URL } from '../config';

import { canCreateRoom, isAgencyOwnerOrStaff } from '../utils/permissions';
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
    const [isAgency, setIsAgency] = useState(false);

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
                setIsAgency(isAgencyOwnerOrStaff(parsedUser));
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

    const handleCreateRoomPress = () => {
        if (!roomTitle.trim()) {
            showAlert({
                title: 'Eksik Bilgi',
                message: 'Lütfen odanız için bir başlık girin.',
                type: 'warning'
            });
            return;
        }

        if (isAgency) {
            // Agency owner -> free room creation
            executeCreateRoom();
        } else {
            // Non-agency -> confirm 5000 coins fee
            showAlert({
                title: '5.000 Jeton Ödensin mi? 💎',
                message: `"${roomTitle.trim()}" odasını açmak için bakiyenizden 5.000 Jeton düşülecektir. İşlemi onaylıyor musunuz? (Her kullanıcı maksimum 1 oda açabilir)`,
                type: 'warning',
                showCancel: true,
                confirmText: 'Evet, Öde ve Başlat',
                cancelText: 'Vazgeç',
                onConfirm: () => executeCreateRoom()
            });
        }
    };

    const executeCreateRoom = async () => {
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

            const roomData = res.data;
            const feeMessage = roomData.fee_deducted > 0
                ? `Bakiyenizden 5.000 Jeton düşülerek "${roomTitle.trim()}" başlıklı canlı odanız başarıyla açıldı!`
                : `"${roomTitle.trim()}" başlıklı canlı odanız başarıyla açıldı.`;

            showAlert({
                title: 'Oda Başlatıldı! 🎙️',
                message: feeMessage,
                type: 'success',
                onConfirm: () => {
                    navigation.goBack();
                    navigation.navigate('PartyRoom', { room: roomData });
                }
            });
        } catch (err) {
            console.error('[CreateRoomScreen] Create room error:', err.message);
            const errorMsg = err.response?.data?.error || 'Oda oluşturulurken bir hata meydana geldi.';
            showAlert({
                title: 'Oda Açılamadı',
                message: errorMsg,
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleLockedSeatPress = (option) => {
        showAlert({
            title: `${option.label} Kilitli 🔒`,
            message: `Bu koltuk kapasitesi ileride Oda Seviyesi yükseldiğinde (${option.level}) otomatik açılacaktır. Şu an 8 Koltuk varsayılan oda seviyeniz için aktiftir.`,
            type: 'info'
        });
    };

    if (checkingAuth) {
        return (
            <View style={styles.loadingContainer}>
                <LinearGradient colors={['#070415', '#120a2a', '#070415']} style={StyleSheet.absoluteFill} />
                <ActivityIndicator size="large" color="#ec4899" />
            </View>
        );
    }

    if (!hasPermission) {
        return (
            <NoPermissionCreateRoomView
                onApplyPress={() => {
                    navigation.navigate('AgencyApplication');
                }}
                onInfoPress={() => {
                    showAlert({
                        title: 'Ajanslar Hakkında',
                        message: 'Ajansa katılarak ücretsiz yayın açabilir, özel canlı oda etkinlikleri düzenleyebilir ve gelir elde edebilirsiniz.',
                        type: 'info'
                    });
                }}
                onBackPress={() => navigation.goBack()}
            />
        );
    }

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#070415', '#160b36', '#070415']} style={StyleSheet.absoluteFill} />
            
            {/* Top Ambient Glow */}
            <View style={styles.ambientGlowTop} pointerEvents="none">
                <LinearGradient
                    colors={['rgba(168, 85, 247, 0.25)', 'transparent']}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                />
            </View>

            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
                    <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Oda Kur</Text>
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
                    <GlassCard style={styles.formCard} intensity={35} tint="dark">
                        {/* Notice Banner */}
                        <View style={[styles.noticeBanner, isAgency ? styles.agencyNotice : styles.coinNotice]}>
                            <Ionicons 
                                name={isAgency ? "ribbon-sharp" : "diamond-sharp"} 
                                size={14} 
                                color={isAgency ? "#c084fc" : "#f472b6"} 
                            />
                            <Text style={[styles.noticeText, { color: isAgency ? "#c084fc" : "#f472b6" }]}>
                                {isAgency 
                                    ? 'Ajans Sahibi Yetkisi: Ücretsiz Oda Kurma Hakkınız Mevcut' 
                                    : 'Oda Açılış Ücreti: 5.000 Jeton (1 Kişi En Fazla 1 Oda Açabilir)'
                                }
                            </Text>
                        </View>

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
                            onLockedPress={handleLockedSeatPress}
                        />

                        {/* Create Button */}
                        <CreateRoomButton 
                            onPress={handleCreateRoomPress}
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
        backgroundColor: '#070415',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    ambientGlowTop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 250,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
    },
    backBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    headerTitle: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: -0.3,
    },
    headerSpacer: {
        width: 38,
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
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    noticeBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 14,
        marginBottom: 18,
        gap: 6,
        borderWidth: 1,
    },
    agencyNotice: {
        backgroundColor: 'rgba(192, 132, 252, 0.1)',
        borderColor: 'rgba(192, 132, 252, 0.25)',
    },
    coinNotice: {
        backgroundColor: 'rgba(244, 114, 182, 0.1)',
        borderColor: 'rgba(244, 114, 182, 0.25)',
    },
    noticeText: {
        fontSize: 11,
        fontWeight: '800',
        flex: 1,
    },
});
