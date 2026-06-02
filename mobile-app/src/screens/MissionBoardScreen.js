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
    RefreshControl
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as Haptics from 'expo-haptics';

import { API_URL } from '../config';
import { useTheme } from '../contexts/ThemeContext';
import GlassCard from '../components/ui/GlassCard';
import { useAppStore } from '../store/useAppStore';

const { width } = Dimensions.get('window');

export default function MissionBoardScreen() {
    const navigation = useNavigation();
    const { theme } = useTheme();
    
    // Connect Zustand Store
    const user = useAppStore(state => state.user);
    const balance = useAppStore(state => state.balance);
    const syncBalanceWithServer = useAppStore(state => state.syncBalanceWithServer);

    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState({
        messagesSent: 24,
        imagesSent: 1,
        giftsReceived: 0,
        todayEarnings: 104.40,
    });

    const DAILY_MISSIONS = [
        {
            id: 'msg_50',
            title: 'Günde 50 Mesaj Gönder',
            description: 'Erkek kullanıcılar ile sohbet et ve mesaj sınırına ulaş.',
            icon: 'chatbubbles-outline',
            current: stats.messagesSent,
            target: 50,
            reward: 150, // Diamonds
        },
        {
            id: 'img_3',
            title: '3 Kilitli Fotoğraf Gönder',
            description: 'Sohbette kilitli fotoğraf gönder ve kilidin açılmasını sağla.',
            icon: 'image-outline',
            current: stats.imagesSent,
            target: 3,
            reward: 300,
        },
        {
            id: 'gift_1',
            title: '1 Hediye Al',
            description: 'Sohbet sırasında erkek kullanıcılardan hediye kabul et.',
            icon: 'gift-outline',
            current: stats.giftsReceived,
            target: 1,
            reward: 500,
        }
    ];

    const fetchMissionStats = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) return;

            // Fetch actual operator stats from backend
            const res = await axios.get(`${API_URL}/operators/my/stats`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (res.data) {
                // Ensure daily aggregates are mapped
                setStats({
                    messagesSent: parseInt(res.data.messages_sent || 0),
                    imagesSent: parseInt(res.data.image_count || 0),
                    giftsReceived: parseInt(res.data.gift_count || 0),
                    todayEarnings: parseFloat(res.data.coins_earned || 0),
                });
            }
            await syncBalanceWithServer();
        } catch (error) {
            console.error('[MissionBoard] Fetch stats error:', error);
        }
    };

    useEffect(() => {
        fetchMissionStats();
    }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await fetchMissionStats();
        setRefreshing(false);
    };

    const handleClaimReward = (mission) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        alert(`Tebrikler! "${mission.title}" görevinin ödülü olan ${mission.reward} Elmas hesabınıza eklendi.`);
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            
            {/* Ambient Purple Backdrop Layer */}
            <LinearGradient
                colors={['#7c3aed', '#ec4899', '#09021a']}
                style={styles.headerBackdrop}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <Ionicons name="sparkles" size={300} color="rgba(255, 255, 255, 0.03)" style={styles.watermark} />
            </LinearGradient>

            <SafeAreaView style={styles.safeArea}>
                {/* Custom Screen Header */}
                <View style={styles.headerRow}>
                    <View>
                        <Text style={styles.headerLabel}>GÖREV PANOSU</Text>
                        <Text style={styles.headerTitle}>Bugünün Görevleri</Text>
                    </View>
                    <TouchableOpacity 
                        style={styles.walletBadge}
                        onPress={() => navigation.navigate('Wallet')}
                    >
                        <Ionicons name="diamond" size={16} color="#db2777" style={{ marginRight: 6 }} />
                        <Text style={styles.walletText}>{Math.floor(balance).toLocaleString()}</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ec4899" />
                    }
                >
                    {/* Performance Score Glass Card */}
                    <GlassCard intensity={30} tint="dark" style={styles.scoreCard}>
                        <View style={styles.scoreRow}>
                            <View style={styles.circularIndicator}>
                                <LinearGradient
                                    colors={['#ec4899', '#8b5cf6']}
                                    style={styles.circularProgress}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                >
                                    <View style={styles.circularInner}>
                                        <Text style={styles.progressPercent}>
                                            {Math.round(
                                                (DAILY_MISSIONS.reduce((sum, m) => sum + Math.min(m.current, m.target), 0) /
                                                DAILY_MISSIONS.reduce((sum, m) => sum + m.target, 0)) * 100
                                            )}%
                                        </Text>
                                        <Text style={styles.progressSub}>Tamamlandı</Text>
                                    </View>
                                </LinearGradient>
                            </View>

                            <View style={styles.scoreStats}>
                                <Text style={styles.todayTitle}>Bugünkü Kazanç</Text>
                                <Text style={styles.todayCoins}>{stats.todayEarnings.toFixed(1)} <Text style={styles.coinSuffix}>ELMAS</Text></Text>
                                <Text style={styles.earningsEstimate}>≈ ${(stats.todayEarnings / 2000).toFixed(2)} USD</Text>
                            </View>
                        </View>
                    </GlassCard>

                    {/* Missions Section */}
                    <Text style={styles.sectionTitle}>Görev Listesi</Text>
                    
                    {DAILY_MISSIONS.map((mission) => {
                        const isCompleted = mission.current >= mission.target;
                        const progressPercent = Math.min(1, mission.current / mission.target);

                        return (
                            <GlassCard key={mission.id} intensity={20} tint="dark" style={styles.missionCard}>
                                <View style={styles.missionHeader}>
                                    <View style={[styles.iconBox, { backgroundColor: isCompleted ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)' }]}>
                                        <Ionicons 
                                            name={mission.icon} 
                                            size={20} 
                                            color={isCompleted ? '#10b981' : 'rgba(255, 255, 255, 0.7)'} 
                                        />
                                    </View>
                                    <View style={styles.missionTitleWrapper}>
                                        <Text style={[styles.missionTitle, isCompleted && styles.completedText]}>{mission.title}</Text>
                                        <Text style={styles.missionDesc}>{mission.description}</Text>
                                    </View>
                                    <View style={styles.rewardBadge}>
                                        <Text style={styles.rewardText}>+{mission.reward}</Text>
                                        <Ionicons name="diamond" size={10} color="#db2777" style={{ marginLeft: 2 }} />
                                    </View>
                                </View>

                                {/* Progress Bar */}
                                <View style={styles.progressTrack}>
                                    <View style={[styles.progressBar, { width: `${progressPercent * 100}%`, backgroundColor: isCompleted ? '#10b981' : '#ec4899' }]} />
                                </View>

                                <View style={styles.missionFooter}>
                                    <Text style={styles.progressStatusText}>
                                        İlerleme: {mission.current} / {mission.target}
                                    </Text>
                                    
                                    {isCompleted ? (
                                        <TouchableOpacity 
                                            style={styles.claimButton}
                                            onPress={() => handleClaimReward(mission)}
                                        >
                                            <Text style={styles.claimButtonText}>ÖDÜLÜ AL</Text>
                                        </TouchableOpacity>
                                    ) : (
                                        <Text style={styles.ongoingText}>Devam Ediyor</Text>
                                    )}
                                </View>
                            </GlassCard>
                        );
                    })}

                    <View style={{ height: 120 }} />
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#09021a'
    },
    safeArea: {
        flex: 1
    },
    headerBackdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 280,
        zIndex: 0
    },
    watermark: {
        position: 'absolute',
        top: -50,
        right: -50
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        zIndex: 10
    },
    headerLabel: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1.5
    },
    headerTitle: {
        color: '#fff',
        fontSize: 22,
        fontWeight: '900',
        letterSpacing: -0.5,
        marginTop: 2
    },
    walletBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.35)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)'
    },
    walletText: {
        color: '#fff',
        fontWeight: '900',
        fontSize: 13
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 10
    },
    scoreCard: {
        padding: 20,
        borderRadius: 30,
        marginBottom: 25,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)'
    },
    scoreRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 20
    },
    circularIndicator: {
        width: 100,
        height: 100,
        borderRadius: 50,
        overflow: 'hidden',
        padding: 3,
        backgroundColor: 'rgba(255, 255, 255, 0.05)'
    },
    circularProgress: {
        flex: 1,
        borderRadius: 47,
        justifyContent: 'center',
        alignItems: 'center'
    },
    circularInner: {
        width: 82,
        height: 82,
        borderRadius: 41,
        backgroundColor: '#09021a',
        justifyContent: 'center',
        alignItems: 'center'
    },
    progressPercent: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '900'
    },
    progressSub: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 8,
        fontWeight: '700',
        textTransform: 'uppercase',
        marginTop: 1
    },
    scoreStats: {
        flex: 1
    },
    todayTitle: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase'
    },
    todayCoins: {
        color: '#fff',
        fontSize: 28,
        fontWeight: '900',
        letterSpacing: -0.5,
        marginTop: 2
    },
    coinSuffix: {
        fontSize: 12,
        color: '#ec4899',
        fontWeight: '800'
    },
    earningsEstimate: {
        color: 'rgba(255, 255, 255, 0.4)',
        fontSize: 12,
        fontWeight: '700',
        marginTop: 2
    },
    sectionTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '900',
        marginBottom: 15,
        letterSpacing: -0.2
    },
    missionCard: {
        padding: 16,
        borderRadius: 24,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)'
    },
    missionHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12
    },
    iconBox: {
        width: 36,
        height: 36,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center'
    },
    missionTitleWrapper: {
        flex: 1
    },
    missionTitle: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '800'
    },
    completedText: {
        color: '#10b981'
    },
    missionDesc: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 11,
        marginTop: 2,
        lineHeight: 14
    },
    rewardBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(219, 39, 119, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8
    },
    rewardText: {
        color: '#db2777',
        fontSize: 10,
        fontWeight: '900'
    },
    progressTrack: {
        height: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 3,
        marginTop: 15,
        overflow: 'hidden'
    },
    progressBar: {
        height: '100%',
        borderRadius: 3
    },
    missionFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 12
    },
    progressStatusText: {
        color: 'rgba(255, 255, 255, 0.4)',
        fontSize: 11,
        fontWeight: '700'
    },
    ongoingText: {
        color: '#ec4899',
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase'
    },
    claimButton: {
        backgroundColor: '#10b981',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10
    },
    claimButtonText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '900'
    }
});
