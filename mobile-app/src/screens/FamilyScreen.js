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
                <Text style={styles.loadingText}>Yükleniyor...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <LinearGradient colors={['#0f0720', '#110928']} style={StyleSheet.absoluteFill} />

            {/* HEADER */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Ailem (Birlik)</Text>
                <View style={{ width: 24 }} />
            </View>

            {myFamilyData === null ? (
                /* ─── NOT IN A FAMILY VIEW ─── */
                <View style={{ flex: 1 }}>
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                        {/* Intro Hero Section */}
                        <View style={styles.notInFamilyHero}>
                            <View style={styles.heroBadgeBox}>
                                <Ionicons name="people" size={40} color="#fff" />
                            </View>
                            <Text style={styles.heroTitle}>Bir Aileye Katıl!</Text>
                            <Text style={styles.heroSubtitle}>
                                Topluluk kur veya mevcut bir birliğe katılarak günlük XP'ler kazan, seviye atla ve özel haftalık bonuslar elde et.
                            </Text>
                        </View>

                        {/* Search Bar */}
                        <View style={styles.searchBarContainer}>
                            <Ionicons name="search" size={20} color="#8e85a6" style={{ marginLeft: 12 }} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Aile adı ara..."
                                placeholderTextColor="#8e85a6"
                                value={searchQuery}
                                onChangeText={(text) => {
                                    setSearchQuery(text);
                                    fetchFamilies(text);
                                }}
                            />
                        </View>

                        {/* Families list */}
                        <View style={styles.listSection}>
                            <Text style={styles.sectionHeaderTitle}>Önerilen Aileler</Text>
                            {familiesList.length === 0 ? (
                                <Text style={styles.noFamilyText}>Aradığınız kriterde aktif aile bulunamadı.</Text>
                            ) : (
                                <FlatList
                                    data={familiesList}
                                    renderItem={renderFamilyItem}
                                    keyExtractor={(item) => item.id.toString()}
                                    scrollEnabled={false}
                                />
                            )}
                        </View>
                    </ScrollView>

                    {/* Create Family Bottom Sticky Banner */}
                    <View style={styles.createStickyContainer}>
                        <View style={styles.createStickyTextContainer}>
                            <Text style={styles.createStickyTitle}>Kendi Aileni Kur ⚡</Text>
                            <Text style={styles.createStickyDesc}>Normal Üyelere 5.000 Altın, Ajans Sahiplerine Ücretsiz!</Text>
                        </View>
                        <TouchableOpacity 
                            style={styles.createStickyBtn} 
                            onPress={() => setCreateModalVisible(true)}
                            activeOpacity={0.8}
                        >
                            <LinearGradient colors={['#fbbf24', '#f59e0b']} style={styles.createStickyBtnGradient}>
                                <Text style={styles.createStickyBtnText}>Kur</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            ) : (
                /* ─── FAMILY DASHBOARD VIEW (ALREADY IN FAMILY) ─── */
                <View style={{ flex: 1 }}>
                    {/* Family Header Summary Panel */}
                    <View style={styles.familyHeaderCard}>
                        <Image source={{ uri: myFamilyData.family.badge_url }} style={styles.familyBadgeImage} />
                        <View style={styles.familyHeaderTextInfo}>
                            <View style={styles.familyTitleRow}>
                                <Text style={styles.familyName}>{myFamilyData.family.name}</Text>
                                <View style={styles.levelBadge}>
                                    <Text style={styles.levelBadgeText}>Lv.{myFamilyData.family.level}</Text>
                                </View>
                            </View>
                            <Text style={styles.familyDescription}>{myFamilyData.family.description || 'Açıklama girilmemiş.'}</Text>
                            <Text style={styles.familyCountsText}>👥 Üyeler: {myFamilyData.family.member_count} / {myFamilyData.family.max_members}</Text>
                        </View>
                    </View>

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
                                            <Text style={styles.xpLabel}>Level {myFamilyData.family.level}</Text>
                                            <Text style={styles.xpValue}>{formatNum(currentPoints)} XP (Max Seviye)</Text>
                                        </View>
                                        <View style={styles.progressTrack}>
                                            <View style={[styles.progressFill, { width: '100%' }]} />
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
                                        <Text style={styles.xpLabel}>Level {myFamilyData.family.level}</Text>
                                        <Text style={styles.xpValue}>{formatNum(currentPoints)} / {formatNum(nextLvl.xp)} XP</Text>
                                    </View>
                                    <View style={styles.progressTrack}>
                                        <View style={[styles.progressFill, { width: `${percent}%` }]} />
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
                        >
                            <Text style={[styles.tabText, activeTab === 'members' && styles.activeTabText]}>Üyeler</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.tabItem, activeTab === 'chat' && styles.activeTabItem]}
                            onPress={() => setActiveTab('chat')}
                        >
                            <Text style={[styles.tabText, activeTab === 'chat' && styles.activeTabText]}>Sohbet</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.tabItem, activeTab === 'tasks' && styles.activeTabItem]}
                            onPress={() => setActiveTab('tasks')}
                        >
                            <Text style={[styles.tabText, activeTab === 'tasks' && styles.activeTabText]}>XP & Check-in</Text>
                        </TouchableOpacity>
                        {['leader', 'co_leader', 'officer'].includes(myFamilyData.myRole) && (
                            <TouchableOpacity 
                                style={[styles.tabItem, activeTab === 'manage' && styles.activeTabItem]}
                                onPress={() => setActiveTab('manage')}
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
                                                <View style={styles.roleContainer}>
                                                    <Text style={styles.roleText}>{item.role.toUpperCase()}</Text>
                                                </View>
                                            </View>
                                            <View style={styles.memberXpStats}>
                                                <Text style={styles.memberXpText}>Günlük: +{item.daily_xp_contributed} XP</Text>
                                                <Text style={styles.memberTotalXpText}>Toplam: {item.total_xp_contributed} XP</Text>
                                            </View>
                                            
                                            {canActions && (
                                                <View style={styles.memberActionsRow}>
                                                    <TouchableOpacity 
                                                        style={styles.actionCircleBtn} 
                                                        onPress={() => handleTransferLeadership(item.user_id, item.display_name || item.username)}
                                                    >
                                                        <Ionicons name="key" size={14} color="#fbbf24" />
                                                    </TouchableOpacity>
                                                    <TouchableOpacity 
                                                        style={[styles.actionCircleBtn, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]} 
                                                        onPress={() => handleKickMember(item.user_id, item.display_name || item.username)}
                                                    >
                                                        <Ionicons name="trash" size={14} color="#ef4444" />
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
                            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.01)' }}>
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
                                        placeholder="Bir şeyler yaz..."
                                        placeholderTextColor="#8e85a6"
                                        value={newMessageText}
                                        onChangeText={setNewMessageText}
                                    />
                                    <TouchableOpacity style={styles.sendChatBtn} onPress={handleSendMessage}>
                                        <Ionicons name="send" size={18} color="#fff" />
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
                                            colors={checkedInToday ? ['#4b5563', '#374151'] : ['#10b981', '#059669']} 
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
                                        <Text style={styles.limitProgressText}>{dailyContribution} / 500 XP</Text>
                                    </View>
                                    <View style={styles.limitProgressTrack}>
                                        <View style={[styles.limitProgressFill, { width: `${(dailyContribution / 500) * 100}%` }]} />
                                    </View>
                                </View>

                                <TouchableOpacity style={styles.leaveFamilyDangerBtn} onPress={handleLeaveFamily}>
                                    <Text style={styles.leaveFamilyText}>Aileden Ayrıl</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        )}

                        {activeTab === 'manage' && (
                            /* ── Tab: Yönetim Paneli ── */
                            <ScrollView contentContainerStyle={{ padding: 20 }}>
                                <Text style={styles.sectionHeaderTitle}>Bekleyen Başvurular</Text>
                                {applications.length === 0 ? (
                                    <Text style={styles.noApplicationsText}>Bekleyen bir katılım isteği bulunmamaktadır.</Text>
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
                                                    <Ionicons name="close" size={18} color="#fff" />
                                                </TouchableOpacity>
                                                <TouchableOpacity 
                                                    style={styles.appActionAccept} 
                                                    onPress={() => handleResolveApplication(app.id, 'accept')}
                                                >
                                                    <Ionicons name="checkmark" size={18} color="#fff" />
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
                            placeholderTextColor="#8e85a6"
                            value={familyName}
                            onChangeText={setFamilyName}
                            maxLength={30}
                        />

                        <Text style={styles.inputLabel}>Açıklama</Text>
                        <TextInput
                            style={[styles.modalInput, { height: 80, textAlignVertical: 'top' }]}
                            placeholder="Ailenizi açıklayın..."
                            placeholderTextColor="#8e85a6"
                            value={familyDesc}
                            onChangeText={setFamilyDesc}
                            multiline
                            maxLength={150}
                        />

                        <Text style={styles.inputLabel}>Badge URL (Logo Resim Adresi)</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="Resim linkini girin..."
                            placeholderTextColor="#8e85a6"
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
                                <LinearGradient colors={['#fbbf24', '#f59e0b']} style={styles.submitBtnGradient}>
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
        backgroundColor: '#0f0720',
    },
    loadingText: {
        color: '#fff',
        marginTop: 12,
        fontWeight: 'bold',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 50,
        paddingBottom: 15,
        paddingHorizontal: 16,
        backgroundColor: '#110928',
    },
    backBtn: {
        padding: 4,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '900',
    },
    notInFamilyHero: {
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 32,
    },
    heroBadgeBox: {
        width: 80,
        height: 80,
        borderRadius: 24,
        backgroundColor: 'rgba(139, 92, 246, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 1.5,
        borderColor: '#8b5cf6',
    },
    heroTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '900',
        marginBottom: 8,
    },
    heroSubtitle: {
        color: '#8e85a6',
        fontSize: 12,
        textAlign: 'center',
        lineHeight: 18,
        paddingHorizontal: 10,
    },
    searchBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        marginHorizontal: 16,
        borderRadius: 16,
        height: 48,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        marginBottom: 20,
    },
    searchInput: {
        flex: 1,
        color: '#fff',
        fontSize: 14,
        paddingHorizontal: 12,
    },
    listSection: {
        paddingHorizontal: 16,
    },
    sectionHeaderTitle: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '900',
        marginBottom: 12,
    },
    noFamilyText: {
        color: '#8e85a6',
        fontSize: 12,
        textAlign: 'center',
        marginTop: 20,
    },
    familyListCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderRadius: 20,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    familyListBadge: {
        width: 50,
        height: 50,
        borderRadius: 14,
    },
    familyListInfo: {
        flex: 1,
        marginLeft: 12,
    },
    familyListName: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    familyListDesc: {
        color: '#8e85a6',
        fontSize: 11,
        marginTop: 2,
    },
    familyListStatsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
        gap: 8,
    },
    familyMiniPill: {
        backgroundColor: 'rgba(236,72,153,0.15)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    familyMiniPillText: {
        color: '#ec4899',
        fontSize: 8,
        fontWeight: '900',
    },
    familyStatsText: {
        color: '#8e85a6',
        fontSize: 10,
    },
    familyJoinBtn: {
        width: 64,
        height: 32,
        borderRadius: 10,
        overflow: 'hidden',
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
        bottom: 0,
        width: '100%',
        backgroundColor: '#110928',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.08)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    createStickyTextContainer: {
        flex: 1,
    },
    createStickyTitle: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '900',
    },
    createStickyDesc: {
        color: '#8e85a6',
        fontSize: 9,
        marginTop: 2,
    },
    createStickyBtn: {
        width: 80,
        height: 36,
        borderRadius: 12,
        overflow: 'hidden',
    },
    createStickyBtnGradient: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    createStickyBtnText: {
        color: '#78350f',
        fontSize: 13,
        fontWeight: '900',
    },
    familyHeaderCard: {
        flexDirection: 'row',
        padding: 16,
        backgroundColor: '#110928',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
    },
    familyBadgeImage: {
        width: 60,
        height: 60,
        borderRadius: 16,
    },
    familyHeaderTextInfo: {
        flex: 1,
        marginLeft: 14,
    },
    familyTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    levelBadge: {
        backgroundColor: '#fbbf24',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    levelBadgeText: {
        color: '#78350f',
        fontSize: 9,
        fontWeight: '900',
    },
    familyDescription: {
        color: '#8e85a6',
        fontSize: 11,
        marginTop: 3,
    },
    familyCountsText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '600',
        marginTop: 6,
    },
    progressContainer: {
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    xpRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
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
        height: 6,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#fbbf24',
        borderRadius: 3,
    },
    extraInfoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        marginTop: 6,
    },
    extraInfoText: {
        color: '#8e85a6',
        fontSize: 10,
        fontWeight: '500',
    },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: '#110928',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    tabItem: {
        flex: 1,
        paddingVertical: 14,
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    activeTabItem: {
        borderBottomColor: '#ec4899',
    },
    tabText: {
        color: '#8e85a6',
        fontSize: 12,
        fontWeight: '700',
    },
    activeTabText: {
        color: '#fff',
    },
    memberRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.01)',
        padding: 12,
        borderRadius: 16,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.04)',
    },
    memberAvatar: {
        width: 40,
        height: 40,
        borderRadius: 12,
    },
    memberInfo: {
        flex: 1,
        marginLeft: 12,
    },
    memberName: {
        color: '#fff',
        fontSize: 13,
        fontWeight: 'bold',
    },
    roleContainer: {
        backgroundColor: 'rgba(139,92,246,0.15)',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 4,
        alignSelf: 'flex-start',
        marginTop: 4,
    },
    roleText: {
        color: '#8b5cf6',
        fontSize: 8,
        fontWeight: '900',
    },
    memberXpStats: {
        alignItems: 'flex-end',
        marginRight: 6,
    },
    memberXpText: {
        color: '#10b981',
        fontSize: 10,
        fontWeight: '700',
    },
    memberTotalXpText: {
        color: '#8e85a6',
        fontSize: 9,
        marginTop: 2,
    },
    memberActionsRow: {
        flexDirection: 'row',
        gap: 6,
    },
    actionCircleBtn: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(251,191,36,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    msgWrapper: {
        flexDirection: 'row',
        marginBottom: 12,
        maxWidth: '80%',
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
    },
    msgBubble: {
        padding: 10,
        borderRadius: 14,
    },
    msgBubbleMe: {
        backgroundColor: '#8b5cf6',
        borderTopRightRadius: 2,
    },
    msgBubbleOther: {
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderTopLeftRadius: 2,
    },
    chatSenderName: {
        color: '#ec4899',
        fontSize: 9,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    chatMessageText: {
        color: '#fff',
        fontSize: 12,
    },
    chatInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#110928',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)',
    },
    chatInput: {
        flex: 1,
        height: 38,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        paddingHorizontal: 12,
        color: '#fff',
        fontSize: 13,
    },
    sendChatBtn: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: '#ec4899',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10,
    },
    checkInContainer: {
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        alignItems: 'center',
        marginBottom: 16,
    },
    checkInTitle: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '900',
    },
    checkInSubtitle: {
        color: '#8e85a6',
        fontSize: 11,
        textAlign: 'center',
        marginTop: 6,
        lineHeight: 16,
    },
    checkInBtn: {
        width: '100%',
        height: 44,
        borderRadius: 16,
        overflow: 'hidden',
        marginTop: 16,
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
        opacity: 0.5,
    },
    dailyLimitCard: {
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        marginBottom: 24,
    },
    limitTitle: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '900',
    },
    limitSubtitle: {
        color: '#8e85a6',
        fontSize: 11,
        marginTop: 4,
        lineHeight: 16,
    },
    limitProgressRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 14,
        marginBottom: 6,
    },
    limitProgressText: {
        color: '#10b981',
        fontSize: 12,
        fontWeight: '900',
    },
    limitProgressTrack: {
        height: 6,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 3,
        overflow: 'hidden',
    },
    limitProgressFill: {
        height: '100%',
        backgroundColor: '#10b981',
        borderRadius: 3,
    },
    leaveFamilyDangerBtn: {
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        borderColor: '#ef4444',
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
        color: '#8e85a6',
        fontSize: 12,
        textAlign: 'center',
        marginTop: 20,
    },
    appRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.02)',
        padding: 12,
        borderRadius: 16,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.04)',
    },
    appAvatar: {
        width: 36,
        height: 36,
        borderRadius: 10,
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
        width: 28,
        height: 28,
        borderRadius: 8,
        backgroundColor: '#ef4444',
        justifyContent: 'center',
        alignItems: 'center',
    },
    appActionAccept: {
        width: 28,
        height: 28,
        borderRadius: 8,
        backgroundColor: '#10b981',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '90%',
        backgroundColor: '#110928',
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    modalTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '900',
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
        backgroundColor: 'rgba(255,255,255,0.05)',
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
        backgroundColor: 'rgba(255,255,255,0.04)',
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
        height: 44,
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
        color: '#78350f',
        fontSize: 13,
        fontWeight: '900',
    },
});
