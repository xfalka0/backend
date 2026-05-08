import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import VipFrame from '../components/ui/VipFrame';

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

    const renderTopThree = () => {
        const topThree = MOCK_LEADERBOARD.slice(0, 3);
        return (
            <View style={styles.topThreeContainer}>
                {/* Second Place */}
                <View style={[styles.topThreeItem, { marginTop: 40 }]}>
                    <View style={styles.avatarWrapper}>
                        <VipFrame level={topThree[1].level} avatar={topThree[1].avatar} size={70} isStatic={true} />
                        <View style={[styles.rankBadge, { backgroundColor: '#cbd5e1' }]}>
                            <Text style={styles.rankText}>2</Text>
                        </View>
                    </View>
                    <Text style={[styles.topName, { color: theme.colors.text }]} numberOfLines={1}>{topThree[1].name}</Text>
                    <Text style={styles.topScore}>{topThree[1].score}</Text>
                </View>

                {/* First Place */}
                <View style={styles.topThreeItem}>
                    <View style={styles.avatarWrapper}>
                        <VipFrame level={topThree[0].level} avatar={topThree[0].avatar} size={90} isStatic={true} />
                        <View style={[styles.rankBadge, { backgroundColor: 'transparent', width: 32, height: 32, borderWidth: 0 }]}>
                            <Image source={require('../../assets/kupa.png')} style={{ width: 32, height: 32 }} resizeMode="contain" />
                        </View>
                    </View>
                    <Text style={[styles.topName, { color: theme.colors.text, fontSize: 16 }]} numberOfLines={1}>{topThree[0].name}</Text>
                    <Text style={[styles.topScore, { color: '#fbbf24' }]}>{topThree[0].score}</Text>
                </View>

                {/* Third Place */}
                <View style={[styles.topThreeItem, { marginTop: 50 }]}>
                    <View style={styles.avatarWrapper}>
                        <VipFrame level={topThree[2].level} avatar={topThree[2].avatar} size={65} isStatic={true} />
                        <View style={[styles.rankBadge, { backgroundColor: '#cd7f32' }]}>
                            <Text style={styles.rankText}>3</Text>
                        </View>
                    </View>
                    <Text style={[styles.topName, { color: theme.colors.text }]} numberOfLines={1}>{topThree[2].name}</Text>
                    <Text style={styles.topScore}>{topThree[2].score}</Text>
                </View>
            </View>
        );
    };

    const renderItem = ({ item }) => {
        if (item.rank <= 3) return null;
        return (
            <View style={[styles.listItem, { backgroundColor: theme.colors.glass, borderColor: theme.colors.glassBorder }]}>
                <Text style={[styles.listRank, { color: theme.colors.textSecondary }]}>{item.rank}</Text>
                <VipFrame level={item.level} avatar={item.avatar} size={45} isStatic={true} />
                <View style={styles.listInfo}>
                    <Text style={[styles.listName, { color: theme.colors.text }]}>{item.name}</Text>
                    <Text style={[styles.listLevel, { color: theme.colors.textSecondary }]}>Level {item.level}</Text>
                </View>
                <View style={styles.listScoreContainer}>
                    <Text style={[styles.listScore, { color: theme.colors.primary }]}>{item.score}</Text>
                    <Ionicons name="sparkles" size={12} color={theme.colors.primary} style={{ marginLeft: 4 }} />
                </View>
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <LinearGradient
                colors={themeMode === 'dark' ? ['#1e1b4b', '#0f172a'] : [theme.colors.primary + '20', theme.colors.background]}
                style={StyleSheet.absoluteFill}
            />

            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Liderlik Tablosu</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.tabContainer}>
                {['Günlük', 'Haftalık', 'Tüm Zamanlar'].map(tab => (
                    <TouchableOpacity
                        key={tab}
                        onPress={() => setActiveTab(tab)}
                        style={[styles.tab, activeTab === tab && { backgroundColor: theme.colors.primary }]}
                    >
                        <Text style={[styles.tabText, { color: activeTab === tab ? 'white' : theme.colors.textSecondary }]}>{tab}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <FlatList
                data={MOCK_LEADERBOARD}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                ListHeaderComponent={renderTopThree}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            />
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
        flexDirection: 'row',
        marginHorizontal: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 15,
        padding: 4,
        marginBottom: 20,
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 12,
    },
    tabText: {
        fontSize: 13,
        fontWeight: '800',
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
        bottom: -5,
        alignSelf: 'center',
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#0f172a',
        zIndex: 10,
    },
    rankText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '900',
    },
    topName: {
        fontSize: 14,
        fontWeight: '800',
        marginBottom: 4,
    },
    topScore: {
        fontSize: 12,
        fontWeight: '900',
        color: '#94a3b8',
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 20,
        marginBottom: 12,
        borderWidth: 1,
    },
    listRank: {
        width: 30,
        fontSize: 16,
        fontWeight: '900',
        textAlign: 'center',
        marginRight: 10,
    },
    listInfo: {
        flex: 1,
        marginLeft: 15,
    },
    listName: {
        fontSize: 15,
        fontWeight: '800',
    },
    listLevel: {
        fontSize: 11,
        marginTop: 2,
    },
    listScoreContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    listScore: {
        fontSize: 14,
        fontWeight: '900',
    },
});
