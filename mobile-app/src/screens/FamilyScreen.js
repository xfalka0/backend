import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
    Image, Dimensions, ActivityIndicator, Alert, StatusBar, Modal, ScrollView
} from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_URL } from '../config';
import { useAlert } from '../contexts/AlertContext';
import { useAppStore } from '../store/useAppStore';

const { width } = Dimensions.get('window');

// Cumulative XP Level Configurations
const DEMO_FAMILIES = [
    {
        id: 'demo_1',
        name: "Diamond Angels",
        leader_name: "Sudenur",
        level: 4,
        member_count: 87,
        max_members: 100,
        points: 82000,
        nextXp: 100000,
        rank: 1,
        badge_url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&q=80",
        join_type: "approval_required",
        description: "Sadece aktif ve hediye gönderen üyeler kabul edilir."
    },
    {
        id: 'demo_2',
        name: "Star Family",
        leader_name: "Melis",
        level: 3,
        member_count: 42,
        max_members: 50,
        points: 18400,
        nextXp: 25000,
        rank: 2,
        badge_url: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=100&q=80",
        join_type: "open",
        description: "Herkes davetlidir, seviye atlamak için sesli odada kalın!"
    },
    {
        id: 'demo_3',
        name: "Moonlight Clan",
        leader_name: "Aylin",
        level: 2,
        member_count: 18,
        max_members: 20,
        points: 4200,
        nextXp: 5000,
        rank: 3,
        badge_url: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=100&q=80",
        join_type: "approval_required",
        description: "Sakin ve samimi bir topluluk."
    }
];

const LEVEL_THRESHOLDS = [
    { level: 8, xp: 3000000, maxMembers: 999999 },
    { level: 7, xp: 1500000, maxMembers: 500 },
    { level: 6, xp: 750000, maxMembers: 300 },
    { level: 5, xp: 300000, maxMembers: 200 },
    { level: 4, xp: 100000, maxMembers: 100 },
    { level: 3, xp: 25000, maxMembers: 50 },
    { level: 2, xp: 5000, maxMembers: 20 },
    { level: 1, xp: 0, maxMembers: 10 }
];

function getLevelInfo(points) {
    for (const lvl of LEVEL_THRESHOLDS) {
        if (points >= lvl.xp) {
            return lvl;
        }
    }
    return LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
}

function getNextLevelThreshold(points) {
    const sorted = [...LEVEL_THRESHOLDS].sort((a,b) => a.xp - b.xp);
    for (const lvl of sorted) {
        if (lvl.xp > points) {
            return lvl;
        }
    }
    return null; // Level 8 maxed
}

export default function FamilyScreen({ navigation }) {
    const { showAlert } = useAlert();
    const { user: currentUser, balance, setBalance } = useAppStore();

    // Loading & state states
    const [loading, setLoading] = useState(true);
    const [myFamilyData, setMyFamilyData] = useState(null); // { family, members, myRole }
    const [searchQuery, setSearchQuery] = useState('');
    const [familiesList, setFamiliesList] = useState([]);
    const [activeTab, setActiveTab] = useState('members'); // 'members', 'chat', 'tasks', 'manage'

    // Create Modal state
    const [createModalVisible, setCreateModalVisible] = useState(false);
    const [familyName, setFamilyName] = useState('');
    const [familyDesc, setFamilyDesc] = useState('');
    const [familyBadge, setFamilyBadge] = useState('');
    const [familyJoinType, setFamilyJoinType] = useState('approval_required'); // 'open', 'approval_required', 'invite_only'
    const [submitting, setSubmitting] = useState(false);

    // Chat States
    const [chatMessages, setChatMessages] = useState([]);
    const [newMessageText, setNewMessageText] = useState('');
    const chatFlatListRef = useRef(null);

    // Admin / Management states
    const [applications, setApplications] = useState([]);
    const [checkedInToday, setCheckedInToday] = useState(false);
    const [dailyContribution, setDailyContribution] = useState(0);

    const [selectedFilter, setSelectedFilter] = useState('popular');
    const searchInputRef = useRef(null);
    const scrollViewRef = useRef(null);

    const isMale = (currentUser?.gender || '').toLowerCase() === 'erkek';

    const fetchMyFamily = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            const res = await axios.get(`${API_URL}/families/my`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMyFamilyData(res.data);
            if (res.data) {
                // If in a family, load additional family data
                fetchChatHistory(res.data.family.id);
                if (['leader', 'co_leader', 'officer'].includes(res.data.myRole)) {
                    fetchApplications(res.data.family.id);
                }
                checkDailyStatus(res.data.family.id);
            } else {
                fetchFamilies();
            }
        } catch (e) {
            console.error('Fetch my family error:', e);
        } finally {
            setLoading(false);
        }
    };

    const fetchFamilies = async (query = '') => {
        try {
            const token = await AsyncStorage.getItem('token');
            const res = await axios.get(`${API_URL}/families?search=${query}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setFamiliesList(res.data);
        } catch (e) {
            console.error('Fetch families error:', e);
        }
    };

    const fetchChatHistory = async (familyId) => {
        try {
            const token = await AsyncStorage.getItem('token');
            const res = await axios.get(`${API_URL}/families/${familyId}/chat`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setChatMessages(res.data);
            setTimeout(() => chatFlatListRef.current?.scrollToEnd({ animated: false }), 200);
        } catch (e) {
            console.error('Fetch chat error:', e);
        }
    };

    const fetchApplications = async (familyId) => {
        try {
            const token = await AsyncStorage.getItem('token');
            const res = await axios.get(`${API_URL}/families/${familyId}/applications`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setApplications(res.data);
        } catch (e) {
            console.error('Fetch applications error:', e);
        }
    };

    const checkDailyStatus = async (familyId) => {
        try {
            const token = await AsyncStorage.getItem('token');
            const logsRes = await axios.get(`${API_URL}/families/${familyId}/chat`, {
                headers: { Authorization: `Bearer ${token}` } // (we just fetch to query xp logs from endpoint or we query indirectly)
            });
            // We can determine daily status from current user's daily xp contrib
            const myMemberData = myFamilyData?.members?.find(m => m.user_id === currentUser.id);
            if (myMemberData) {
                setDailyContribution(myMemberData.daily_xp_contributed || 0);
            }
        } catch (e) {
            console.error('Check daily status error:', e);
        }
    };

    useEffect(() => {
        fetchMyFamily();
    }, [myFamilyData?.family?.id]);

    const handleCreateFamily = async () => {
        if (!familyName.trim()) {
            showAlert({ title: 'Hata', message: 'Aile adı boş olamaz.', type: 'warning' });
            return;
        }

        const isOwner = currentUser?.is_agency_owner;
        const creationCost = 5000;

        if (!isOwner && balance < creationCost) {
            showAlert({ title: 'Yetersiz Bakiye', message: `Aile kurmak için ${creationCost} altın gereklidir.`, type: 'error' });
            return;
        }

        setSubmitting(true);
        try {
            const token = await AsyncStorage.getItem('token');
            const res = await axios.post(`${API_URL}/families`, {
                name: familyName,
                description: familyDesc,
                badgeUrl: familyBadge || 'https://via.placeholder.com/150',
                joinType: familyJoinType
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            showAlert({ title: 'Tebrikler!', message: 'Aileniz başarıyla kuruldu!', type: 'success' });
            setCreateModalVisible(false);
            setBalance(balance - (isOwner ? 0 : creationCost));
            setMyFamilyData({ family: res.data, members: [], myRole: 'leader' });
            fetchMyFamily();
        } catch (e) {
            const errorMsg = e.response?.data?.error || 'Aile kurulurken bir hata oluştu.';
            showAlert({ title: 'Hata', message: errorMsg, type: 'error' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleApply = async (familyId) => {
        try {
            const token = await AsyncStorage.getItem('token');
            const res = await axios.post(`${API_URL}/families/${familyId}/apply`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            showAlert({ title: 'Başvuru', message: res.data.message, type: 'success' });
            fetchFamilies(searchQuery);
        } catch (e) {
            const errorMsg = e.response?.data?.error || 'Başvuru yapılamadı.';
            showAlert({ title: 'Hata', message: errorMsg, type: 'error' });
        }
    };

    const handleResolveApplication = async (appId, action) => {
        try {
            const token = await AsyncStorage.getItem('token');
            const familyId = myFamilyData.family.id;
            await axios.post(`${API_URL}/families/${familyId}/applications/${appId}/resolve`, { action }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            showAlert({ 
                title: 'Başarılı', 
                message: action === 'accept' ? 'Başvuru onaylandı ve üye eklendi.' : 'Katılım isteği reddedildi.', 
                type: 'success' 
            });
            fetchApplications(familyId);
            fetchMyFamily();
        } catch (e) {
            const errorMsg = e.response?.data?.error || 'İşlem gerçekleştirilemedi.';
            showAlert({ title: 'Hata', message: errorMsg, type: 'error' });
        }
    };

    const handleDailyCheckIn = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            const res = await axios.post(`${API_URL}/families/check-in`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            showAlert({ title: 'Günlük Check-in', message: res.data.message, type: 'success' });
            setCheckedInToday(true);
            fetchMyFamily();
        } catch (e) {
            const errorMsg = e.response?.data?.error || 'Giriş yapılamadı.';
            showAlert({ title: 'Hata', message: errorMsg, type: 'error' });
        }
    };

    const handleSendMessage = async () => {
        if (!newMessageText.trim()) return;
        const msg = newMessageText;
        setNewMessageText('');
        try {
            const token = await AsyncStorage.getItem('token');
            const familyId = myFamilyData.family.id;
            const res = await axios.post(`${API_URL}/families/${familyId}/chat`, { message: msg }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setChatMessages(prev => [...prev, res.data]);
            setTimeout(() => chatFlatListRef.current?.scrollToEnd({ animated: true }), 100);
        } catch (e) {
            console.error('Send message error:', e);
        }
    };

    const handleKickMember = (targetUserId, targetName) => {
        showAlert({
            title: 'Üyeyi Çıkar',
            message: `${targetName} isimli üyeyi aileden çıkartmak istediğinize emin misiniz?`,
            type: 'warning',
            onConfirm: async () => {
                try {
                    const token = await AsyncStorage.getItem('token');
                    const familyId = myFamilyData.family.id;
                    await axios.delete(`${API_URL}/families/${familyId}/members/${targetUserId}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    showAlert({ title: 'Başarılı', message: 'Üye aileden çıkartıldı.', type: 'success' });
                    fetchMyFamily();
                } catch (e) {
                    const errorMsg = e.response?.data?.error || 'Üye çıkartılamadı.';
                    showAlert({ title: 'Hata', message: errorMsg, type: 'error' });
                }
            }
        });
    };

    const handleTransferLeadership = (targetUserId, targetName) => {
        showAlert({
            title: 'Liderliği Devret',
            message: `Aile liderliğini ${targetName} kullanıcısına devretmek istediğinize emin misiniz? Bu işlem geri alınamaz!`,
            type: 'warning',
            onConfirm: async () => {
                try {
                    const token = await AsyncStorage.getItem('token');
                    const familyId = myFamilyData.family.id;
                    await axios.post(`${API_URL}/families/${familyId}/transfer-leadership`, { targetUserId }, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    showAlert({ title: 'Başarılı', message: 'Liderlik başarıyla devredildi.', type: 'success' });
                    fetchMyFamily();
                } catch (e) {
                    const errorMsg = e.response?.data?.error || 'Liderlik devredilemedi.';
                    showAlert({ title: 'Hata', message: errorMsg, type: 'error' });
                }
            }
        });
    };

    const handleLeaveFamily = () => {
        const isLeader = myFamilyData.myRole === 'leader';
        showAlert({
            title: 'Aileden Ayrıl',
            message: isLeader 
                ? 'Lideri olduğunuz aileden ayrılmak üzeresiniz. Eğer ailede başka üyeler varsa önce liderliği devretmelisiniz. Ailede tek başınaysanız aile tamamen silinecektir. Devam edilsin mi?'
                : 'Bu aileden ayrılmak istediğinize emin misiniz?',
            type: 'warning',
            onConfirm: async () => {
                try {
                    const token = await AsyncStorage.getItem('token');
                    const familyId = myFamilyData.family.id;
                    await axios.delete(`${API_URL}/families/${familyId}/leave`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    showAlert({ title: 'Ayrıldınız', message: 'Aileden başarıyla ayrıldınız.', type: 'success' });
                    setMyFamilyData(null);
                    fetchMyFamily();
                } catch (e) {
                    const errorMsg = e.response?.data?.error || 'Ayrılma işlemi başarısız.';
                    showAlert({ title: 'Hata', message: errorMsg, type: 'error' });
                }
            }
        });
    };

    // Render list for not in family
    const renderFamilyItem = ({ item }) => {
        const hasApplied = false; // We can check locally if they already sent
        return (
            <View style={styles.familyListCard}>
                <Image source={{ uri: item.badge_url || 'https://via.placeholder.com/100' }} style={styles.familyListBadge} />
                <View style={styles.familyListInfo}>
                    <Text style={styles.familyListName}>{item.name}</Text>
                    <Text style={styles.familyListDesc} numberOfLines={1}>{item.description || 'Açıklama bulunmuyor.'}</Text>
                    <View style={styles.familyListStatsRow}>
                        <View style={styles.familyMiniPill}>
                            <Text style={styles.familyMiniPillText}>Lv.{item.level}</Text>
                        </View>
                        <Text style={styles.familyStatsText}>👥 {item.member_count} / {item.max_members}</Text>
                    </View>
                </View>
                <TouchableOpacity 
                    style={styles.familyJoinBtn}
                    onPress={() => handleApply(item.id)}
                    activeOpacity={0.8}
                >
                    <LinearGradient colors={['#ec4899', '#8b5cf6']} style={styles.joinBtnGradient}>
                        <Text style={styles.joinBtnText}>Katıl</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        );
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#ec4899" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <LinearGradient colors={['#08051A', '#160627', '#090014']} style={StyleSheet.absoluteFill} />

            {/* HEADER */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
                    <LinearGradient colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.03)']} style={styles.backBtnGradient}>
                        <Ionicons name="chevron-back" size={20} color="#fff" />
                    </LinearGradient>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Klan ve Aileler</Text>
                <TouchableOpacity 
                    onPress={() => showAlert({ 
                        title: 'Klan ve Aileler', 
                        message: 'Bir aileye katılarak günlük XP limitlerini zorlayın, görevleri tamamlayın ve haftalık sıralamada ödüller kazanın!', 
                        type: 'info' 
                    })}
                    style={styles.backBtn} 
                    activeOpacity={0.7}
                >
                    <LinearGradient colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.03)']} style={styles.backBtnGradient}>
                        <Ionicons name="information-circle-outline" size={20} color="#fff" />
                    </LinearGradient>
                </TouchableOpacity>
            </View>

            {myFamilyData === null ? (
                /* ─── NOT IN A FAMILY VIEW ─── */
                <View style={{ flex: 1 }}>
                    <ScrollView 
                        ref={scrollViewRef}
                        showsVerticalScrollIndicator={false} 
                        contentContainerStyle={{ paddingBottom: 60 }}
                    >


                        {/* Quick Action Cards */}
                        <View style={styles.quickActionsContainer}>
                            <TouchableOpacity 
                                style={styles.quickActionCard} 
                                onPress={() => setCreateModalVisible(true)}
                                activeOpacity={0.8}
                            >
                                <LinearGradient colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)']} style={styles.quickActionGradient}>
                                    <Ionicons name="add-circle" size={22} color="#FFB84D" />
                                    <Text style={styles.quickActionTitle}>Aile Kur</Text>
                                    <Text style={styles.quickActionDesc}>Kendi klanını yarat</Text>
                                </LinearGradient>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={styles.quickActionCard} 
                                onPress={() => searchInputRef.current?.focus()}
                                activeOpacity={0.8}
                            >
                                <LinearGradient colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)']} style={styles.quickActionGradient}>
                                    <Ionicons name="search" size={22} color="#00D6FF" />
                                    <Text style={styles.quickActionTitle}>Aile Ara</Text>
                                    <Text style={styles.quickActionDesc}>Filtrele ve bul</Text>
                                </LinearGradient>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={styles.quickActionCard} 
                                onPress={() => {
                                    // Scroll down to ranking section
                                    scrollViewRef.current?.scrollTo({ y: 340, animated: true });
                                }}
                                activeOpacity={0.8}
                            >
                                <LinearGradient colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)']} style={styles.quickActionGradient}>
                                    <Ionicons name="bar-chart" size={22} color="#FF3D8B" />
                                    <Text style={styles.quickActionTitle}>Sıralama</Text>
                                    <Text style={styles.quickActionDesc}>Haftanın liderleri</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>

                        {/* Search and Filters Area */}
                        <View style={styles.searchSectionWrapper}>
                            <View style={styles.searchBarContainer}>
                                <Ionicons name="search" size={18} color="rgba(255,255,255,0.5)" style={{ marginLeft: 14 }} />
                                <TextInput
                                    ref={searchInputRef}
                                    style={styles.searchInput}
                                    placeholder="Aile adı veya lider ara..."
                                    placeholderTextColor="rgba(255,255,255,0.35)"
                                    value={searchQuery}
                                    onChangeText={(text) => {
                                        setSearchQuery(text);
                                        fetchFamilies(text);
                                    }}
                                />
                                <TouchableOpacity style={styles.searchFilterBtn} activeOpacity={0.7}>
                                    <Ionicons name="options-outline" size={18} color="#FF3D8B" />
                                </TouchableOpacity>
                            </View>

                            {/* Horizontal Filters */}
                            <ScrollView 
                                horizontal 
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.filtersScrollContent}
                                style={{ marginTop: 4, marginBottom: 8 }}
                            >
                                {[
                                    { id: 'popular', label: 'Popüler', icon: 'flame-outline' },
                                    { id: 'new', label: 'Yeni', icon: 'sparkles-outline' },
                                    { id: 'high_level', label: 'Yüksek Seviye', icon: 'trending-up-outline' },
                                    { id: 'open', label: 'Açık Katılım', icon: 'lock-open-outline' },
                                    { id: 'weekly_best', label: 'Haftanın Enleri', icon: 'ribbon-outline' }
                                ].map((filter) => {
                                    const isSelected = selectedFilter === filter.id;
                                    return (
                                        <TouchableOpacity
                                            key={filter.id}
                                            style={[styles.filterChip, isSelected && styles.filterChipActive]}
                                            onPress={() => setSelectedFilter(filter.id)}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons name={filter.icon} size={12} color={isSelected ? '#fff' : 'rgba(255,255,255,0.6)'} style={{ marginRight: 5 }} />
                                            <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>{filter.label}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </View>

                        {/* Weekly Ranking Preview */}
                        <View style={styles.rankingPreviewSection}>
                            <View style={styles.sectionHeaderRow}>
                                <Text style={styles.sectionHeaderTitle}>Haftanın Enleri</Text>
                                <Ionicons name="trophy-outline" size={16} color="#FFB84D" />
                            </View>
                            
                            <View style={styles.rankingRowsWrapper}>
                                {DEMO_FAMILIES.map((fam, idx) => (
                                    <View key={fam.id} style={styles.rankMiniRow}>
                                        <View style={[styles.rankNumberCircle, idx === 0 ? styles.rank1Bg : idx === 1 ? styles.rank2Bg : styles.rank3Bg]}>
                                            <Text style={styles.rankNumberText}>{idx + 1}</Text>
                                        </View>
                                        <Image source={{ uri: fam.badge_url }} style={styles.rankAvatar} />
                                        <View style={styles.rankInfoBox}>
                                            <Text style={styles.rankFamilyName}>{fam.name}</Text>
                                            <Text style={styles.rankLeaderName}>Lider: {fam.leader_name}</Text>
                                        </View>
                                        <Text style={styles.rankLevelText}>Lv.{fam.level}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>

                        {/* Recommended Families */}
                        <View style={styles.listSection}>
                            <View style={styles.sectionHeaderRow}>
                                <Text style={styles.sectionHeaderTitle}>Önerilen Aileler</Text>
                                <TouchableOpacity onPress={() => searchInputRef.current?.focus()}>
                                    <Text style={styles.seeAllText}>Tümünü Gör</Text>
                                </TouchableOpacity>
                            </View>
                            
                            {(() => {
                                const items = searchQuery.trim() !== '' 
                                    ? familiesList 
                                    : DEMO_FAMILIES;

                                if (items.length === 0) {
                                    return (
                                        <View style={styles.emptyContainer}>
                                            <Ionicons name="sad-outline" size={44} color="rgba(255,255,255,0.15)" />
                                            <Text style={styles.emptyTitle}>Henüz uygun aile yok</Text>
                                            <Text style={styles.emptySubtitle}>İlk ailelerden birini kurarak sıralamada öne çıkabilirsin.</Text>
                                            <TouchableOpacity 
                                                style={styles.emptyCreateBtn}
                                                onPress={() => setCreateModalVisible(true)}
                                                activeOpacity={0.8}
                                            >
                                                <Text style={styles.emptyCreateBtnText}>Aile Kur</Text>
                                            </TouchableOpacity>
                                        </View>
                                    );
                                }

                                return items.map((item) => {
                                    const nextLvlXp = item.nextXp || 25000;
                                    const currentPoints = item.points || 18400;
                                    const progressPercent = Math.min(100, Math.max(5, (currentPoints / nextLvlXp) * 100));
                                    
                                    return (
                                        <View key={item.id || item.name} style={styles.familyPremiumCard}>
                                            <View style={styles.cardHeaderRow}>
                                                <Image source={{ uri: item.badge_url || 'https://via.placeholder.com/100' }} style={styles.cardBadge} />
                                                <View style={styles.cardMiddleInfo}>
                                                    <Text style={styles.cardFamilyName}>{item.name}</Text>
                                                    <Text style={styles.cardLeaderText}>Lider: {item.leader_name || item.leader?.username || 'Belirtilmemiş'}</Text>
                                                    
                                                    <View style={styles.cardSubStatsRow}>
                                                        <View style={styles.levelMiniBadge}>
                                                            <Text style={styles.levelMiniBadgeText}>Lv.{item.level}</Text>
                                                        </View>
                                                        <Text style={styles.cardMembersText}>👥 {item.member_count} / {item.max_members}</Text>
                                                    </View>
                                                </View>

                                                <View style={styles.cardRightColumn}>
                                                    {item.rank && (
                                                        <View style={styles.cardRankCircle}>
                                                            <Text style={styles.cardRankText}>#{item.rank}</Text>
                                                        </View>
                                                    )}
                                                    
                                                    <TouchableOpacity 
                                                        style={styles.cardJoinBtn}
                                                        onPress={() => handleApply(item.id)}
                                                        activeOpacity={0.8}
                                                    >
                                                        <LinearGradient colors={['#FF3D8B', '#7B2CFF']} style={styles.cardJoinBtnGradient}>
                                                            <Text style={styles.cardJoinText}>Katıl</Text>
                                                        </LinearGradient>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>

                                            {/* XP Progress Section */}
                                            <View style={styles.cardXpSection}>
                                                <View style={styles.cardXpTextRow}>
                                                    <Text style={styles.cardXpLabel}>XP İlerlemesi</Text>
                                                    <Text style={styles.cardXpVal}>{currentPoints.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")} / {nextLvlXp.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}</Text>
                                                </View>
                                                <View style={styles.cardXpTrack}>
                                                    <LinearGradient 
                                                        colors={['#FF3D8B', '#FFB84D']}
                                                        start={{ x: 0, y: 0 }}
                                                        end={{ x: 1, y: 0 }}
                                                        style={[styles.cardXpFill, { width: `${progressPercent}%` }]} 
                                                    />
                                                </View>
                                            </View>
                                        </View>
                                    );
                                });
                            })()}
                        </View>

                        {/* Integrated CTA: Create Family Inline Section */}
                        <View style={styles.ctaWrapper}>
                            <LinearGradient 
                                colors={['rgba(255, 184, 77, 0.12)', 'rgba(255, 61, 139, 0.05)']} 
                                style={styles.ctaContainer}
                            >
                                <View style={styles.ctaTextSection}>
                                    <View style={styles.ctaTitleRow}>
                                        <Ionicons name="flash" size={16} color="#FFB84D" />
                                        <Text style={styles.ctaTitle}>Kendi Aileni Kur</Text>
                                    </View>
                                    <Text style={styles.ctaSubtitle}>
                                        {currentUser?.is_agency_owner 
                                            ? 'İlk aileni ücretsiz kurabilirsin.' 
                                            : '5.000 Altın ile aileni oluştur. Ajans sahiplerine ilk aile ücretsiz.'}
                                    </Text>
                                </View>
                                <TouchableOpacity 
                                    style={styles.ctaButton}
                                    onPress={() => setCreateModalVisible(true)}
                                    activeOpacity={0.8}
                                >
                                    <LinearGradient colors={['#FFB84D', '#FF3D8B']} style={styles.ctaButtonGradient}>
                                        <Ionicons name="star" size={14} color="#fff" style={{ marginRight: 6 }} />
                                        <Text style={styles.ctaButtonText}>Kur</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </LinearGradient>
                        </View>
                    </ScrollView>
                </View>
            ) : (
                /* ─── FAMILY DASHBOARD VIEW (ALREADY IN FAMILY) ─── */
                <View style={{ flex: 1 }}>
                    {/* Family Header Summary Panel */}
                    <LinearGradient 
                        colors={['rgba(139, 92, 246, 0.12)', 'rgba(0, 0, 0, 0.25)']} 
                        style={styles.familyHeaderCard}
                    >
                        <Image source={{ uri: myFamilyData.family.badge_url }} style={styles.familyBadgeImage} />
                        <View style={styles.familyHeaderTextInfo}>
                            <View style={styles.familyTitleRow}>
                                <Text style={styles.familyName} numberOfLines={1}>{myFamilyData.family.name}</Text>
                                <LinearGradient colors={['#fbbf24', '#d97706']} style={styles.levelBadge}>
                                    <Text style={styles.levelBadgeText}>Lv.{myFamilyData.family.level}</Text>
                                </LinearGradient>
                            </View>
                            <Text style={styles.familyDescription} numberOfLines={2}>
                                {myFamilyData.family.description || 'Bu aile için herhangi bir açıklama girilmemiş.'}
                            </Text>
                            <Text style={styles.familyCountsText}>👥 Üye Limiti: {myFamilyData.family.member_count} / {myFamilyData.family.max_members}</Text>
                        </View>
                    </LinearGradient>

                    {/* Progress Bar (Level Progression) */}
                    <View style={styles.progressContainer}>
                        {(() => {
                            const currentPoints = myFamilyData.family.points;
                            const nextLvl = getNextLevelThreshold(currentPoints);
                            
                            const formatNum = (num) => num ? num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "0";

                            if (!nextLvl) {
                                return (
                                    <View>
                                        <View style={styles.xpRow}>
                                            <Text style={styles.xpLabel}>Maksimum Seviye (Level 8)</Text>
                                            <Text style={styles.xpValue}>{formatNum(currentPoints)} XP</Text>
                                        </View>
                                        <View style={styles.progressTrack}>
                                            <LinearGradient colors={['#fbbf24', '#f59e0b']} style={[styles.progressFill, { width: '100%' }]} />
                                        </View>
                                        <View style={styles.extraInfoRow}>
                                            <Text style={styles.extraInfoText}>Üye limiti: {myFamilyData.family.max_members}</Text>
                                        </View>
                                    </View>
                                );
                            }

                            const prevLvlXp = LEVEL_THRESHOLDS.find(l => l.level === myFamilyData.family.level)?.xp || 0;
                            const neededXpForNext = nextLvl.xp - prevLvlXp;
                            const earnedXpOnThisLvl = currentPoints - prevLvlXp;
                            const percent = Math.min(100, Math.max(0, (earnedXpOnThisLvl / neededXpForNext) * 100));
                            const nextLvlMaxMembers = nextLvl.maxMembers === 999999 ? "Sınırsız" : `${nextLvl.maxMembers} üye`;

                            return (
                                <View>
                                    <View style={styles.xpRow}>
                                        <Text style={styles.xpLabel}>Level İlerlemesi</Text>
                                        <Text style={styles.xpValue}>{formatNum(currentPoints)} / {formatNum(nextLvl.xp)} XP</Text>
                                    </View>
                                    <View style={styles.progressTrack}>
                                        <LinearGradient 
                                            colors={['#8b5cf6', '#ec4899']} 
                                            start={{x:0, y:0}} end={{x:1, y:0}}
                                            style={[styles.progressFill, { width: `${percent}%` }]} 
                                        />
                                    </View>
                                    <View style={styles.extraInfoRow}>
                                        <Text style={styles.extraInfoText}>Üye limiti: {myFamilyData.family.max_members}</Text>
                                        <Text style={styles.extraInfoText}>Sonraki seviye: {nextLvlMaxMembers}</Text>
                                    </View>
                                </View>
                            );
                        })()}
                    </View>

                    {/* Tab Navigation Menu */}
                    <View style={styles.tabBar}>
                        <TouchableOpacity 
                            style={[styles.tabItem, activeTab === 'members' && styles.activeTabItem]}
                            onPress={() => setActiveTab('members')}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.tabText, activeTab === 'members' && styles.activeTabText]}>Üyeler</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.tabItem, activeTab === 'chat' && styles.activeTabItem]}
                            onPress={() => setActiveTab('chat')}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.tabText, activeTab === 'chat' && styles.activeTabText]}>Sohbet</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.tabItem, activeTab === 'tasks' && styles.activeTabItem]}
                            onPress={() => setActiveTab('tasks')}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.tabText, activeTab === 'tasks' && styles.activeTabText]}>XP & Check-in</Text>
                        </TouchableOpacity>
                        {['leader', 'co_leader', 'officer'].includes(myFamilyData.myRole) && (
                            <TouchableOpacity 
                                style={[styles.tabItem, activeTab === 'manage' && styles.activeTabItem]}
                                onPress={() => setActiveTab('manage')}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.tabText, activeTab === 'manage' && styles.activeTabText]}>Yönetim</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* TAB CONTENTS */}
                    <View style={{ flex: 1 }}>
                        {activeTab === 'members' && (
                            /* ── Tab: Members List ── */
                            <FlatList
                                data={myFamilyData.members}
                                keyExtractor={(item) => item.user_id.toString()}
                                contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                                renderItem={({ item }) => {
                                    const isTargetMe = item.user_id === currentUser.id;
                                    const canActions = myFamilyData.myRole === 'leader' && !isTargetMe;

                                    return (
                                        <View style={styles.memberRow}>
                                            <Image source={{ uri: item.avatar_url || 'https://via.placeholder.com/80' }} style={styles.memberAvatar} />
                                            <View style={styles.memberInfo}>
                                                <Text style={styles.memberName}>{item.display_name || item.username}</Text>
                                                <LinearGradient 
                                                    colors={item.role === 'leader' ? ['#fbbf24', '#d97706'] : ['#8b5cf6', '#6d28d9']} 
                                                    style={styles.roleContainer}
                                                >
                                                    <Text style={styles.roleText}>{item.role.toUpperCase()}</Text>
                                                </LinearGradient>
                                            </View>
                                            <View style={styles.memberXpStats}>
                                                <Text style={styles.memberXpText}>+{item.daily_xp_contributed} XP</Text>
                                                <Text style={styles.memberTotalXpText}>Toplam: {item.total_xp_contributed} XP</Text>
                                            </View>
                                            
                                            {canActions && (
                                                <View style={styles.memberActionsRow}>
                                                    <TouchableOpacity 
                                                        style={styles.actionCircleBtn} 
                                                        onPress={() => handleTransferLeadership(item.user_id, item.display_name || item.username)}
                                                    >
                                                        <Ionicons name="key" size={12} color="#fbbf24" />
                                                    </TouchableOpacity>
                                                    <TouchableOpacity 
                                                        style={[styles.actionCircleBtn, { backgroundColor: 'rgba(239, 68, 68, 0.12)', borderColor: 'rgba(239,68,68,0.25)', borderWidth: 1 }]} 
                                                        onPress={() => handleKickMember(item.user_id, item.display_name || item.username)}
                                                    >
                                                        <Ionicons name="trash" size={12} color="#ef4444" />
                                                    </TouchableOpacity>
                                                </View>
                                            )}
                                        </View>
                                    );
                                }}
                            />
                        )}

                        {activeTab === 'chat' && (
                            /* ── Tab: Yazılı Grup Sohbeti ── */
                            <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                                <FlatList
                                    ref={chatFlatListRef}
                                    data={chatMessages}
                                    keyExtractor={(item) => item.id.toString()}
                                    contentContainerStyle={{ padding: 16 }}
                                    renderItem={({ item }) => {
                                        const isMe = item.sender_id === currentUser.id;
                                        return (
                                            <View style={[styles.msgWrapper, isMe ? styles.msgWrapperMe : styles.msgWrapperOther]}>
                                                {!isMe && (
                                                    <Image source={{ uri: item.avatar_url }} style={styles.chatAvatar} />
                                                )}
                                                <View style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleOther]}>
                                                    {!isMe && (
                                                        <Text style={styles.chatSenderName}>{item.display_name || item.username}</Text>
                                                    )}
                                                    <Text style={styles.chatMessageText}>{item.message}</Text>
                                                </View>
                                            </View>
                                        );
                                    }}
                                />
                                <View style={styles.chatInputContainer}>
                                    <TextInput
                                        style={styles.chatInput}
                                        placeholder="Aileye mesaj yaz..."
                                        placeholderTextColor="#6c6484"
                                        value={newMessageText}
                                        onChangeText={setNewMessageText}
                                    />
                                    <TouchableOpacity style={styles.sendChatBtn} onPress={handleSendMessage}>
                                        <Ionicons name="send" size={16} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {activeTab === 'tasks' && (
                            /* ── Tab: XP ve Check-in ── */
                            <ScrollView contentContainerStyle={{ padding: 20 }}>
                                <View style={styles.checkInContainer}>
                                    <Text style={styles.checkInTitle}>Günlük Check-in</Text>
                                    <Text style={styles.checkInSubtitle}>Günde bir kez check-in yaparak ailenize +10 XP puanı kazandırın.</Text>
                                    <TouchableOpacity 
                                        style={[styles.checkInBtn, checkedInToday && styles.checkInBtnDisabled]}
                                        onPress={handleDailyCheckIn}
                                        disabled={checkedInToday}
                                        activeOpacity={0.8}
                                    >
                                        <LinearGradient 
                                            colors={checkedInToday ? ['#374151', '#1f2937'] : ['#10b981', '#047857']} 
                                            style={styles.checkInBtnGradient}
                                        >
                                            <Text style={styles.checkInBtnText}>
                                                {checkedInToday ? 'Bugün Check-in Yapıldı' : 'Check-in Yap (+10 XP)'}
                                            </Text>
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </View>

                                {/* Daily limits */}
                                <View style={styles.dailyLimitCard}>
                                    <Text style={styles.limitTitle}>Günlük XP Katkı Limiti</Text>
                                    <Text style={styles.limitSubtitle}>Bir kullanıcının aileye günlük maksimum katkı sınırı: 500 XP.</Text>
                                    <View style={styles.limitProgressRow}>
                                        <Text style={styles.limitProgressLabel}>Senin Katkın</Text>
                                        <Text style={styles.limitProgressText}>{dailyContribution} / 500 XP</Text>
                                    </View>
                                    <View style={styles.limitProgressTrack}>
                                        <View style={[styles.limitProgressFill, { width: `${(dailyContribution / 500) * 100}%` }]} />
                                    </View>
                                </View>

                                <TouchableOpacity style={styles.leaveFamilyDangerBtn} onPress={handleLeaveFamily} activeOpacity={0.8}>
                                    <Text style={styles.leaveFamilyText}>Aileden Ayrıl</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        )}

                        {activeTab === 'manage' && (
                            /* ── Tab: Yönetim Paneli ── */
                            <ScrollView contentContainerStyle={{ padding: 20 }}>
                                <Text style={styles.sectionHeaderTitle}>Bekleyen Başvurular</Text>
                                {applications.length === 0 ? (
                                    <View style={styles.emptyContainer}>
                                        <Ionicons name="mail-open-outline" size={40} color="rgba(255,255,255,0.06)" />
                                        <Text style={styles.noApplicationsText}>Bekleyen bir katılım isteği bulunmamaktadır.</Text>
                                    </View>
                                ) : (
                                    applications.map(app => (
                                        <View key={app.id} style={styles.appRow}>
                                            <Image source={{ uri: app.avatar_url || 'https://via.placeholder.com/80' }} style={styles.appAvatar} />
                                            <Text style={styles.appName}>{app.display_name || app.username}</Text>
                                            <View style={styles.appActions}>
                                                <TouchableOpacity 
                                                    style={styles.appActionReject} 
                                                    onPress={() => handleResolveApplication(app.id, 'reject')}
                                                >
                                                    <Ionicons name="close" size={16} color="#fff" />
                                                </TouchableOpacity>
                                                <TouchableOpacity 
                                                    style={styles.appActionAccept} 
                                                    onPress={() => handleResolveApplication(app.id, 'accept')}
                                                >
                                                    <Ionicons name="checkmark" size={16} color="#fff" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ))
                                )}
                            </ScrollView>
                        )}
                    </View>
                </View>
            )}

            {/* ─── CREATE FAMILY MODAL ─── */}
            <Modal
                visible={createModalVisible}
                animationType="slide"
                transparent
                onRequestClose={() => setCreateModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setCreateModalVisible(false)} />
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Yeni Bir Aile Kur</Text>
                        <Text style={styles.modalSubtitle}>Klanınızı oluşturun ve üyelerinizi davet edin.</Text>

                        <Text style={styles.inputLabel}>Aile Adı</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="Aile adını yazın..."
                            placeholderTextColor="#6c6484"
                            value={familyName}
                            onChangeText={setFamilyName}
                            maxLength={30}
                        />

                        <Text style={styles.inputLabel}>Açıklama</Text>
                        <TextInput
                            style={[styles.modalInput, { height: 70, textAlignVertical: 'top', paddingTop: 8 }]}
                            placeholder="Ailenizi açıklayın..."
                            placeholderTextColor="#6c6484"
                            value={familyDesc}
                            onChangeText={setFamilyDesc}
                            multiline
                            maxLength={150}
                        />

                        <Text style={styles.inputLabel}>Badge URL (Logo Resim Adresi)</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="Resim linkini girin..."
                            placeholderTextColor="#6c6484"
                            value={familyBadge}
                            onChangeText={setFamilyBadge}
                        />

                        <Text style={styles.inputLabel}>Katılım Türü</Text>
                        <View style={styles.joinTypeRow}>
                            <TouchableOpacity 
                                style={[styles.joinTypeBtn, familyJoinType === 'approval_required' && styles.joinTypeBtnSelected]} 
                                onPress={() => setFamilyJoinType('approval_required')}
                            >
                                <Text style={[styles.joinTypeText, familyJoinType === 'approval_required' && styles.joinTypeTextSelected]}>Onay Gerekli</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.joinTypeBtn, familyJoinType === 'open' && styles.joinTypeBtnSelected]} 
                                onPress={() => setFamilyJoinType('open')}
                            >
                                <Text style={[styles.joinTypeText, familyJoinType === 'open' && styles.joinTypeTextSelected]}>Herkese Açık</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.joinTypeBtn, familyJoinType === 'invite_only' && styles.joinTypeBtnSelected]} 
                                onPress={() => setFamilyJoinType('invite_only')}
                            >
                                <Text style={[styles.joinTypeText, familyJoinType === 'invite_only' && styles.joinTypeTextSelected]}>Sadece Davet</Text>
                            </TouchableOpacity>
                        </View>

                        {submitting ? (
                            <ActivityIndicator size="large" color="#ec4899" style={{ marginTop: 24 }} />
                        ) : (
                            <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleCreateFamily}>
                                <LinearGradient colors={['#fbbf24', '#d97706']} style={styles.submitBtnGradient}>
                                    <Text style={styles.submitBtnText}>Aileyi Kur (5000 Altın)</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0c061a',
    },
    loadingText: {
        color: '#fff',
        marginTop: 12,
        fontWeight: 'bold',
        fontSize: 13,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 50,
        paddingBottom: 15,
        paddingHorizontal: 16,
        backgroundColor: 'rgba(12, 6, 26, 0.85)',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    backBtn: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    backBtnGradient: {
        width: 36,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    notInFamilyHero: {
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 36,
        paddingBottom: 28,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        marginBottom: 20,
    },
    heroBadgeBox: {
        width: 68,
        height: 68,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        shadowColor: '#8b5cf6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 6,
    },
    heroTitle: {
        color: '#fff',
        fontSize: 22,
        fontWeight: '900',
        marginBottom: 8,
        letterSpacing: 0.3,
    },
    heroSubtitle: {
        color: '#a39cb5',
        fontSize: 12,
        textAlign: 'center',
        lineHeight: 18,
        paddingHorizontal: 12,
    },
    searchBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.04)',
        marginHorizontal: 16,
        borderRadius: 18,
        height: 48,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 2,
    },
    searchInput: {
        flex: 1,
        color: '#fff',
        fontSize: 13,
        paddingHorizontal: 12,
    },
    listSection: {
        paddingHorizontal: 16,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
        gap: 12,
    },
    sectionHeaderTitle: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    sectionHeaderLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.06)',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
        gap: 10,
    },
    noFamilyText: {
        color: '#6c6484',
        fontSize: 12,
        textAlign: 'center',
    },
    familyListCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderRadius: 22,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    familyListBadge: {
        width: 52,
        height: 52,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    familyListInfo: {
        flex: 1,
        marginLeft: 14,
    },
    familyListName: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    familyListDesc: {
        color: '#8e85a6',
        fontSize: 11,
        marginTop: 3,
    },
    familyListStatsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        gap: 8,
    },
    familyMiniPill: {
        backgroundColor: 'rgba(236,72,153,0.12)',
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 8,
        borderWidth: 0.5,
        borderColor: 'rgba(236,72,153,0.2)',
    },
    familyMiniPillText: {
        color: '#ec4899',
        fontSize: 9,
        fontWeight: '900',
    },
    familyStatsText: {
        color: '#8e85a6',
        fontSize: 10,
        fontWeight: '500',
    },
    familyJoinBtn: {
        width: 70,
        height: 32,
        borderRadius: 10,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
    },
    joinBtnGradient: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    joinBtnText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '900',
    },
    createStickyContainer: {
        position: 'absolute',
        bottom: 16,
        left: 16,
        right: 16,
        borderRadius: 24,
        backgroundColor: 'rgba(12, 6, 26, 0.88)',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.08)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 14,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.4,
        shadowRadius: 15,
        elevation: 8,
    },
    createStickyTextContainer: {
        flex: 1,
    },
    createStickyTitle: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 0.3,
    },
    createStickyDesc: {
        color: '#8c849e',
        fontSize: 9,
        marginTop: 2,
    },
    createStickyBtn: {
        width: 76,
        height: 36,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    createStickyBtnGradient: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    createStickyBtnText: {
        color: '#5c2c06',
        fontSize: 12,
        fontWeight: '900',
    },
    familyHeaderCard: {
        flexDirection: 'row',
        padding: 18,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
    },
    familyBadgeImage: {
        width: 64,
        height: 64,
        borderRadius: 18,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    familyHeaderTextInfo: {
        flex: 1,
        marginLeft: 16,
    },
    familyTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    familyName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '900',
        flex: 1,
    },
    levelBadge: {
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 8,
        shadowColor: '#fbbf24',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 3,
    },
    levelBadgeText: {
        color: '#fff',
        fontSize: 9,
        fontWeight: '900',
    },
    familyDescription: {
        color: '#8e85a6',
        fontSize: 11,
        marginTop: 4,
        lineHeight: 16,
    },
    familyCountsText: {
        color: '#ec4899',
        fontSize: 10,
        fontWeight: '700',
        marginTop: 6,
    },
    progressContainer: {
        paddingHorizontal: 18,
        paddingVertical: 14,
        backgroundColor: 'rgba(255,255,255,0.01)',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    xpRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    xpLabel: {
        color: '#8e85a6',
        fontSize: 11,
        fontWeight: 'bold',
    },
    xpValue: {
        color: '#fbbf24',
        fontSize: 11,
        fontWeight: 'bold',
    },
    progressTrack: {
        height: 8,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 4,
    },
    extraInfoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        marginTop: 8,
    },
    extraInfoText: {
        color: '#6c6484',
        fontSize: 10,
        fontWeight: '600',
    },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: 'rgba(12, 6, 26, 0.4)',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    tabItem: {
        flex: 1,
        paddingVertical: 14,
        alignItems: 'center',
        borderBottomWidth: 2.5,
        borderBottomColor: 'transparent',
    },
    activeTabItem: {
        borderBottomColor: '#ec4899',
    },
    tabText: {
        color: '#6c6484',
        fontSize: 12,
        fontWeight: '800',
    },
    activeTabText: {
        color: '#fff',
    },
    memberRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.02)',
        padding: 14,
        borderRadius: 18,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.04)',
    },
    memberAvatar: {
        width: 42,
        height: 42,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    memberInfo: {
        flex: 1,
        marginLeft: 14,
    },
    memberName: {
        color: '#fff',
        fontSize: 13,
        fontWeight: 'bold',
    },
    roleContainer: {
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6,
        alignSelf: 'flex-start',
        marginTop: 4,
    },
    roleText: {
        color: '#fff',
        fontSize: 7,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    memberXpStats: {
        alignItems: 'flex-end',
        marginRight: 8,
    },
    memberXpText: {
        color: '#10b981',
        fontSize: 11,
        fontWeight: '800',
    },
    memberTotalXpText: {
        color: '#6c6484',
        fontSize: 9,
        marginTop: 2,
    },
    memberActionsRow: {
        flexDirection: 'row',
        gap: 6,
    },
    actionCircleBtn: {
        width: 26,
        height: 26,
        borderRadius: 8,
        backgroundColor: 'rgba(251,191,36,0.12)',
        borderColor: 'rgba(251,191,36,0.25)',
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    msgWrapper: {
        flexDirection: 'row',
        marginBottom: 14,
        maxWidth: '82%',
    },
    msgWrapperMe: {
        alignSelf: 'flex-end',
        justifyContent: 'flex-end',
    },
    msgWrapperOther: {
        alignSelf: 'flex-start',
        justifyContent: 'flex-start',
    },
    chatAvatar: {
        width: 32,
        height: 32,
        borderRadius: 10,
        marginRight: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    msgBubble: {
        padding: 12,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    msgBubbleMe: {
        backgroundColor: '#7c3aed',
        borderTopRightRadius: 2,
    },
    msgBubbleOther: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderTopLeftRadius: 2,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.04)',
    },
    chatSenderName: {
        color: '#ec4899',
        fontSize: 9,
        fontWeight: 'bold',
        marginBottom: 3,
    },
    chatMessageText: {
        color: '#fff',
        fontSize: 12.5,
        lineHeight: 18,
    },
    chatInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: 'rgba(12, 6, 26, 0.95)',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)',
    },
    chatInput: {
        flex: 1,
        height: 40,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        borderRadius: 14,
        paddingHorizontal: 14,
        color: '#fff',
        fontSize: 13,
    },
    sendChatBtn: {
        width: 40,
        height: 40,
        borderRadius: 14,
        backgroundColor: '#ec4899',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10,
    },
    checkInContainer: {
        backgroundColor: 'rgba(255,255,255,0.01)',
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
        marginBottom: 16,
    },
    checkInTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 0.3,
    },
    checkInSubtitle: {
        color: '#8e85a6',
        fontSize: 12,
        textAlign: 'center',
        marginTop: 6,
        lineHeight: 18,
    },
    checkInBtn: {
        width: '100%',
        height: 46,
        borderRadius: 16,
        overflow: 'hidden',
        marginTop: 18,
    },
    checkInBtnGradient: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkInBtnText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '900',
    },
    checkInBtnDisabled: {
        opacity: 0.4,
    },
    dailyLimitCard: {
        backgroundColor: 'rgba(255,255,255,0.01)',
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        marginBottom: 24,
    },
    limitTitle: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '900',
        letterSpacing: 0.3,
    },
    limitSubtitle: {
        color: '#8c849e',
        fontSize: 11,
        marginTop: 4,
        lineHeight: 17,
    },
    limitProgressRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 16,
        marginBottom: 6,
    },
    limitProgressLabel: {
        color: '#8e85a6',
        fontSize: 11,
        fontWeight: 'bold',
    },
    limitProgressText: {
        color: '#10b981',
        fontSize: 12,
        fontWeight: '900',
    },
    limitProgressTrack: {
        height: 6,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 3,
        overflow: 'hidden',
    },
    limitProgressFill: {
        height: '100%',
        backgroundColor: '#10b981',
        borderRadius: 3,
    },
    leaveFamilyDangerBtn: {
        backgroundColor: 'rgba(239, 68, 68, 0.05)',
        borderColor: 'rgba(239, 68, 68, 0.2)',
        borderWidth: 1,
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: 'center',
    },
    leaveFamilyText: {
        color: '#ef4444',
        fontSize: 13,
        fontWeight: 'bold',
    },
    noApplicationsText: {
        color: '#6c6484',
        fontSize: 12,
        textAlign: 'center',
    },
    appRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.02)',
        padding: 14,
        borderRadius: 18,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.04)',
    },
    appAvatar: {
        width: 38,
        height: 38,
        borderRadius: 12,
    },
    appName: {
        color: '#fff',
        fontSize: 13,
        fontWeight: 'bold',
        marginLeft: 12,
        flex: 1,
    },
    appActions: {
        flexDirection: 'row',
        gap: 8,
    },
    appActionReject: {
        width: 30,
        height: 30,
        borderRadius: 8,
        backgroundColor: '#ef4444',
        justifyContent: 'center',
        alignItems: 'center',
    },
    appActionAccept: {
        width: 30,
        height: 30,
        borderRadius: 8,
        backgroundColor: '#10b981',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.65)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '90%',
        backgroundColor: '#0f0724',
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 15,
        elevation: 10,
    },
    modalTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 0.3,
    },
    modalSubtitle: {
        color: '#8e85a6',
        fontSize: 12,
        marginTop: 4,
        marginBottom: 16,
    },
    inputLabel: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
        marginTop: 10,
        marginBottom: 6,
    },
    modalInput: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 12,
        height: 42,
        color: '#fff',
        paddingHorizontal: 12,
        fontSize: 13,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    joinTypeRow: {
        flexDirection: 'row',
        gap: 6,
        marginTop: 4,
    },
    joinTypeBtn: {
        flex: 1,
        height: 32,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.02)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    joinTypeBtnSelected: {
        backgroundColor: '#ec4899',
        borderColor: 'transparent',
    },
    joinTypeText: {
        color: '#8e85a6',
        fontSize: 10,
        fontWeight: 'bold',
    },
    joinTypeTextSelected: {
        color: '#fff',
    },
    modalSubmitBtn: {
        height: 46,
        borderRadius: 16,
        overflow: 'hidden',
        marginTop: 24,
    },
    submitBtnGradient: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    submitBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '900',
    },
    heroTextContent: {
        flex: 1,
        marginRight: 10,
    },
    heroMiniChipsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 14,
    },
    heroMiniChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.06)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
        gap: 4,
    },
    heroMiniChipText: {
        color: '#fff',
        fontSize: 9,
        fontWeight: 'bold',
    },
    heroRightBadge: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    heroShieldCircle: {
        width: 58,
        height: 58,
        borderRadius: 29,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#FF3D8B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 6,
    },
    quickActionsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        marginTop: 16,
        marginBottom: 20,
        gap: 8,
    },
    quickActionCard: {
        width: '31.5%',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    quickActionGradient: {
        padding: 14,
        alignItems: 'flex-start',
    },
    quickActionTitle: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '900',
        marginTop: 8,
        letterSpacing: 0.2,
    },
    quickActionDesc: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 9,
        marginTop: 2,
    },
    searchSectionWrapper: {
        marginBottom: 20,
    },
    searchFilterBtn: {
        paddingHorizontal: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    filtersScrollContent: {
        paddingHorizontal: 16,
        gap: 8,
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.04)',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    filterChipActive: {
        backgroundColor: '#FF3D8B',
        borderColor: 'transparent',
    },
    filterChipText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 11,
        fontWeight: 'bold',
    },
    filterChipTextActive: {
        color: '#fff',
    },
    rankingPreviewSection: {
        paddingHorizontal: 16,
        marginBottom: 24,
    },
    rankingRowsWrapper: {
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderRadius: 24,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        marginTop: 10,
    },
    rankMiniRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.03)',
    },
    rankNumberCircle: {
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    rank1Bg: {
        backgroundColor: '#FFD700',
    },
    rank2Bg: {
        backgroundColor: '#C0C0C0',
    },
    rank3Bg: {
        backgroundColor: '#CD7F32',
    },
    rankNumberText: {
        color: '#000',
        fontSize: 10,
        fontWeight: '900',
    },
    rankAvatar: {
        width: 32,
        height: 32,
        borderRadius: 10,
        marginRight: 12,
    },
    rankInfoBox: {
        flex: 1,
    },
    rankFamilyName: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    rankLeaderName: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 9,
        marginTop: 2,
    },
    rankLevelText: {
        color: '#FFB84D',
        fontSize: 11,
        fontWeight: '900',
    },
    seeAllText: {
        color: '#FF3D8B',
        fontSize: 12,
        fontWeight: 'bold',
    },
    familyPremiumCard: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 24,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    cardHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    cardBadge: {
        width: 52,
        height: 52,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    cardMiddleInfo: {
        flex: 1,
        marginLeft: 14,
    },
    cardFamilyName: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '900',
    },
    cardLeaderText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 10,
        marginTop: 2,
    },
    cardSubStatsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
        gap: 8,
    },
    levelMiniBadge: {
        backgroundColor: 'rgba(255, 184, 77, 0.12)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    levelMiniBadgeText: {
        color: '#FFB84D',
        fontSize: 8,
        fontWeight: '900',
    },
    cardMembersText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 10,
        fontWeight: 'bold',
    },
    cardRightColumn: {
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 6,
    },
    cardRankCircle: {
        backgroundColor: 'rgba(255, 61, 139, 0.12)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        alignSelf: 'flex-end',
    },
    cardRankText: {
        color: '#FF3D8B',
        fontSize: 9,
        fontWeight: '900',
    },
    cardJoinBtn: {
        width: 68,
        height: 30,
        borderRadius: 10,
        overflow: 'hidden',
    },
    cardJoinBtnGradient: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardJoinText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '900',
    },
    cardXpSection: {
        marginTop: 14,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.04)',
    },
    cardXpTextRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    cardXpLabel: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 9,
        fontWeight: 'bold',
    },
    cardXpVal: {
        color: '#FFB84D',
        fontSize: 9,
        fontWeight: '900',
    },
    cardXpTrack: {
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    cardXpFill: {
        height: '100%',
        borderRadius: 2,
    },
    ctaWrapper: {
        paddingHorizontal: 16,
        marginTop: 8,
        marginBottom: 20,
    },
    ctaContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: 24,
        padding: 18,
        borderWidth: 1.5,
        borderColor: 'rgba(255, 184, 77, 0.15)',
    },
    ctaTextSection: {
        flex: 1,
        marginRight: 12,
    },
    ctaTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    ctaTitle: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '900',
        letterSpacing: 0.2,
    },
    ctaSubtitle: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 10,
        marginTop: 4,
        lineHeight: 14,
    },
    ctaButton: {
        width: 72,
        height: 36,
        borderRadius: 12,
        overflow: 'hidden',
    },
    ctaButtonGradient: {
        width: '100%',
        height: '100%',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    ctaButtonText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '900',
    },
    emptyTitle: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '900',
        marginTop: 8,
    },
    emptySubtitle: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 11,
        textAlign: 'center',
        marginTop: 4,
        lineHeight: 16,
    },
    emptyCreateBtn: {
        marginTop: 14,
        backgroundColor: '#FF3D8B',
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 12,
    },
    emptyCreateBtnText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '900',
    }
});

