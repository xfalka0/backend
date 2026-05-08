import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Dimensions,
    StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import { useTheme } from '../contexts/ThemeContext';
import GlassCard from '../components/ui/GlassCard';

const { width } = Dimensions.get('window');

const MOCK_NOTIFICATIONS = [
    {
        id: '1',
        type: 'message',
        title: 'Yeni Mesaj',
        body: 'Selin sana bir mesaj gönderdi: "Selam, nasılsın?"',
        time: '2 dk önce',
        isRead: false,
        icon: 'chatbubble-ellipses',
        color: '#8b5cf6',
    },
    {
        id: '2',
        type: 'like',
        title: 'Yeni Beğeni',
        body: 'Biri profilini beğendi! Kim olduğunu görmek için dokun.',
        time: '15 dk önce',
        isRead: false,
        icon: 'heart',
        color: '#ec4899',
    },
    {
        id: '3',
        type: 'system',
        title: 'Haftalık Özet',
        body: 'Bu hafta profilin 150 kişi tarafından görüntülendi.',
        time: '2 saat önce',
        isRead: true,
        icon: 'stats-chart',
        color: '#3b82f6',
    },
    {
        id: '4',
        type: 'gift',
        title: 'Hediye Kazandın!',
        body: 'Günlük giriş ödülü olarak 10 Coin hesabına tanımlandı.',
        time: '5 saat önce',
        isRead: true,
        icon: 'gift',
        color: '#f59e0b',
    },
    {
        id: '5',
        type: 'match',
        title: 'Yeni Eşleşme!',
        body: 'Merve ile kaderiniz birleşti. Hemen sohbete başla.',
        time: '1 gün önce',
        isRead: true,
        icon: 'flame',
        color: '#ef4444',
    },
];

const NotificationsScreen = ({ navigation }) => {
    const insets = useSafeAreaInsets();
    const { theme, themeMode } = useTheme();
    const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);

    const markAllAsRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    };

    const renderItem = ({ item, index }) => (
        <Animated.View 
            entering={FadeInRight.delay(index * 100)} 
            exiting={FadeOutLeft}
        >
            <TouchableOpacity activeOpacity={0.8} style={styles.notificationItem}>
                <GlassCard 
                    intensity={themeMode === 'dark' ? 20 : 40} 
                    style={[
                        styles.card, 
                        !item.isRead && styles.unreadCard
                    ]}
                >
                    <View style={[styles.iconContainer, { backgroundColor: `${item.color}20` }]}>
                        <Ionicons name={item.icon} size={22} color={item.color} />
                    </View>
                    
                    <View style={styles.textContainer}>
                        <View style={styles.headerRow}>
                            <Text style={[styles.title, { color: theme.colors.text }]}>{item.title}</Text>
                            <Text style={[styles.time, { color: theme.colors.textSecondary }]}>{item.time}</Text>
                        </View>
                        <Text 
                            style={[styles.body, { color: theme.colors.textSecondary }]} 
                            numberOfLines={2}
                        >
                            {item.body}
                        </Text>
                    </View>

                    {!item.isRead && <View style={[styles.unreadDot, { backgroundColor: item.color }]} />}
                </GlassCard>
            </TouchableOpacity>
        </Animated.View>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <StatusBar barStyle={themeMode === 'dark' ? 'light-content' : 'dark-content'} />
            
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <TouchableOpacity 
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Bildirimler</Text>
                <TouchableOpacity onPress={markAllAsRead}>
                    <Text style={[styles.readAllText, { color: theme.colors.primary }]}>Tümünü Oku</Text>
                </TouchableOpacity>
            </View>

            {/* List */}
            <FlatList
                data={notifications}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="notifications-off-outline" size={64} color={theme.colors.textSecondary} />
                        <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                            Henüz bildirim yok.
                        </Text>
                    </View>
                }
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '900',
    },
    readAllText: {
        fontSize: 13,
        fontWeight: '700',
    },
    listContent: {
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    notificationItem: {
        marginBottom: 12,
    },
    card: {
        flexDirection: 'row',
        padding: 16,
        borderRadius: 20,
        alignItems: 'center',
    },
    unreadCard: {
        borderWidth: 1,
        borderColor: 'rgba(139, 92, 246, 0.3)',
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textContainer: {
        flex: 1,
        marginLeft: 15,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    title: {
        fontSize: 15,
        fontWeight: '800',
    },
    time: {
        fontSize: 11,
    },
    body: {
        fontSize: 13,
        lineHeight: 18,
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginLeft: 10,
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 100,
    },
    emptyText: {
        marginTop: 20,
        fontSize: 16,
        fontWeight: '600',
    }
});

export default NotificationsScreen;
