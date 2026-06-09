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
    ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as Haptics from 'expo-haptics';

import { API_URL } from '../config';
import { useTheme } from '../contexts/ThemeContext';
import GlassCard from '../components/ui/GlassCard';
import { useAppStore } from '../store/useAppStore';
import { Motion } from '../components/motion/MotionSystem';

const { width } = Dimensions.get('window');

const MISSION_TARGETS = {
    chat_earnings: [
        { value: 5000, reward: 1000 },
        { value: 10000, reward: 2000 },
        { value: 20000, reward: 6000 },
        { value: 30000, reward: 9000 },
        { value: 40000, reward: 14000 },
        { value: 50000, reward: 18000 }
    ],
    photo_unlocks: [
        { value: 10, reward: 1800 },
        { value: 20, reward: 5000 },
        { value: 30, reward: 8000 },
        { value: 40, reward: 12000 },
        { value: 50, reward: 16000 }
    ],
    gift_received: [
        { value: 2000, reward: 2000 },
        { value: 5000, reward: 5000 },
        { value: 10000, reward: 12000 },
        { value: 20000, reward: 26000 },
        { value: 40000, reward: 55000 },
        { value: 60000, reward: 85000 },
        { value: 100000, reward: 150000 }
    ]
};

export default function MissionBoardScreen() {
    const navigation = useNavigation();
    const { theme, themeMode } = useTheme();
    
    // Connect Zustand Store
    const user = useAppStore(state => state.user);
    const balance = useAppStore(state => state.balance);
    const syncBalanceWithServer = useAppStore(state => state.syncBalanceWithServer);

    // Redirect standard male users/non-operators away from this screen immediately
    useEffect(() => {
        if (user) {
            const isFemale = (user.gender || '').toLowerCase() === 'kadin';
            const isOperatorRole = ['operator', 'moderator', 'admin', 'super_admin', 'staff'].includes(user.role);
            if (!isFemale && !isOperatorRole) {
                console.log('[MissionBoard] Unauthorized user, redirecting back.');
                navigation.goBack();
            }
        }
    }, [user, navigation]);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [todayClaims, setTodayClaims] = useState({
        chat_earnings: 0,
        photo_unlocks: 0,
        gift_received: 0
    });
    const [timeLeft, setTimeLeft] = useState('00:00:00');
    const [commissionRate, setCommissionRate] = useState(0.25);
    
    const [stats, setStats] = useState({
        photoUnlocks: 0,
        todayEarnings: 0,
        giftCoinsReceived: 0,
    });

    // Countdown Timer to Midnight
    useEffect(() => {
        const calculateTimeLeft = () => {
            const now = new Date();
            const midnight = new Date();
            midnight.setHours(24, 0, 0, 0); // next midnight
            const diffMs = midnight - now;
            
            if (diffMs <= 0) return '00:00:00';

            const hours = Math.floor(diffMs / (1000 * 60 * 60));
            const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
            
            const pad = (num) => String(num).padStart(2, '0');
            return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
        };

        setTimeLeft(calculateTimeLeft());
        const interval = setInterval(() => {
            setTimeLeft(calculateTimeLeft());
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    const fetchMissionStats = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) return;

            // Fetch actual operator stats from backend
            const res = await axios.get(`${API_URL}/operators/my/stats`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (res.data) {
                setStats({
                    photoUnlocks: parseInt(res.data.image_count || res.data.image_count_today || 0),
                    todayEarnings: parseFloat(res.data.coins_earned || res.data.earned_today || 0),
                    giftCoinsReceived: parseFloat(res.data.gift_coins_received_today || 0),
                });
                
                if (res.data.commission_rate !== undefined) {
                    setCommissionRate(parseFloat(res.data.commission_rate));
                }

                if (res.data.today_claims) {
                    setTodayClaims(res.data.today_claims);
                }
            }
            await syncBalanceWithServer();
        } catch (error) {
            console.error('[MissionBoard] Fetch stats error:', error);
        }
    };

    useFocusEffect(
        React.useCallback(() => {
            setLoading(true);
            fetchMissionStats().finally(() => setLoading(false));
        }, [user?.id])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await fetchMissionStats();
        setRefreshing(false);
    };

    // Helper: calculate segmented fill progress bar percentage
    const getSegmentedProgress = (current, milestones) => {
        if (!milestones || milestones.length < 2) return 0;
        if (current <= milestones[0]) return 0;
        
        const totalSegments = milestones.length - 1;
        const segmentWeight = 1 / totalSegments;

        for (let i = 0; i < milestones.length - 1; i++) {
            const min = milestones[i];
            const max = milestones[i + 1];
            if (current >= min && current <= max) {
                const segmentProgress = (current - min) / (max - min);
                return (i + segmentProgress) * segmentWeight;
            }
        }
        if (current > milestones[milestones.length - 1]) return 1;
        return 0;
    };

    // Resolve state for a mission target
    const resolveMissionState = (missionId, current, targets, totalClaimedToday) => {
        const reachedTargets = targets.filter(t => current >= t.value);
        
        if (reachedTargets.length > 0) {
            const maxReached = reachedTargets.reduce((max, t) => t.value > max.value ? t : max, reachedTargets[0]);
            
            if (totalClaimedToday < maxReached.reward) {
                return {
                    activeTarget: maxReached.value,
                    activeReward: maxReached.reward,
                    status: 'claimable',
                    netReward: maxReached.reward - totalClaimedToday
                };
            }
            
            const nextTarget = targets.find(t => t.value > maxReached.value);
            if (nextTarget) {
                return {
                    activeTarget: nextTarget.value,
                    activeReward: nextTarget.reward,
                    status: 'progress',
                    netReward: nextTarget.reward - totalClaimedToday
                };
            } else {
                return {
                    activeTarget: maxReached.value,
                    activeReward: maxReached.reward,
                    status: 'claimed',
                    netReward: 0
                };
            }
        } else {
            const firstTarget = targets[0];
            return {
                activeTarget: firstTarget.value,
                activeReward: firstTarget.reward,
                status: 'progress',
                netReward: firstTarget.reward - totalClaimedToday
            };
        }
    };

    // Claim rewards handler
    const handleClaimReward = async (missionId, targetValue, rewardAmount) => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) return;

            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            const res = await axios.post(`${API_URL}/operators/my/claim-mission`, {
                missionId,
                milestoneValue: targetValue,
                rewardAmount
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data && res.data.success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                
                const claimedAmt = res.data.claimedAmount !== undefined ? res.data.claimedAmount : rewardAmount;
                alert(`Tebrikler! Görev ödülü olan ${claimedAmt.toLocaleString()} Elmas hesabınıza eklendi. 🎉`);
                await fetchMissionStats();
            } else {
                alert('Ödül alınırken bir hata oluştu.');
            }
        } catch (error) {
            console.error('[MissionBoard] Claim reward error:', error);
            alert(error.response?.data?.error || 'Ödül alınırken bir hata oluştu.');
        }
    };

    // Navigate to respective tasks
    const handleGoToTask = (type) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (type === 'video') {
            navigation.navigate('Main', { screen: 'Keşfet' });
        } else {
            navigation.navigate('Main', { screen: 'Sohbet' });
        }
    };

    const MISSION_DATA = [
        {
            id: 'chat_earnings',
            title: 'Sohbet Kazancı Ödülü',
            icon: 'chatbubbles-outline',
            current: stats.todayEarnings,
            milestones: [0, 5000, 10000, 20000, 30000, 40000, 50000],
            targets: MISSION_TARGETS.chat_earnings,
            type: 'chat',
            getDesc: (target, reward) => (
                <Text style={styles.descText}>
                    Bugünün sohbet kazancı <Text style={styles.descHighlightTarget}>{target.toLocaleString()} 💎</Text>'ye ulaştı, <Text style={styles.descHighlightRewardBlue}>{reward.toLocaleString()} 💎</Text> ödül alınacak.
                </Text>
            )
        },
        {
            id: 'photo_unlocks',
            title: 'Fotoğraf Açılma Ödülü',
            icon: 'image-outline',
            current: stats.photoUnlocks,
            milestones: [0, 10, 20, 30, 40, 50],
            targets: MISSION_TARGETS.photo_unlocks,
            type: 'image',
            getDesc: (target, reward) => (
                <Text style={styles.descText}>
                    Bugün sohbetlerde <Text style={styles.descHighlightTarget}>{target.toLocaleString()} adet</Text> kilitli fotoğrafınız açıldığında, <Text style={styles.descHighlightRewardBlue}>{reward.toLocaleString()} 💎</Text> ödül alınacak.
                </Text>
            )
        },
        {
            id: 'gift_received',
            title: 'Hediye Alma Ödülü',
            icon: 'gift-outline',
            current: stats.giftCoinsReceived,
            milestones: [0, 2000, 5000, 10000, 20000, 40000, 60000, 100000],
            targets: MISSION_TARGETS.gift_received,
            type: 'gift',
            getDesc: (target, reward) => (
                <Text style={styles.descText}>
                    Bugün <Text style={styles.descHighlightTarget}>{target.toLocaleString()} Coin</Text> değerinde hediye aldığınızda <Text style={styles.descHighlightRewardBlue}>{reward.toLocaleString()} 💎</Text> ödül alınacak.
                </Text>
            )
        }
    ];

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            
            {/* Dark Purple Gradient Backdrop */}
            <LinearGradient
                colors={['#4c1d95', '#2e1065', '#1e1b4b']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />

            <SafeAreaView style={styles.safeArea}>
                {/* Header Section */}
                <View style={styles.headerRow}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={26} color="white" />
                    </TouchableOpacity>
                    <View style={styles.titleContainer}>
                        <Text style={styles.headerTitle}>Resmi Görevler</Text>
                        <Ionicons name="help-circle-outline" size={16} color="#ec4899" style={{ marginLeft: 4 }} />
                    </View>
                    <TouchableOpacity 
                        style={styles.walletBadge}
                        onPress={() => navigation.navigate('Wallet')}
                    >
                        <Ionicons name="diamond" size={14} color="#ec4899" style={{ marginRight: 5 }} />
                        <Text style={styles.walletText}>{Math.floor(balance).toLocaleString()}</Text>
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <View style={styles.loadingBox}>
                        <ActivityIndicator size="large" color="#ec4899" />
                        <Text style={styles.loadingText}>Görevler yükleniyor...</Text>
                    </View>
                ) : (
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContent}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ec4899" />
                        }
                    >
                        {/* Notice Subtext */}
                        <View style={styles.infoWrapper}>
                            <Text style={styles.noticeSubtext}>
                                Resmi görevleri tamamladığınızda en fazla <Text style={styles.highlightText}>427.800 elmas!</Text> ödül alacaksınız!
                            </Text>
                        </View>

                        {/* Missions Cards */}
                        {MISSION_DATA.map((mission, index) => {
                            const claimedAmt = todayClaims[mission.id] || 0;
                            const resolved = resolveMissionState(mission.id, mission.current, mission.targets, claimedAmt);
                            const fillPercent = getSegmentedProgress(mission.current, mission.milestones);
                            
                            return (
                                <Motion.SlideUp key={mission.id} delay={index * 150}>
                                    <GlassCard intensity={25} tint="dark" style={styles.missionCard}>
                                        {/* Task Card Header */}
                                        <View style={styles.missionCardHeader}>
                                            <View style={styles.tagAndTitleWrapper}>
                                                <View style={styles.tagDaily}>
                                                    <Text style={styles.tagDailyText}>Günlük</Text>
                                                </View>
                                                <Text style={[styles.missionTitle, { fontSize: 11.5 }]}>
                                                    {mission.title}
                                                </Text>
                                                <View style={styles.progressRatioBadge}>
                                                    <Text style={styles.progressRatioText}>
                                                        {Math.round(mission.current).toLocaleString()} / {resolved.activeTarget.toLocaleString()}
                                                    </Text>
                                                </View>
                                            </View>
                                            
                                            {/* Countdown Timer */}
                                            <View style={styles.timerRow}>
                                                <Ionicons name="time-outline" size={12} color="#ec4899" style={{ marginRight: 3 }} />
                                                <Text style={styles.timerText}>{timeLeft}</Text>
                                            </View>
                                        </View>
 
                                        {/* Task Card Body */}
                                        <View style={styles.missionCardBody}>
                                            <View style={styles.missionDescriptionContainer}>
                                                {mission.getDesc(resolved.activeTarget, resolved.status === 'claimed' ? resolved.activeReward : resolved.netReward)}
                                            </View>

                                            {/* Action Button */}
                                            {resolved.status === 'claimable' ? (
                                                <TouchableOpacity 
                                                    style={styles.claimButton}
                                                    onPress={() => handleClaimReward(mission.id, resolved.activeTarget, resolved.activeReward)}
                                                >
                                                    <LinearGradient
                                                        colors={['#10b981', '#059669']}
                                                        style={styles.btnGradient}
                                                    >
                                                        <Text style={styles.btnText}>Ödülü Al</Text>
                                                    </LinearGradient>
                                                </TouchableOpacity>
                                            ) : resolved.status === 'progress' ? (
                                                <TouchableOpacity 
                                                    style={styles.goButton}
                                                    onPress={() => handleGoToTask(mission.type)}
                                                >
                                                    <LinearGradient
                                                        colors={['#ec4899', '#db2777']}
                                                        style={styles.btnGradient}
                                                    >
                                                        <Text style={styles.btnText}>Git</Text>
                                                    </LinearGradient>
                                                </TouchableOpacity>
                                            ) : (
                                                <View style={styles.claimedButton}>
                                                    <Text style={styles.claimedBtnText}>Alındı</Text>
                                                </View>
                                            )}
                                        </View>

                                        {/* Multi-Milestone Custom Progress Slider (Scrollable) */}
                                        <View style={styles.scrollWrapper}>
                                            <ScrollView 
                                                horizontal 
                                                showsHorizontalScrollIndicator={false}
                                                style={styles.sliderScrollView}
                                                contentContainerStyle={styles.sliderScrollContent}
                                            >
                                                <View style={styles.sliderContainer}>
                                                    <View style={styles.progressTrackBg}>
                                                        <LinearGradient 
                                                            colors={['#ec4899', '#a78bfa']}
                                                            start={{ x: 0, y: 0 }}
                                                            end={{ x: 1, y: 0 }}
                                                            style={[
                                                                styles.progressTrackFill, 
                                                                { width: `${fillPercent * 100}%` }
                                                            ]} 
                                                        />
                                                    </View>
                                                    
                                                    {/* Milestone Nodes */}
                                                    <View style={styles.milestoneNodesRow}>
                                                        {mission.milestones.map((milestone, idx) => {
                                                            const isReached = mission.current >= milestone;
                                                            const targetObj = mission.targets.find(t => t.value === milestone);
                                                            const rewardText = targetObj ? `+${targetObj.reward.toLocaleString()}` : '';
                                                            
                                                            return (
                                                                <View key={idx} style={styles.milestoneNodeCol}>
                                                                    <Text style={[
                                                                        styles.milestoneRewardText,
                                                                        isReached ? styles.milestoneRewardTextActive : styles.milestoneRewardTextInactive
                                                                    ]}>
                                                                        {rewardText}
                                                                    </Text>
                                                                    <View 
                                                                        style={[
                                                                            styles.milestoneDot, 
                                                                            isReached ? styles.milestoneDotActive : styles.milestoneDotInactive
                                                                        ]} 
                                                                    />
                                                                    <Text 
                                                                        style={[
                                                                            styles.milestoneText, 
                                                                            isReached ? styles.milestoneTextActive : styles.milestoneTextInactive
                                                                        ]}
                                                                    >
                                                                        {milestone.toLocaleString()}
                                                                    </Text>
                                                                </View>
                                                            );
                                                        })}
                                                    </View>
                                                </View>
                                            </ScrollView>
                                            {/* Subtle Arrow indicators showing swipability */}
                                            <View style={styles.swipeHint}>
                                                <Ionicons name="chevron-forward" size={12} color="rgba(236, 72, 153, 0.4)" />
                                            </View>
                                        </View>
                                    </GlassCard>
                                </Motion.SlideUp>
                            );
                        })}

                        <View style={{ height: 100 }} />
                    </ScrollView>
                )}
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1e1b4b'
    },
    safeArea: {
        flex: 1
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.05)',
        backgroundColor: 'transparent'
    },
    backButton: {
        padding: 4
    },
    titleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        marginRight: -10
    },
    headerTitle: {
        color: 'white',
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: -0.3
    },
    walletBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(236, 72, 153, 0.1)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: 'rgba(236, 72, 153, 0.2)'
    },
    walletText: {
        color: '#fff',
        fontWeight: '900',
        fontSize: 12
    },
    loadingBox: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    loadingText: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 13,
        fontWeight: '600',
        marginTop: 10
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 16
    },
    infoWrapper: {
        alignItems: 'center',
        marginBottom: 20
    },
    noticeSubtext: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: 8,
        lineHeight: 18
    },
    highlightText: {
        color: '#ec4899',
        fontWeight: '800'
    },
    rateBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(236, 72, 153, 0.2)'
    },
    rateText: {
        color: '#ec4899',
        fontSize: 11,
        fontWeight: '800'
    },
    missionCard: {
        padding: 16,
        borderRadius: 24,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
        backgroundColor: 'rgba(255, 255, 255, 0.02)'
    },
    missionCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10
    },
    tagAndTitleWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 8
    },
    tagDaily: {
        backgroundColor: '#ec4899',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        marginRight: 8
    },
    tagDailyText: {
        color: 'white',
        fontSize: 10,
        fontWeight: '900',
        textTransform: 'uppercase'
    },
    missionTitle: {
        color: 'white',
        fontSize: 11.5,
        fontWeight: '800',
        flex: 1
    },
    timerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8
    },
    timerText: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 10,
        fontWeight: '700'
    },
    missionCardBody: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 18,
        gap: 12
    },
    missionDescriptionContainer: {
        flex: 1,
    },
    descText: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 11,
        lineHeight: 15,
    },
    descHighlightTarget: {
        color: '#ffffff',
        fontWeight: '900',
    },
    descHighlightRewardBlue: {
        color: '#38bdf8', // Neon Sky Blue / Mavi
        fontWeight: '900',
        textShadowColor: 'rgba(56, 189, 248, 0.5)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 6,
    },
    progressRatioBadge: {
        backgroundColor: 'rgba(236, 72, 153, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(236, 72, 153, 0.2)',
        marginLeft: 8,
    },
    progressRatioText: {
        color: '#ec4899',
        fontSize: 11,
        fontWeight: '900',
    },
    goButton: {
        width: 72,
        height: 32,
        borderRadius: 16,
        overflow: 'hidden'
    },
    claimButton: {
        width: 72,
        height: 32,
        borderRadius: 16,
        overflow: 'hidden'
    },
    claimedButton: {
        width: 72,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)'
    },
    btnGradient: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center'
    },
    btnText: {
        color: 'white',
        fontSize: 11,
        fontWeight: '900'
    },
    claimedBtnText: {
        color: 'rgba(255, 255, 255, 0.3)',
        fontSize: 11,
        fontWeight: '900'
    },
    scrollWrapper: {
        position: 'relative',
        width: '100%'
    },
    sliderScrollView: {
        width: '100%',
        marginTop: 4
    },
    sliderScrollContent: {
        paddingHorizontal: 6,
        paddingBottom: 4
    },
    sliderContainer: {
        width: 580, // Generous width for scrollable milestone line
        position: 'relative',
        height: 58
    },
    progressTrackBg: {
        height: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 3,
        position: 'absolute',
        top: 21,
        left: 20,
        right: 20,
        zIndex: 1
    },
    progressTrackFill: {
        height: '100%',
        backgroundColor: '#ec4899',
        borderRadius: 3
    },
    milestoneNodesRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        zIndex: 5,
        paddingHorizontal: 10
    },
    milestoneNodeCol: {
        alignItems: 'center',
        width: 60
    },
    milestoneRewardText: {
        fontSize: 9,
        fontWeight: '900',
        height: 14,
        textAlign: 'center',
        marginBottom: 2
    },
    milestoneRewardTextInactive: {
        color: 'rgba(255, 255, 255, 0.55)'
    },
    milestoneRewardTextActive: {
        color: '#38bdf8', // Neon Sky Blue / Mavi
        textShadowColor: 'rgba(56, 189, 248, 0.4)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 3
    },
    milestoneDot: {
        width: 16,
        height: 16,
        borderRadius: 8,
        borderWidth: 2,
        backgroundColor: '#05010b'
    },
    milestoneDotInactive: {
        borderColor: 'rgba(255, 255, 255, 0.1)'
    },
    milestoneDotActive: {
        borderColor: '#ec4899',
        backgroundColor: '#ffffff',
        borderWidth: 4
    },
    milestoneText: {
        fontSize: 10,
        fontWeight: '700',
        marginTop: 6
    },
    milestoneTextInactive: {
        color: 'rgba(255, 255, 255, 0.3)'
    },
    milestoneTextActive: {
        color: '#ec4899'
    },
    swipeHint: {
        position: 'absolute',
        right: -4,
        top: 6,
        backgroundColor: 'rgba(236, 72, 153, 0.1)',
        width: 16,
        height: 16,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(236, 72, 153, 0.2)'
    }
});
