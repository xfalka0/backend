import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Dimensions, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import VipFrame from '../components/ui/VipFrame';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';
import GradientText from '../components/ui/GradientText';

const { width } = Dimensions.get('window');

const MOCK_LEADERBOARD = [
    { id: '1', name: 'Selenay', score: '50,420', level: 5, avatar: 'https://i.pravatar.cc/150?u=1', rank: 1 },
    { id: '2', name: 'Karsu', score: '42,150', level: 4, avatar: 'https://i.pravatar.cc/150?u=2', rank: 2 },
    { id: '3', name: 'İnci', score: '38,900', level: 3, avatar: 'https://i.pravatar.cc/150?u=3', rank: 3 },
    { id: '4', name: 'Fatmanu...', score: '25,400', level: 2, avatar: 'https://i.pravatar.cc/150?u=4', rank: 4 },
    { id: '5', name: 'Hatice', score: '22,100', level: 1, avatar: 'https://i.pravatar.cc/150?u=5', rank: 5 },
    { id: '6', name: 'Ada', score: '19,500', level: 0, avatar: 'https://i.pravatar.cc/150?u=6', rank: 6 },
    { id: '7', name: 'asiye', score: '15,200', level: 0, avatar: 'https://i.pravatar.cc/150?u=7', rank: 7 },
];

export default function LeaderboardScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const { theme, themeMode } = useTheme();
    const [activeTab, setActiveTab] = useState('Haftalık');
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLeaderboard();
    }, [activeTab]);

    const fetchLeaderboard = async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('token');
            const res = await axios.get(`${API_URL}/discovery?tab=Tümü`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = res.data?.data || res.data || [];
            
            // Sadece kadınları ve admin panelinden oluşturulanları (operator) filtrele
            let females = data.filter(op => {
                const g = (op.gender || '').toLowerCase();
                const isFemale = g === 'female' || g === 'kadin' || g === 'kadın' || g === 'woman';
                const isOperator = op.role === 'operator';
                return isFemale && isOperator;
            });

            // Gerçek operatörlere puan ekle
            const withScores = females.map((op, i) => ({
                id: op.id || String(i),
                name: op.name || op.username || 'Gizli',
                avatar: op.avatar_url || 'https://i.pravatar.cc/150?u=' + i,
                level: op.vip_level || Math.floor(Math.random() * 5),
                score: Math.floor(Math.random() * 40000) + 10000 // random score
            }));
            
            withScores.sort((a, b) => b.score - a.score);
            
            const ranked = withScores.map((op, index) => ({
                ...op,
                rank: index + 1,
                score: op.score.toLocaleString('tr-TR')
            }));
            
            setLeaderboard(ranked);
        } catch(e) {
            console.log('Leaderboard error:', e);
            setLeaderboard(MOCK_LEADERBOARD);
        } finally {
            setLoading(false);
        }
    };

    const renderTopThree = () => {
        if (leaderboard.length < 3) return null;
        const topThree = leaderboard.slice(0, 3);
        return (
            <View style={styles.topThreeContainer}>
                {/* Second Place */}
                <View style={[styles.topThreeItem, { marginTop: 40 }]}>
                    <View style={styles.avatarWrapper}>
                        <VipFrame level={topThree[1].level} avatar={topThree[1].avatar} size={75} isStatic={true} />
                        <View style={[styles.rankBadge, { backgroundColor: '#c0c0c0', borderColor: '#e2e8f0' }]}>
                            <Text style={styles.rankText}>2</Text>
                        </View>
                    </View>
                    <Text style={[styles.topName, { color: theme.colors.text }]} numberOfLines={1}>{topThree[1].name}</Text>
                    <View style={styles.scorePill}>
                        <Ionicons name="star" size={12} color="#f59e0b" />
                        <Text style={styles.topScore}>{topThree[1].score}</Text>
                    </View>
                </View>

                {/* First Place */}
                <View style={[styles.topThreeItem, { zIndex: 10 }]}>
                    <View style={styles.avatarWrapper}>
                        {/* Glow effect for 1st place */}
                        <View style={styles.firstPlaceGlow} />
                        <VipFrame level={topThree[0].level} avatar={topThree[0].avatar} size={100} isStatic={true} />
                        <View style={[styles.rankBadge, { backgroundColor: '#fbbf24', borderColor: '#fef3c7', width: 34, height: 34, bottom: -10 }]}>
                            <FontAwesome5 name="crown" size={16} color="#78350f" />
                        </View>
                    </View>
                    <Text style={[styles.topName, { color: theme.colors.text, fontSize: 18, marginTop: 8 }]} numberOfLines={1}>{topThree[0].name}</Text>
                    <View style={[styles.scorePill, { backgroundColor: 'rgba(251, 191, 36, 0.2)', paddingHorizontal: 12, paddingVertical: 4 }]}>
                        <Ionicons name="star" size={14} color="#fbbf24" />
                        <Text style={[styles.topScore, { color: '#fbbf24', fontSize: 14, fontWeight: '900' }]}>{topThree[0].score}</Text>
                    </View>
                </View>

                {/* Third Place */}
                <View style={[styles.topThreeItem, { marginTop: 50 }]}>
                    <View style={styles.avatarWrapper}>
                        <VipFrame level={topThree[2].level} avatar={topThree[2].avatar} size={65} isStatic={true} />
                        <View style={[styles.rankBadge, { backgroundColor: '#cd7f32', borderColor: '#fef3c7' }]}>
                            <Text style={styles.rankText}>3</Text>
                        </View>
                    </View>
                    <Text style={[styles.topName, { color: theme.colors.text }]} numberOfLines={1}>{topThree[2].name}</Text>
                    <View style={styles.scorePill}>
                        <Ionicons name="star" size={12} color="#f59e0b" />
                        <Text style={styles.topScore}>{topThree[2].score}</Text>
                    </View>
                </View>
            </View>
        );
    };

    const renderItem = ({ item }) => {
        if (item.rank <= 3) return null;
        return (
            <View style={[styles.listItem, { backgroundColor: 'rgba(255, 255, 255, 0.03)', borderColor: 'rgba(255,255,255,0.1)' }]}>
                <Text style={[styles.listRank, { color: 'rgba(255,255,255,0.5)' }]}>{item.rank}</Text>
                <VipFrame level={item.level} avatar={item.avatar} size={50} isStatic={true} />
                <View style={styles.listInfo}>
                    <Text style={[styles.listName, { color: theme.colors.text }]}>{item.name}</Text>
                    <Text style={[styles.listLevel, { color: theme.colors.textSecondary }]}>Level {item.level}</Text>
                </View>
                <View style={styles.listScoreContainer}>
                    <Text style={[styles.listScore, { color: theme.colors.primary }]}>{item.score}</Text>
                    <Ionicons name="star" size={14} color="#f59e0b" style={{ marginLeft: 6 }} />
                </View>
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.bgWrapper}>
                <Image 
                    source={require('../../assets/fiva_profile_banner.png')} 
                    style={styles.backgroundImage}
                />
                <LinearGradient
                    colors={
                        themeMode === 'dark'
                            ? ['rgba(9, 2, 26, 0.1)', 'rgba(9, 2, 26, 0.7)', theme.colors.background]
                            : ['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.7)', theme.colors.background]
                    }
                    style={StyleSheet.absoluteFill}
                />
            </View>

            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Liderlik Tablosu</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={[styles.tabContainer, { justifyContent: 'space-between' }]}>
                <View style={{ flexDirection: 'row', gap: 20, alignItems: 'center', marginHorizontal: 20 }}>
                    {['Günlük', 'Haftalık', 'Tüm Zamanlar'].map(tab => {
                        const isActive = activeTab === tab;
                        return (
                            <TouchableOpacity
                                key={tab}
                                onPress={() => setActiveTab(tab)}
                                style={styles.tab}
                                activeOpacity={0.75}
                            >
                                {isActive ? (
                                    <GradientText
                                        colors={['#a855f7', '#ec4899']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={[styles.tabText, styles.activeTabText]}
                                    >
                                        {tab}
                                    </GradientText>
                                ) : (
                                    <Text style={[
                                        styles.tabText, 
                                        styles.inactiveTabText,
                                        { 
                                            color: themeMode === 'dark' ? 'rgba(255, 255, 255, 0.4)' : '#64748B' 
                                        }
                                    ]}>
                                        {tab}
                                    </Text>
                                )}
                                {isActive && (
                                    <LinearGradient
                                        colors={['#a855f7', '#ec4899']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={styles.tabIndicator}
                                    />
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={leaderboard}
                    renderItem={renderItem}
                    keyExtractor={item => String(item.id)}
                    ListHeaderComponent={renderTopThree}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            )}
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
        paddingBottom: 20,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '900',
    },
    backButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabContainer: {
        marginBottom: 20,
    },
    tab: {
        alignItems: 'center',
    },
    tabText: {
        fontSize: 18,
        letterSpacing: -0.3,
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    activeTabText: {
        fontWeight: '900',
        fontSize: 19,
    },
    inactiveTabText: {
        fontWeight: '700',
    },
    tabIndicator: {
        width: 30,
        height: 5,
        borderRadius: 3,
        marginTop: 6,
    },
    bgWrapper: {
        position: 'absolute',
        width: '100%',
        height: 400,
    },
    backgroundImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    topThreeContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'flex-end',
        paddingVertical: 30,
        marginBottom: 20,
    },
    topThreeItem: {
        alignItems: 'center',
        width: width / 3.5,
    },
    avatarWrapper: {
        position: 'relative',
        marginBottom: 10,
    },
    rankBadge: {
        position: 'absolute',
        top: -5,
        left: -5,
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        zIndex: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
        elevation: 3,
    },
    rankText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '900',
    },
    topName: {
        fontSize: 14,
        fontWeight: '800',
        marginBottom: 6,
        marginTop: 4,
    },
    scorePill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
        gap: 4,
    },
    topScore: {
        fontSize: 12,
        fontWeight: '800',
        color: '#e2e8f0',
    },
    firstPlaceGlow: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(251, 191, 36, 0.2)',
        top: -10,
        left: -10,
        zIndex: -1,
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 24,
        marginBottom: 12,
        borderWidth: 1,
    },
    listRank: {
        width: 30,
        fontSize: 18,
        fontWeight: '900',
        textAlign: 'center',
        marginRight: 10,
    },
    listInfo: {
        flex: 1,
        marginLeft: 15,
    },
    listName: {
        fontSize: 16,
        fontWeight: '800',
    },
    listLevel: {
        fontSize: 12,
        marginTop: 2,
    },
    listScoreContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    listScore: {
        fontSize: 15,
        fontWeight: '900',
    },
});
