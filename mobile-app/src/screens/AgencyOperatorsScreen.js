import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Dimensions,
    SafeAreaView,
    StatusBar,
    RefreshControl,
    Image,
    Alert,
    TextInput,
    ActivityIndicator,
    Modal,
    Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as Haptics from 'expo-haptics';

import { API_URL } from '../config';
import { useTheme } from '../contexts/ThemeContext';
import GlassCard from '../components/ui/GlassCard';
import { resolveImageUrl } from '../utils/imageUtils';

const { width } = Dimensions.get('window');

const WEEKS = [
    { label: 'Mevcut Hafta', offset: 0 },
    { label: 'Geçen Hafta', offset: 1 },
    { label: '2 Hafta Önce', offset: 2 },
    { label: '3 Hafta Önce', offset: 3 }
];

const getWeekDateRangeStr = (offset) => {
    const today = new Date();
    const day = today.getDay();
    const diffToMonday = today.getDate() - day + (day === 0 ? -6 : 1);
    
    const monday = new Date(today.getFullYear(), today.getMonth(), diffToMonday - (offset * 7));
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
    
    const format = (d) => {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        return `${dd}/${mm}`;
    };
    
    return `${format(monday)} - ${format(sunday)}`;
};

function OperatorDetailsModal({ visible, op, onClose, onRemove }) {
    if (!op) return null;

    const [imageError, setImageError] = useState(false);
    useEffect(() => {
        setImageError(false);
    }, [op]);

    const resolvedUrl = op.avatar_url ? resolveImageUrl(op.avatar_url) : null;
    const hasAvatar = resolvedUrl && !imageError;

    const formattedDate = op.joined_at 
        ? new Date(op.joined_at).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : 'Bilinmiyor';

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.detailsBackdrop}>
                <GlassCard intensity={60} tint="dark" style={styles.detailsCard}>
                    {/* Header */}
                    <View style={styles.detailsHeader}>
                        <View style={styles.detailsAvatarContainer}>
                            {hasAvatar ? (
                                <Image
                                    source={{ uri: resolvedUrl }}
                                    style={styles.detailsAvatar}
                                    onError={() => setImageError(true)}
                                />
                            ) : (
                                <View style={styles.detailsAvatarPlaceholder}>
                                    <Ionicons name="person" size={40} color="rgba(255, 255, 255, 0.4)" />
                                </View>
                            )}
                            <View style={[
                                styles.detailsOnlineDot, 
                                { backgroundColor: op.is_online ? '#10b981' : '#64748b' }
                            ]} />
                        </View>
                        <Text style={styles.detailsName} numberOfLines={1}>
                            {op.display_name || op.username}
                        </Text>
                        <View style={styles.detailsIdBadge}>
                            <Text style={styles.detailsIdText}>ID: {op.id}</Text>
                        </View>
                    </View>

                    {/* Stats Rows */}
                    <View style={styles.detailsStatsGrid}>
                        <View style={styles.detailsStatRow}>
                            <View style={styles.detailsStatIconBox}>
                                <Ionicons name="calendar-outline" size={18} color="#a855f7" />
                            </View>
                            <View style={styles.detailsStatContent}>
                                <Text style={styles.detailsStatLabel}>Katılım Tarihi</Text>
                                <Text style={styles.detailsStatValue}>{formattedDate}</Text>
                            </View>
                        </View>

                        <View style={styles.detailsStatRow}>
                            <View style={styles.detailsStatIconBox}>
                                <Ionicons name="star" size={18} color="#fbbf24" />
                            </View>
                            <View style={styles.detailsStatContent}>
                                <Text style={styles.detailsStatLabel}>Rating Puanı</Text>
                                <Text style={styles.detailsStatValue}>{parseFloat(op.rating || 5.0).toFixed(1)} / 5.0</Text>
                            </View>
                        </View>

                        <View style={styles.detailsStatRow}>
                            <View style={styles.detailsStatIconBox}>
                                <Ionicons name="sparkles" size={18} color="#f59e0b" />
                            </View>
                            <View style={styles.detailsStatContent}>
                                <Text style={styles.detailsStatLabel}>Bugünkü Gelir</Text>
                                <Text style={styles.detailsStatValue}>{op.today_commission || 0} Elmas</Text>
                            </View>
                        </View>

                        <View style={styles.detailsStatRow}>
                            <View style={styles.detailsStatIconBox}>
                                <Ionicons name="wallet-outline" size={18} color="#10b981" />
                            </View>
                            <View style={styles.detailsStatContent}>
                                <Text style={styles.detailsStatLabel}>Haftalık Gelir</Text>
                                <Text style={styles.detailsStatValue}>
                                    {op.weekly_commission || 0} Elmas (${((op.weekly_commission || 0) / 2000).toFixed(2)})
                                </Text>
                            </View>
                        </View>

                        <View style={styles.detailsStatRow}>
                            <View style={styles.detailsStatIconBox}>
                                <Ionicons name="radio-button-on-outline" size={18} color={op.is_online ? '#10b981' : '#94a3b8'} />
                            </View>
                            <View style={styles.detailsStatContent}>
                                <Text style={styles.detailsStatLabel}>Durum</Text>
                                <Text style={[styles.detailsStatValue, { color: op.is_online ? '#10b981' : '#cbd5e1' }]}>
                                    {op.is_online ? 'Çevrimiçi' : 'Çevrimdışı'}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {op.is_low_quality ? (
                        <View style={styles.detailsWarning}>
                            <Ionicons name="warning-outline" size={16} color="#fbbf24" style={{ marginRight: 6 }} />
                            <Text style={styles.detailsWarningText}>Yayıncı kalitesi düşük seviyede!</Text>
                        </View>
                    ) : null}

                    {/* Actions */}
                    <View style={styles.detailsActions}>
                        <TouchableOpacity style={[styles.detailsBtn, styles.detailsCloseBtn]} onPress={onClose}>
                            <Text style={styles.detailsCloseText}>Kapat</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.detailsBtn, styles.detailsRemoveBtn]} onPress={() => {
                            onClose();
                            onRemove(op.id, op.display_name || op.username);
                        }}>
                            <Text style={styles.detailsRemoveText}>Ajanstan Çıkar</Text>
                        </TouchableOpacity>
                    </View>
                </GlassCard>
            </View>
        </Modal>
    );
}

function OperatorCard({ op, handleRemoveOperator, selectedWeek, onPressDetails }) {
    const [imageError, setImageError] = useState(false);
    const { theme } = useTheme();
    const shortId = String(op.id).slice(-9).toUpperCase();
    
    const resolvedUrl = op.avatar_url ? resolveImageUrl(op.avatar_url) : null;
    const hasAvatar = resolvedUrl && !imageError;

    const formattedDate = op.joined_at 
        ? new Date(op.joined_at).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : 'Bilinmiyor';

    return (
        <GlassCard
            intensity={25}
            tint="dark"
            style={styles.opCardPremium}
            colors={['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.01)']}
        >
            <View style={styles.opRowPremium}>
                {/* Avatar Left */}
                <View style={styles.avatarWrapperPremium}>
                    {hasAvatar ? (
                        <Image
                            source={{ uri: resolvedUrl }}
                            style={styles.avatarPremium}
                            onError={() => setImageError(true)}
                        />
                    ) : (
                        <View style={styles.avatarPlaceholderPremium}>
                            <Ionicons name="person" size={28} color="rgba(255, 255, 255, 0.4)" />
                        </View>
                    )}
                    <View style={[
                        styles.onlineIndicatorPremium, 
                        { backgroundColor: op.is_online ? '#10b981' : '#64748b' }
                    ]} />
                </View>

                {/* Details Right */}
                <View style={styles.detailsColPremium}>
                    <View style={styles.detailRowPremium}>
                        <Text style={styles.detailLabelPremium}>Ad :</Text>
                        <Text style={styles.detailValuePremium}>{op.display_name || op.username}</Text>
                    </View>
                    {selectedWeek === 0 && (
                        <View style={styles.detailRowPremium}>
                            <Text style={styles.detailLabelPremium}>Bugün :</Text>
                            <Text style={styles.detailValueDiamondsPremium}>{op.today_commission || 0} 💎</Text>
                        </View>
                    )}
                    <View style={styles.detailRowPremium}>
                        <Text style={styles.detailLabelPremium}>Haftalık Gelir :</Text>
                        <Text style={styles.detailValueDiamondsPremium}>
                            {op.weekly_commission || 0} 💎 (${((op.weekly_commission || 0) / 2000).toFixed(2)})
                        </Text>
                    </View>
                    <View style={styles.detailRowPremium}>
                        <Text style={styles.detailLabelPremium}>Katılım Tarihi :</Text>
                        <Text style={styles.detailValuePremium}>{formattedDate}</Text>
                    </View>

                    {/* Bottom Action Row */}
                    <View style={styles.bottomRowPremium}>
                        <View style={styles.idBadgePremium}>
                            <Text style={styles.idBadgeTextPremium}>ID:{shortId}</Text>
                        </View>
                        
                        <View style={styles.actionButtonsRow}>
                            <TouchableOpacity
                                style={styles.removeBtnPremium}
                                activeOpacity={0.7}
                                onPress={() => handleRemoveOperator(op.id, op.display_name || op.username)}
                            >
                                <Ionicons name="trash-outline" size={16} color="#f43f5e" />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.actionBtnPremium}
                                activeOpacity={0.8}
                                onPress={() => onPressDetails(op)}
                            >
                                <LinearGradient
                                    colors={['#a855f7', '#ec4899']}
                                    style={styles.actionBtnGradient}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                >
                                    <Text style={styles.actionBtnText}>Detaylar</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </View>
        </GlassCard>
    );
}

export default function AgencyOperatorsScreen() {
    const navigation = useNavigation();
    const route = useRoute();
    const { theme, themeMode } = useTheme();

    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [operators, setOperators] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [commissionRate, setCommissionRate] = useState(0.40);
    const [selectedWeek, setSelectedWeek] = useState(0);
    const [selectedOperatorForDetails, setSelectedOperatorForDetails] = useState(null);

    const fetchOperators = async (weekOffset = selectedWeek) => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) return;

            const res = await axios.get(`${API_URL}/agency/my-dashboard?weekOffset=${weekOffset}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (res.data) {
                setOperators(res.data.operators || []);
                setCommissionRate(res.data.agency?.commission_rate || 0.40);
            }
        } catch (error) {
            console.error('[AgencyOperators] Fetch error:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOperators(selectedWeek);
    }, [selectedWeek]);

    const onRefresh = async () => {
        setRefreshing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await fetchOperators(selectedWeek);
        setRefreshing(false);
    };

    const handleRemoveOperator = async (operatorId, operatorName) => {
        Alert.alert(
            'Yayıncıyı Çıkar',
            `"${operatorName}" adlı yayıncıyı ajansınızdan çıkarmak istediğinize emin misiniz?`,
            [
                { text: 'İptal', style: 'cancel' },
                { 
                    text: 'Evet, Çıkar', 
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const token = await AsyncStorage.getItem('token');
                            if (!token) return;

                            const res = await axios.post(`${API_URL}/agency/remove-operator`, {
                                operatorId
                            }, {
                                headers: { Authorization: `Bearer ${token}` }
                            });

                            if (res.data && res.data.success) {
                                Alert.alert('Başarılı', 'Yayıncı ajansınızdan başarıyla çıkarıldı.');
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                fetchOperators(); // Refresh
                            } else {
                                Alert.alert('Hata', res.data?.error || 'Yayıncı çıkarılamadı.');
                            }
                        } catch (error) {
                            console.error('[AgencyOperators] Remove error:', error);
                            Alert.alert('Hata', 'Bir hata oluştu, yayıncı çıkarılamadı.');
                        }
                    }
                }
            ]
        );
    };

    const filteredOperators = operators.filter(op => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return true;
        const name = (op.display_name || op.username || '').toLowerCase();
        const shortId = String(op.id).slice(-9).toUpperCase().toLowerCase();
        const fullId = String(op.id).toLowerCase();
        return name.includes(query) || shortId.includes(query) || fullId.includes(query);
    });

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            
            {/* Header Background */}
            <View style={styles.bgWrapper}>
                <Image 
                    source={require('../../assets/fiva_profile_banner.png')} 
                    style={styles.backgroundImage}
                />
                <LinearGradient
                    colors={
                        themeMode === 'dark'
                            ? ['rgba(9, 2, 26, 0.1)', 'rgba(9, 2, 26, 0.6)', '#09021a']
                            : ['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.6)', '#09021a']
                    }
                    style={StyleSheet.absoluteFill}
                />
            </View>

            <SafeAreaView style={styles.safeArea}>
                {/* Header Row */}
                <View style={styles.headerRow}>
                    <TouchableOpacity 
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <Text style={styles.headerLabel}>AJANS YÖNETİMİ</Text>
                        <View style={styles.titleWithBadgeRow}>
                            <Text style={styles.headerTitle} numberOfLines={1}>
                                Yayıncılar Listesi
                            </Text>
                            <View style={styles.publisherCountBadge}>
                                <Text style={styles.publisherCountBadgeText}>
                                    {operators.length}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                {loading ? (
                    <View style={styles.loaderContainer}>
                        <ActivityIndicator size="large" color="#a855f7" />
                        <Text style={styles.loaderText}>Yayıncılar Yükleniyor...</Text>
                    </View>
                ) : (
                    <View style={{ flex: 1 }}>
                        {/* Search Bar */}
                        {operators.length > 0 && (
                            <View style={styles.searchBarContainer}>
                                <Ionicons name="search" size={18} color="rgba(255, 255, 255, 0.4)" style={{ marginRight: 8 }} />
                                <TextInput
                                    style={styles.searchBarInput}
                                    placeholder="Yayıncı adı veya ID ile ara..."
                                    placeholderTextColor="rgba(255, 255, 255, 0.4)"
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                                {searchQuery.length > 0 && (
                                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                                        <Ionicons name="close-circle" size={18} color="rgba(255, 255, 255, 0.4)" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}

                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.scrollContent}
                            refreshControl={
                                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#9333ea" />
                            }
                        >
                            {/* Haftalık Seçim Filtresi */}
                            <View style={[styles.weekSelectorContainer, { marginBottom: 15 }]}>
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.weekSelectorScroll}
                                >
                                    {WEEKS.map((w) => {
                                        const isActive = selectedWeek === w.offset;
                                        return (
                                            <TouchableOpacity
                                                key={w.offset}
                                                style={[
                                                    styles.weekPill,
                                                    isActive && styles.weekPillActive
                                                ]}
                                                activeOpacity={0.8}
                                                onPress={() => {
                                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                    setSelectedWeek(w.offset);
                                                }}
                                            >
                                                <Text style={[
                                                    styles.weekPillText,
                                                    isActive && styles.weekPillTextActive
                                                ]}>
                                                    {w.label}
                                                </Text>
                                                <Text style={[
                                                    styles.weekPillSubtext,
                                                    isActive && styles.weekPillSubtextActive
                                                ]}>
                                                    {getWeekDateRangeStr(w.offset)}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            </View>

                            {filteredOperators.length === 0 ? (
                                <View style={styles.emptyCard}>
                                    <Ionicons name="people-outline" size={64} color="rgba(255, 255, 255, 0.2)" />
                                    <Text style={styles.emptyText}>
                                        {searchQuery ? 'Arama sonucu yayıncı bulunamadı.' : 'Henüz ajansınıza bağlı bir yayıncı bulunmamaktadır.'}
                                    </Text>
                                </View>
                            ) : (
                                filteredOperators.map((op) => (
                                    <OperatorCard 
                                        key={op.id} 
                                        op={op} 
                                        handleRemoveOperator={handleRemoveOperator} 
                                        selectedWeek={selectedWeek}
                                        onPressDetails={(operator) => setSelectedOperatorForDetails(operator)}
                                    />
                                ))
                            )}
                            <View style={{ height: 60 }} />
                        </ScrollView>
                    </View>
                )}
            </SafeAreaView>

            {/* Operator Details Modal */}
            <OperatorDetailsModal
                visible={selectedOperatorForDetails !== null}
                op={selectedOperatorForDetails}
                onClose={() => setSelectedOperatorForDetails(null)}
                onRemove={handleRemoveOperator}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#09021a'
    },
    weekSelectorContainer: {
        marginTop: 10,
        marginBottom: 5,
    },
    weekSelectorScroll: {
        paddingRight: 20,
        gap: 8,
    },
    weekPill: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 8,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 110,
    },
    weekPillActive: {
        backgroundColor: 'rgba(147, 51, 234, 0.2)',
        borderColor: '#a855f7',
    },
    weekPillText: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.6)',
        fontWeight: '700',
    },
    weekPillTextActive: {
        color: '#fff',
        fontWeight: '800',
    },
    weekPillSubtext: {
        fontSize: 9,
        color: 'rgba(255, 255, 255, 0.35)',
        fontWeight: '600',
        marginTop: 2,
    },
    weekPillSubtextActive: {
        color: '#c084fc',
        fontWeight: '700',
    },
    safeArea: {
        flex: 1
    },
    bgWrapper: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 250,
        zIndex: 0,
        overflow: 'hidden'
    },
    backgroundImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 15 : 15,
        paddingBottom: 15,
        zIndex: 10
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15
    },
    headerTitleContainer: {
        flex: 1
    },
    headerLabel: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 1.5
    },
    titleWithBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
        gap: 10,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 22,
        fontWeight: '950',
        letterSpacing: -0.5,
    },
    publisherCountBadge: {
        backgroundColor: 'rgba(147, 51, 234, 0.2)',
        borderWidth: 1,
        borderColor: 'rgba(147, 51, 234, 0.4)',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 3,
    },
    publisherCountBadgeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '800',
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    loaderText: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 14,
        fontWeight: '700',
        marginTop: 15
    },
    searchBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        marginHorizontal: 20,
        marginTop: 10,
        marginBottom: 15,
        borderRadius: 14,
        paddingHorizontal: 12,
        height: 44,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    searchBarInput: {
        flex: 1,
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '600',
        paddingVertical: 0,
    },
    scrollContent: {
        paddingHorizontal: 20,
    },
    emptyCard: {
        padding: 30,
        paddingVertical: 50,
        borderRadius: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
        marginTop: 20
    },
    emptyText: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 14,
        fontWeight: '700',
        textAlign: 'center',
        marginTop: 15,
        lineHeight: 20
    },
    opCardPremium: {
        padding: 12,
        borderRadius: 16,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    opRowPremium: {
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center',
    },
    avatarWrapperPremium: {
        position: 'relative',
    },
    avatarPremium: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    avatarPlaceholderPremium: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    onlineIndicatorPremium: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 2.5,
        borderColor: '#09021a',
    },
    detailsColPremium: {
        flex: 1,
        gap: 3,
    },
    detailRowPremium: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    detailLabelPremium: {
        fontSize: 11,
        color: 'rgba(255, 255, 255, 0.5)',
        fontWeight: '600',
    },
    detailValuePremium: {
        fontSize: 11,
        color: '#ffffff',
        fontWeight: '700',
        textAlign: 'right',
    },
    detailValueDiamondsPremium: {
        fontSize: 11,
        color: '#fbbf24',
        fontWeight: '800',
        textAlign: 'right',
    },
    bottomRowPremium: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
    },
    idBadgePremium: {
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    idBadgeTextPremium: {
        fontSize: 9,
        color: 'rgba(255, 255, 255, 0.7)',
        fontWeight: '700',
    },
    actionButtonsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    actionBtnPremium: {
        borderRadius: 10,
        overflow: 'hidden',
    },
    actionBtnGradient: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionBtnText: {
        color: '#ffffff',
        fontSize: 11,
        fontWeight: '800',
    },
    removeBtnPremium: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: 'rgba(244, 63, 94, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(244, 63, 94, 0.25)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    detailsBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(5, 2, 15, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    detailsCard: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 28,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
    },
    detailsHeader: {
        alignItems: 'center',
        marginBottom: 20,
        width: '100%',
    },
    detailsAvatarContainer: {
        position: 'relative',
        marginBottom: 12,
    },
    detailsAvatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 2,
        borderColor: 'rgba(139, 92, 246, 0.5)',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    detailsAvatarPlaceholder: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 2,
        borderColor: 'rgba(139, 92, 246, 0.5)',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    detailsOnlineDot: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 3,
        borderColor: '#09021a',
    },
    detailsName: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '900',
        letterSpacing: -0.5,
        textAlign: 'center',
    },
    detailsIdBadge: {
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 3,
        marginTop: 6,
    },
    detailsIdText: {
        fontSize: 11,
        color: 'rgba(255, 255, 255, 0.7)',
        fontWeight: '700',
    },
    detailsStatsGrid: {
        width: '100%',
        gap: 12,
        marginBottom: 20,
    },
    detailsStatRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        padding: 12,
        gap: 12,
    },
    detailsStatIconBox: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    detailsStatContent: {
        flex: 1,
    },
    detailsStatLabel: {
        color: 'rgba(255, 255, 255, 0.4)',
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
    detailsStatValue: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '800',
        marginTop: 1,
    },
    detailsWarning: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(251, 191, 36, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(251, 191, 36, 0.2)',
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginBottom: 20,
        width: '100%',
    },
    detailsWarningText: {
        color: '#fbbf24',
        fontSize: 11,
        fontWeight: '700',
    },
    detailsActions: {
        flexDirection: 'row',
        width: '100%',
        gap: 12,
    },
    detailsBtn: {
        flex: 1,
        height: 46,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    detailsCloseBtn: {
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.04)',
    },
    detailsCloseText: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: 13,
        fontWeight: '800',
    },
    detailsRemoveBtn: {
        backgroundColor: 'rgba(244, 63, 94, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(244, 63, 94, 0.3)',
    },
    detailsRemoveText: {
        color: '#f43f5e',
        fontSize: 13,
        fontWeight: '800',
    }
});
