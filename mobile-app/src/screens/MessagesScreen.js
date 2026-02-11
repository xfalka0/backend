import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useTheme } from '../contexts/ThemeContext';
import { API_URL } from '../config';
import PromoBanner from '../components/ui/PromoBanner';

export default function MessagesScreen({ navigation, route }) {
    const { theme, themeMode } = useTheme();
    const { user } = route.params || {};
    const [chats, setChats] = useState([]);
    const [loading, setLoading] = useState(true);

    useFocusEffect(
        React.useCallback(() => {
            if (user?.id) {
                fetchChats();
            } else {
                console.log('MessagesScreen: No user ID, stop loading');
                setLoading(false);
            }
        }, [user])
    );


    const fetchChats = async () => {
        try {
            const res = await axios.get(`${API_URL}/users/${user.id}/chats`);
            setChats(res.data);
        } catch (error) {
            console.error('Fetch Chats Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const renderChatItem = ({ item }) => {
        const hasUnread = item.unread_count > 0;

        return (
            <TouchableOpacity
                style={styles.chatItem}
                onPress={() => navigation.navigate('Chat', {
                    operatorId: item.operator_id,
                    chatId: item.id,
                    name: item.name,
                    avatar_url: item.avatar_url,
                    user
                })}
            >
                <View style={[
                    styles.avatarContainer,
                    { marginRight: 15 },
                    hasUnread && styles.avatarGlow // Apply glow if unread
                ]}>
                    <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
                    {item.is_online && <View style={[styles.onlineBadge, { borderColor: themeMode === 'dark' ? '#030712' : theme.colors.background }]} />}
                </View>

                <View style={styles.content}>
                    <View style={styles.mainContent}>
                        <View style={styles.textContainer}>
                            <View style={styles.nameRow}>
                                <Text style={[styles.name, { color: theme.colors.text }]} numberOfLines={1}>{item.name}</Text>

                                {item.vip_level > 0 && (
                                    <View style={styles.vipBadge}>
                                        <Ionicons name="star" size={8} color="white" />
                                        <Text style={styles.vipText}>VIP {item.vip_level}</Text>
                                    </View>
                                )}

                                {item.is_verified && (
                                    <Ionicons name="checkmark-circle" size={14} color="#3b82f6" style={styles.verifiedBadgeIcon} />
                                )}
                            </View>
                            <Text style={[styles.lastMsg, { color: hasUnread ? theme.colors.text : theme.colors.textSecondary, fontWeight: hasUnread ? '700' : '400' }]} numberOfLines={1}>
                                {item.last_message || 'Sohbet Başladı 💬'}
                            </Text>
                        </View>

                        <View style={styles.metaContainer}>
                            <Text style={[styles.time, { color: hasUnread ? theme.colors.primary : theme.colors.textSecondary }]}>
                                {item.last_message_at ? new Date(item.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </Text>
                            {hasUnread && (
                                <View style={styles.unreadBadge}>
                                    <Text style={styles.unreadText}>{item.unread_count}</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {themeMode === 'dark' && (
                <LinearGradient
                    colors={['#030712', '#0f172a']}
                    style={StyleSheet.absoluteFill}
                />
            )}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.gradients.primary[0]} />
                </View>
            ) : (
                <FlatList
                    data={chats}
                    keyExtractor={item => item.id.toString()}
                    renderItem={renderChatItem}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    ListHeaderComponent={(
                        <>
                            <PromoBanner navigation={navigation} />
                            <View style={styles.headerContainer}>
                                <Text style={[styles.title, { color: theme.colors.text }]}>Sohbetler</Text>
                                <TouchableOpacity>
                                    <Ionicons name="search-outline" size={24} color={theme.colors.text} />
                                </TouchableOpacity>
                            </View>
                        </>
                    )}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    headerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginVertical: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: '900',
    },
    list: {
        paddingBottom: 40,
        paddingTop: 40,
    },
    chatItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        paddingHorizontal: 20,
    },
    avatarContainer: {
        position: 'relative',
        marginRight: 15,
        borderRadius: 30, // Updated to match circle for glow
    },
    avatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
    },
    avatarGlow: {
        shadowColor: '#fbbf24', // Gold glow
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 10,
        elevation: 10,
        backgroundColor: 'rgba(251, 191, 36, 0.1)', // Subtle background highlight
    },
    onlineBadge: {
        position: 'absolute',
        right: 0,
        bottom: 0,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#10b981',
        borderWidth: 2,
    },
    unreadBadge: {
        backgroundColor: '#ef4444', // More standard notification red/pink
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
        marginTop: 4,
    },
    unreadText: {
        color: 'white',
        fontSize: 11,
        fontWeight: 'bold',
    },
    content: {
        flex: 1,
    },
    mainContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start', // Align to top
    },
    textContainer: {
        flex: 1,
        marginRight: 10,
    },
    metaContainer: {
        alignItems: 'flex-end', // Right align time and badge
        justifyContent: 'flex-start',
    },
    name: {
        fontSize: 17,
        fontWeight: 'bold',
        marginRight: 4,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    vipBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f59e0b',
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 4,
        marginRight: 4,
    },
    vipText: {
        color: 'white',
        fontSize: 8,
        fontWeight: '900',
        marginLeft: 2,
    },
    verifiedBadgeIcon: {
        marginLeft: 2,
    },
    lastMsg: {
        fontSize: 14,
    },
    time: {
        fontSize: 12,
        marginBottom: 6, // Space between time and badge
        fontWeight: '600',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    }
});
