import { useFocusEffect } from '@react-navigation/native';
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, TextInput, Platform, Linking, Modal, LayoutAnimation } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { useTheme } from '../contexts/ThemeContext';
import { API_URL } from '../config';
import VipFrame from '../components/ui/VipFrame';
import ModernAlert from '../components/ui/ModernAlert';

export default function ProfileScreen({ route, navigation }) {
    const { theme, themeMode } = useTheme();
    const { user } = route.params || {};

    const [isEditingBio, setIsEditingBio] = useState(false);
    const [tempBio, setTempBio] = useState(user?.bio || 'Buraya kısa bir açıklama ekleyebilirsiniz.');
    const [album, setAlbum] = useState([]);
    const [pendingAlbumPhotos, setPendingAlbumPhotos] = useState([]);
    const TEST_USER_ID = 'c917f7d6-cc44-4b04-8917-1dbbed0b1e9b';
    const [profileAvatar, setProfileAvatar] = useState(user?.avatar_url || user?.avatar || 'https://i.pravatar.cc/300?img=12');
    const [isAvatarPending, setIsAvatarPending] = useState(false);

    const [isEditingInfo, setIsEditingInfo] = useState(false);
    const [info, setInfo] = useState({
        name: user.display_name || user.name || 'Misafir',
        age: (user.age || '28').toString(),
        job: user.job || 'Yazılımcı',
        relationship: user.relationship || 'Sohbet',
        zodiac: user.zodiac || 'Aslan'
    });

    const [alert, setAlert] = useState({ visible: false, title: '', message: '', type: 'info' });

    const parseInterests = (data) => {
        if (!data) return ['Spor', 'Müzik'];
        if (Array.isArray(data)) return data;
        try {
            const parsed = JSON.parse(data);
            return Array.isArray(parsed) ? parsed : ['Spor', 'Müzik'];
        } catch (e) {
            return data.toString().split(',').map(s => s.trim());
        }
    };

    const toggleEditInfo = async () => {
        if (isEditingInfo) {
            // Save to backend
            try {
                const response = await axios.put(`${API_URL}/users/${user.id}/profile`, {
                    name: info.name,
                    display_name: info.name,
                    age: info.age,
                    job: info.job,
                    relationship: info.relationship,
                    zodiac: info.zodiac,
                    interests: JSON.stringify(userInterests)
                });

                if (response.data) {
                    // Update local storage
                    const updatedUser = {
                        ...user,
                        ...response.data
                    };
                    await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
                    setAlert({ visible: true, title: 'Başarılı', message: 'Profil bilgileriniz güncellendi.', type: 'success' });
                }
            } catch (error) {
                console.log('Error saving profile:', error);
                setAlert({ visible: true, title: 'Hata', message: 'Bilgiler kaydedilemedi.', type: 'error' });
            }
        }
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setIsEditingInfo(!isEditingInfo);
    };

    const [isEditingInterests, setIsEditingInterests] = useState(false);
    const [userInterests, setUserInterests] = useState(parseInterests(user.interests));
    const [tempInterest, setTempInterest] = useState('');
    const [balance, setBalance] = useState(user.balance !== undefined ? user.balance : 100);
    const [vipLevel, setVipLevel] = useState(user.vip_level || 0);
    const [showContactModal, setShowContactModal] = useState(false);

    const handleContact = () => {
        setShowContactModal(true);
    };

    // Fetch latest balance, VIP, and approved photos on Focus
    useFocusEffect(
        useCallback(() => {
            if (user?.id) {
                // Fetch basic user data
                axios.get(`${API_URL}/users/${user.id}`)
                    .then(async (res) => {
                        const updatedData = res.data;
                        if (updatedData.balance !== undefined) setBalance(updatedData.balance);
                        if (updatedData.vip_level !== undefined) setVipLevel(updatedData.vip_level);
                        if (updatedData.interests) setUserInterests(parseInterests(updatedData.interests));

                        // Update avatar if approved and changed
                        const newAvatar = updatedData.avatar_url || updatedData.avatar;
                        if (newAvatar && newAvatar !== profileAvatar) {
                            setProfileAvatar(newAvatar);
                            setIsAvatarPending(false);
                        } else if (newAvatar && !updatedData.is_photo_pending) {
                            // If backend says no photo is pending, clear the local pending state
                            setIsAvatarPending(false);
                        }

                        // CRITICAL: Persist to AsyncStorage so it stays updated after restart
                        try {
                            const currentUserStr = await AsyncStorage.getItem('user');
                            if (currentUserStr) {
                                const currentUser = JSON.parse(currentUserStr);
                                const mergedUser = { ...currentUser, ...updatedData };
                                await AsyncStorage.setItem('user', JSON.stringify(mergedUser));
                                console.log('[Sync] User data persisted to AsyncStorage');
                            }
                        } catch (syncErr) {
                            console.log('[Sync] AsyncStorage error:', syncErr);
                        }
                    })
                    .catch(err => console.log('Fetch user error:', err));

                // Fetch operator album photos ONLY if user is an operator or admin
                if (user.role === 'operator' || user.role === 'admin' || user.role === 'super_admin') {
                    axios.get(`${API_URL}/operators/${user.id}`)
                        .then(res => {
                            if (res.data.photos && Array.isArray(res.data.photos)) {
                                setAlbum(res.data.photos);
                                setPendingAlbumPhotos([]);
                            }
                        })
                        .catch(err => {
                            // Backend now handles this gracefully, but we log just in case
                            if (err.response?.status !== 404) {
                                console.log('Fetch operator photos error:', err.message);
                            }
                        });
                }
            }
        }, [user?.id, user?.role, profileAvatar])
    );

    const getVipColors = (level) => {
        switch (level) {
            case 1: return ['#cd7f32', '#92400e']; // Bronze
            case 2: return ['#cbd5e1', '#64748b']; // Silver
            case 3: return ['#fbbf24', '#b45309']; // Gold
            case 4: return ['#22d3ee', '#164e63']; // Platinum
            case 5: return ['#e879f9', '#be185d']; // Diamond
            case 6: return ['#1a1a1a', '#451a03']; // Obsidian/Gold
            default: return themeMode === 'dark' ? ['#0f172a', '#1e1b4b'] : [theme.colors.background, theme.colors.backgroundSecondary];
        }
    };

    const vipColors = getVipColors(vipLevel);

    const uploadImage = async (uri) => {
        const formData = new FormData();
        formData.append('file', {
            uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
            type: 'image/jpeg',
            name: 'upload.jpg',
        });

        const res = await axios.post(`${API_URL}/upload`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });

        return res.data.url;
    };

    const pickAvatar = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            setAlert({ visible: true, title: 'İzin Gerekli', message: 'Galerinize erişmek için izin vermeniz gerekiyor.', type: 'warning' });
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled) {
            const uri = result.assets[0].uri;
            const oldAvatar = profileAvatar;
            setIsAvatarPending(true);
            setProfileAvatar(uri); // Immediate local preview

            try {
                // 1. Upload to server first
                const serverUrl = await uploadImage(uri);

                // 2. Submit for moderation
                const response = await axios.post(`${API_URL}/moderation/submit`, {
                    userId: user.id || TEST_USER_ID,
                    type: 'avatar',
                    url: serverUrl
                });
                if (response.data.url) {
                    setAlert({ visible: true, title: 'Başarılı', message: 'Profil fotoğrafınız moderasyon onayına gönderildi.', type: 'success' });
                    setIsAvatarPending(true);
                }
            } catch (error) {
                console.error('Avatar Upload Error Detail:', error.response?.data || error.message);
                setIsAvatarPending(false);
                setProfileAvatar(oldAvatar); // Revert on failure
                const errorMsg = error.response?.data?.error || 'Fotoğraf yüklenemedi.';
                setAlert({ visible: true, title: 'Hata', message: errorMsg, type: 'error' });
            }
        }
    };

    const addToAlbum = async () => {
        if (album.length + pendingAlbumPhotos.length >= 5) {
            setAlert({ visible: true, title: 'Limit Doldu', message: 'En fazla 5 fotoğraf ekleyebilirsiniz.', type: 'warning' });
            return;
        }

        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            setAlert({ visible: true, title: 'İzin Gerekli', message: 'Galerinize erişmek için izin vermeniz gerekiyor.', type: 'warning' });
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.8,
        });

        if (!result.canceled) {
            const uri = result.assets[0].uri;
            setPendingAlbumPhotos([...pendingAlbumPhotos, uri]);
            try {
                // 1. Upload to server first
                const serverUrl = await uploadImage(uri);

                // 2. Submit for moderation
                const response = await axios.post(`${API_URL}/moderation/submit`, {
                    userId: user.id || TEST_USER_ID,
                    type: 'album',
                    url: serverUrl
                });
                if (response.data.url) {
                    setAlert({ visible: true, title: 'Başarılı', message: 'Albüm fotoğrafınız moderasyon onayına gönderildi.', type: 'success' });
                    setPendingAlbumPhotos([...pendingAlbumPhotos, response.data.url]);
                }
            } catch (error) {
                console.error('Album Upload Error Detail:', error.response?.data || error.message);
                setPendingAlbumPhotos(pendingAlbumPhotos.filter(u => u !== uri));
                const errorMsg = error.response?.data?.error || 'Fotoğraf yüklenemedi.';
                setAlert({ visible: true, title: 'Hata', message: errorMsg, type: 'error' });
            }
        }
    };

    return (
        <ScrollView showsVerticalScrollIndicator={false} style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <LinearGradient
                colors={vipLevel > 0 ? [vipColors[0], vipColors[1]] : (themeMode === 'dark' ? ['#0f172a', '#1e1b4b'] : [theme.colors.background, theme.colors.backgroundSecondary])}
                style={styles.background}
            />

            <View style={styles.profileHeader}>
                <TouchableOpacity onPress={toggleEditInfo} style={styles.settingsIconContainer}>
                    <TouchableOpacity onPress={() => navigation.navigate('Settings', { user })}>
                        <Ionicons name="settings-outline" size={26} color={theme.colors.text} />
                    </TouchableOpacity>
                </TouchableOpacity>

                <View style={styles.avatarWrapper}>
                    <VipFrame
                        level={vipLevel}
                        avatar={profileAvatar}
                        size={120}
                    />

                    {isAvatarPending && (
                        <View style={styles.pendingOverlay}>
                            <Text style={styles.pendingText}>Onay Bekliyor</Text>
                        </View>
                    )}
                    <TouchableOpacity
                        style={[styles.editBadge, { backgroundColor: theme.colors.primary, borderColor: theme.colors.background }]}
                        onPress={pickAvatar}
                    >
                        <Ionicons name="camera" size={20} color="white" />
                    </TouchableOpacity>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 15, gap: 10 }}>
                    <Text style={{ color: theme.colors.text, fontSize: 24, fontWeight: 'bold' }}>{info.name}</Text>
                </View>
                <View style={styles.jobRowWrapper}>
                    <View style={styles.jobInfoItem}>
                        <Ionicons name="briefcase-outline" size={16} color={theme.colors.textSecondary} />
                        <Text style={[styles.profileJobText, { color: theme.colors.textSecondary }]}>{info.job}</Text>
                    </View>
                    <Text style={styles.dotSeparator}>•</Text>
                    <View style={styles.jobInfoItem}>
                        <Ionicons name="school-outline" size={16} color={theme.colors.textSecondary} />
                        <Text style={[styles.profileJobText, { color: theme.colors.textSecondary }]}>{user.edu || 'Üniversite'}</Text>
                    </View>
                </View>
            </View>

            {/* WALLET / COINS REDESIGNED */}
            <View style={styles.profileSection}>
                <LinearGradient
                    colors={vipLevel > 0 ? [vipColors[0], vipColors[1]] : (themeMode === 'dark' ? ['#1e293b', '#0f172a'] : [theme.colors.card, theme.colors.backgroundSecondary])}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.balanceCardModern, { borderColor: theme.colors.glassBorder, backgroundColor: theme.colors.card }]}
                >
                    <View style={styles.cardTopRow}>
                        <View style={[styles.cardLabelContainer, { backgroundColor: themeMode === 'dark' ? 'rgba(251, 191, 36, 0.1)' : 'rgba(245, 158, 11, 0.1)' }]}>
                            <Ionicons name="wallet" size={14} color="#f59e0b" style={{ marginRight: 6 }} />
                            <Text style={[styles.cardLabel, { color: themeMode === 'dark' ? '#fbbf24' : '#d97706' }]}>CÜZDAN BAKİYESİ</Text>
                        </View>
                        <View style={[styles.vipStatusBadge, { backgroundColor: theme.colors.glass }]}>
                            <Text style={[styles.vipStatusText, { color: theme.colors.textSecondary }]}>{vipLevel > 0 ? `VIP ${vipLevel}` : 'STANDART'}</Text>
                        </View>
                    </View>

                    <View style={styles.cardMiddleRow}>
                        <View>
                            <Text style={[styles.balanceMainText, { color: theme.colors.text }]}>{balance}</Text>
                            <Text style={[styles.balanceSubText, { color: theme.colors.textSecondary }]}>Toplam Coin</Text>
                        </View>
                        <LinearGradient
                            colors={['rgba(251, 191, 36, 0.2)', 'transparent']}
                            style={styles.coinIconDecor}
                        >
                            <Image
                                source={require('../../assets/gold_coin_3f.png')}
                                style={{ width: 75, height: 75 }}
                                resizeMode="contain"
                            />
                        </LinearGradient>
                    </View>

                    <View style={styles.cardActionRow}>
                        <TouchableOpacity
                            style={styles.modernActionBtn}
                            onPress={() => navigation.navigate('Shop', { initialTab: 'coins', user: { ...user, balance } })}
                        >
                            <LinearGradient colors={['#fbbf24', '#f59e0b']} style={styles.modernActionGradient}>
                                <Ionicons name="cart-outline" size={20} color="white" />
                                <Text style={styles.modernActionText}>Coin Mağazası</Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.modernActionBtn}
                            onPress={() => navigation.navigate('Vip', { userVip: vipLevel, user: { ...user, ...info, balance, vip_level: vipLevel, profile_image: profileAvatar } })}
                        >
                            <LinearGradient colors={['#8b5cf6', '#7c3aed']} style={styles.modernActionGradient}>
                                <Ionicons name="star" size={18} color="white" />
                                <Text style={styles.modernActionText}>VIP Merkezi</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </LinearGradient>
            </View>

            {/* BIO */}
            <View style={styles.profileSection}>
                <View style={styles.sectionHeader}>
                    <Text style={[styles.profileSectionTitle, { color: theme.colors.text }]}>Hakkımda</Text>
                    <TouchableOpacity onPress={async () => {
                        if (isEditingBio) {
                            try {
                                await axios.put(`${API_URL}/users/${user.id}`, {
                                    bio: tempBio
                                });
                                const updatedUser = { ...user, bio: tempBio };
                                await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
                                setAlert({ visible: true, title: 'Başarılı', message: 'Biyografiniz güncellendi.', type: 'success' });
                            } catch (err) {
                                console.log('Error saving bio:', err);
                                setAlert({ visible: true, title: 'Hata', message: 'Biyografi kaydedilemedi.', type: 'error' });
                            }
                        }
                        setIsEditingBio(!isEditingBio);
                    }}>
                        <Text style={styles.editLinkText}>{isEditingBio ? 'Kaydet' : 'Düzenle'}</Text>
                    </TouchableOpacity>
                </View>
                <View style={[styles.profileCard, { backgroundColor: themeMode === 'dark' ? theme.colors.glass : theme.colors.card, borderColor: theme.colors.glassBorder }]}>
                    {isEditingBio ? (
                        <TextInput
                            style={[styles.bioInput, { color: theme.colors.text }]}
                            value={tempBio}
                            onChangeText={setTempBio}
                            multiline
                            maxLength={200}
                            autoFocus
                        />
                    ) : (
                        <Text style={[styles.profileBioText, { color: theme.colors.textSecondary }]}>{tempBio}</Text>
                    )}
                </View>
            </View>

            {/* ALBÜM */}
            <View style={styles.profileSection}>
                <View style={styles.sectionHeader}>
                    <Text style={[styles.profileSectionTitle, { color: theme.colors.text }]}>Fotoğraf Albümü</Text>
                    <Text style={[styles.photoCountText, { color: theme.colors.textSecondary }]}>{album.length}/5</Text>
                </View>
                <View style={styles.albumGrid}>
                    {album.map((uri, index) => (
                        <View key={index} style={styles.albumPhotoWrapper}>
                            <Image source={{ uri }} style={styles.albumPhoto} />
                            <TouchableOpacity style={styles.removePhotoBtn} onPress={() => setAlbum(album.filter((_, i) => i !== index))}>
                                <Ionicons name="close-circle" size={20} color="#ef4444" />
                            </TouchableOpacity>
                        </View>
                    ))}
                    {pendingAlbumPhotos.map((uri, index) => (
                        <View key={`pending-${index}`} style={styles.albumPhotoWrapper}>
                            <Image source={{ uri }} style={[styles.albumPhoto, { opacity: 0.5 }]} />
                            <View style={styles.pendingBadgeSmall}>
                                <Text style={styles.pendingTextSmall}>Bekliyor</Text>
                            </View>
                        </View>
                    ))}
                    {album.length + pendingAlbumPhotos.length < 5 && (
                        <TouchableOpacity
                            style={[styles.addPhotoBtn, { borderColor: theme.colors.glassBorder, backgroundColor: theme.colors.glass }]}
                            onPress={addToAlbum}
                        >
                            <Ionicons name="add" size={32} color={theme.colors.primary} />
                            <Text style={[styles.addPhotoText, { color: theme.colors.primary }]}>Ekle</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* CONTACT MODAL */}
            <Modal
                transparent
                visible={showContactModal}
                animationType="fade"
                onRequestClose={() => setShowContactModal(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowContactModal(false)}
                >
                    <View style={styles.modernModalContainer}>
                        <LinearGradient
                            colors={themeMode === 'dark' ? ['#1e293b', '#0f172a'] : [theme.colors.background, theme.colors.backgroundSecondary]}
                            style={[styles.modernModalContent, { borderColor: theme.colors.glassBorder }]}
                        >
                            <View style={[styles.modalHeaderIndicator, { backgroundColor: theme.colors.textSecondary, opacity: 0.2 }]} />
                            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>İletişime Geç</Text>
                            <Text style={[styles.modalSubtitle, { color: theme.colors.textSecondary }]}>Sizin için nasıl yardımcı olabiliriz?</Text>

                            <TouchableOpacity
                                style={styles.contactOption}
                                onPress={() => {
                                    setShowContactModal(false);
                                    Linking.openURL('https://wa.me/905414738700');
                                }}
                            >
                                <LinearGradient
                                    colors={['#22c55e', '#16a34a']}
                                    style={styles.optionIconContainer}
                                >
                                    <Ionicons name="logo-whatsapp" size={24} color="white" />
                                </LinearGradient>
                                <View style={styles.optionTextContainer}>
                                    <Text style={[styles.optionTitle, { color: theme.colors.text }]}>WhatsApp Destek</Text>
                                    <Text style={[styles.optionDescription, { color: theme.colors.textSecondary }]}>Anında geri dönüş alın</Text>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.contactOption}
                                onPress={() => {
                                    setShowContactModal(false);
                                    Linking.openURL('mailto:falkasoft@gmail.com');
                                }}
                            >
                                <LinearGradient
                                    colors={['#8b5cf6', '#6d28d9']}
                                    style={styles.optionIconContainer}
                                >
                                    <Ionicons name="mail-outline" size={24} color="white" />
                                </LinearGradient>
                                <View style={styles.optionTextContainer}>
                                    <Text style={[styles.optionTitle, { color: theme.colors.text }]}>E-posta Gönder</Text>
                                    <Text style={[styles.optionDescription, { color: theme.colors.textSecondary }]}>Fikir ve önerileriniz için</Text>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.modalCancelBtn}
                                onPress={() => setShowContactModal(false)}
                            >
                                <Text style={styles.modalCancelText}>Kapat</Text>
                            </TouchableOpacity>
                        </LinearGradient>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* INFO */}
            <View style={styles.profileSection}>
                <View style={styles.sectionHeader}>
                    <Text style={[styles.profileSectionTitle, { color: theme.colors.text }]}>Bilgilerim</Text>
                    <TouchableOpacity
                        style={[styles.editInfoBtn, isEditingInfo && styles.saveInfoBtn, { backgroundColor: theme.colors.glass }]}
                        onPress={toggleEditInfo}
                    >
                        <Ionicons name={isEditingInfo ? "checkmark-circle" : "create-outline"} size={16} color="white" />
                        <Text style={styles.editBtnText}>{isEditingInfo ? 'Kaydet' : 'Düzenle'}</Text>
                    </TouchableOpacity>
                </View>
                <View style={[styles.profileCard, { backgroundColor: themeMode === 'dark' ? theme.colors.glass : theme.colors.card, borderColor: theme.colors.glassBorder }]}>
                    {[
                        { icon: 'person-outline', label: 'İsim', key: 'name' },
                        { icon: 'calendar-outline', label: 'Yaş', key: 'age' },
                        { icon: 'briefcase-outline', label: 'Meslek', key: 'job' },
                        { icon: 'heart-outline', label: 'İlişki Tercihi', key: 'relationship' },
                        { icon: 'sparkles-outline', label: 'Burç', key: 'zodiac' }
                    ].map((item, idx) => (
                        <View key={idx} style={styles.infoRow}>
                            <Ionicons name={item.icon} size={20} color={theme.gradients.primary[0]} />
                            <View style={styles.infoTextGroup}>
                                <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>{item.label}</Text>
                                {isEditingInfo ? (
                                    item.key === 'relationship' ? (
                                        <View style={styles.selectionGrid}>
                                            {['Ciddi', 'Kısa Süreli', 'Flörtöz'].map(opt => (
                                                <TouchableOpacity
                                                    key={opt}
                                                    style={[styles.smallSelectionBtn, info.relationship === opt && styles.activeSelectionBtn]}
                                                    onPress={() => setInfo({ ...info, relationship: opt })}
                                                >
                                                    <Text style={[styles.selectionText, info.relationship === opt && styles.activeSelectionText]}>{opt}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    ) : (
                                        <TextInput
                                            style={[styles.infoInput, { color: theme.colors.text, backgroundColor: theme.colors.glass, borderColor: theme.colors.glassBorder }]}
                                            value={info[item.key]}
                                            onChangeText={(val) => setInfo({ ...info, [item.key]: val })}
                                            maxLength={item.key === 'name' ? 15 : 100}
                                        />
                                    )
                                ) : (
                                    <Text style={[styles.infoValue, { color: theme.colors.text }]}>{info[item.key]}</Text>
                                )}
                            </View>
                        </View>
                    ))}

                    {/* INTERESTS INTEGRATED */}
                    <View style={[styles.infoDivider, { backgroundColor: theme.colors.glassBorder }]} />
                    <View style={styles.infoRow}>
                        <Ionicons name="apps-outline" size={20} color={theme.gradients.primary[0]} />
                        <View style={styles.infoTextGroup}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                                <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>İlgi Alanları</Text>
                                {isEditingInfo && (
                                    <TouchableOpacity onPress={() => setIsEditingInterests(!isEditingInterests)}>
                                        <Text style={{ color: '#8b5cf6', fontSize: 11, fontWeight: 'bold' }}>{isEditingInterests ? 'Bitti' : 'Ekle/Sil'}</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                            <View style={styles.interestsGrid}>
                                {userInterests && userInterests.map((item, index) => (
                                    <View key={index} style={[styles.tagSmall, { backgroundColor: themeMode === 'dark' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(139, 92, 246, 0.05)', borderColor: 'rgba(139, 92, 246, 0.2)' }]}>
                                        <Text style={[styles.tagTextSmall, { color: theme.colors.primary }]}>{item}</Text>
                                        {isEditingInterests && isEditingInfo && (
                                            <TouchableOpacity onPress={() => setUserInterests(userInterests.filter((_, i) => i !== index))} style={{ marginLeft: 4 }}>
                                                <Ionicons name="close-circle" size={12} color={theme.colors.danger} />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                ))}
                            </View>
                            {isEditingInterests && isEditingInfo && (
                                <View style={styles.addInterestWrapperSmall}>
                                    <TextInput
                                        style={[styles.interestInputSmall, { backgroundColor: theme.colors.glass, color: theme.colors.text }]}
                                        placeholder="Ekle..."
                                        placeholderTextColor={theme.colors.textSecondary}
                                        value={tempInterest}
                                        onChangeText={setTempInterest}
                                    />
                                    <TouchableOpacity onPress={() => {
                                        if (tempInterest.trim()) {
                                            setUserInterests([...userInterests, tempInterest.trim()]);
                                            setTempInterest('');
                                        }
                                    }}>
                                        <Ionicons name="add-circle" size={24} color="#8b5cf6" />
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    </View>
                </View>
            </View>



            <TouchableOpacity style={[styles.contactBtn, { backgroundColor: theme.colors.glass, borderColor: theme.colors.glassBorder }]} onPress={handleContact}>
                <View style={styles.contactBtnContent}>
                    <Ionicons name="chatbubbles-outline" size={20} color={theme.gradients.primary[0]} />
                    <Text style={[styles.contactBtnText, { color: theme.colors.textSecondary }]}>Destek ve İletişim</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.logoutBtn} onPress={async () => {
                await AsyncStorage.clear();
                navigation.replace('Welcome');
            }}>
                <Ionicons name="log-out-outline" size={20} color="#ef4444" />
                <Text style={styles.logoutBtnText}>Çıkış Yap</Text>
            </TouchableOpacity>

            <View style={{ height: 120 }} />
            <ModernAlert
                visible={alert.visible}
                title={alert.title}
                message={alert.message}
                type={alert.type}
                onClose={() => setAlert({ ...alert, visible: false })}
            />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    background: { ...StyleSheet.absoluteFillObject },
    profileHeader: { alignItems: 'center', paddingTop: 60, marginBottom: 30 },
    avatarWrapper: { position: 'relative' },
    profileAvatar: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: '#8b5cf6' },
    pendingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 60, justifyContent: 'center', alignItems: 'center' },
    pendingText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
    editBadge: { position: 'absolute', bottom: 5, right: 5, width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', borderWidth: 3 },
    profileName: { fontSize: 24, fontWeight: 'bold', marginTop: 15 },
    jobRowWrapper: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
    jobInfoItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    profileJobText: { color: '#94a3b8', fontSize: 14 },
    dotSeparator: { color: '#475569', marginHorizontal: 8 },
    profileSection: { paddingHorizontal: 20, marginBottom: 30 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    profileSectionTitle: { fontSize: 18, fontWeight: '800' },
    photoCountText: { fontSize: 13 },
    editLinkText: { color: '#8b5cf6', fontWeight: 'bold' },
    albumGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    albumPhotoWrapper: { width: '31%', aspectRatio: 0.8 },
    albumPhoto: { width: '100%', height: '100%', borderRadius: 12 },
    removePhotoBtn: { position: 'absolute', top: -5, right: -5 },
    pendingBadgeSmall: { position: 'absolute', bottom: 5, left: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 4, paddingVertical: 2 },
    pendingTextSmall: { color: 'white', fontSize: 8, textAlign: 'center', fontWeight: 'bold' },
    addPhotoBtn: { width: '31%', aspectRatio: 0.8, borderRadius: 12, borderStyle: 'dashed', borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
    addPhotoText: { fontSize: 12, fontWeight: 'bold', marginTop: 5 },
    profileCard: { borderRadius: 20, padding: 20, borderWidth: 1 },
    profileBioText: { lineHeight: 20, fontSize: 13 },
    bioInput: { lineHeight: 22, fontSize: 15, minHeight: 100, textAlignVertical: 'top' },
    infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 15 },
    infoTextGroup: { flex: 1 },
    infoLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 2 },
    infoValue: { fontSize: 15, fontWeight: '600' },
    infoInput: {
        fontSize: 16,
        fontWeight: '700',
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 8,
        marginTop: 2,
        borderWidth: 1,
    },
    editInfoBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 6,
    },
    saveInfoBtn: {
        backgroundColor: '#10b981',
    },
    editBtnText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 13,
    },
    settingsIconContainer: {
        position: 'absolute',
        top: 60,
        right: 20,
        zIndex: 10,
    },
    selectionGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 5,
    },
    smallSelectionBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
        borderWidth: 1,
    },
    activeSelectionBtn: {
        backgroundColor: 'rgba(139, 92, 246, 0.2)',
        borderColor: '#8b5cf6',
    },
    selectionText: {
        fontSize: 12,
        fontWeight: '600',
    },
    activeSelectionText: {
        color: 'white',
    },
    infoDivider: { height: 1, marginVertical: 15, marginLeft: 35 },
    interestsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    tagSmall: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1 },
    tagTextSmall: { fontSize: 12, fontWeight: '600' },
    addInterestWrapperSmall: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
    interestInputSmall: { flex: 1, borderRadius: 10, paddingHorizontal: 10, height: 36, fontSize: 13 },
    logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 10 },
    logoutBtnText: { color: '#ef4444', fontSize: 16, fontWeight: 'bold' },
    contactBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginHorizontal: 20,
        padding: 16,
        borderRadius: 15,
        marginBottom: 10,
        borderWidth: 1,
    },
    contactBtnContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    contactBtnText: {
        fontSize: 15,
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'flex-end',
    },
    modernModalContainer: {
        padding: 20,
        paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    },
    modernModalContent: {
        borderRadius: 30,
        padding: 24,
        borderWidth: 1,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 15,
    },
    modalHeaderIndicator: {
        width: 40,
        height: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: '900',
        textAlign: 'center',
        marginBottom: 8,
    },
    modalSubtitle: {
        color: '#94a3b8',
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 25,
    },
    contactOption: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 20,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
    },
    optionIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    optionTextContainer: {
        marginLeft: 15,
        flex: 1,
    },
    optionTitle: {
        fontSize: 16,
        fontWeight: '700',
    },
    optionDescription: {
        color: '#64748b',
        fontSize: 12,
        marginTop: 2,
    },
    modalCancelBtn: {
        marginTop: 10,
        padding: 15,
        alignItems: 'center',
    },
    modalCancelText: {
        color: '#64748b',
        fontSize: 15,
        fontWeight: '700',
    },
    // Modern Balance Card Styles
    balanceCardModern: {
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(251, 191, 36, 0.15)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 8,
    },
    cardTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    cardLabelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(251, 191, 36, 0.1)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    cardLabel: {
        color: '#fbbf24',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1,
    },
    vipStatusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 10,
    },
    vipStatusText: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    cardMiddleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 25,
    },
    balanceMainText: {
        fontSize: 36,
        fontWeight: '900',
        letterSpacing: -1,
    },
    balanceSubText: {
        color: '#64748b',
        fontSize: 13,
        fontWeight: '600',
        marginTop: -4,
    },
    coinIconDecor: {
        width: 70,
        height: 70,
        borderRadius: 35,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardActionRow: {
        flexDirection: 'row',
        gap: 12,
    },
    modernActionBtn: {
        flex: 1,
        borderRadius: 16,
        overflow: 'hidden',
    },
    modernActionGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        gap: 8,
    },
    modernActionText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '800',
    },
});
