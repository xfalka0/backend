import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import RoomCardEqualizer from './RoomCardEqualizer';
import { resolveImageUrl } from '../../utils/imageUtils';

export default function RoomCard({ room, onPress }) {
    const title = room.title || 'Sohbet Odası';
    const level = room.room_level || 1;
    const category = room.category || 'Parti';
    const country = room.country || 'TR';
    const onlineCount = room.onlineCount || room.participants?.length || 0;
    const speakerCount = room.active_speakers || 0;
    const participants = room.participants || [];
    
    // Flag mapper fallback
    const getFlag = (code) => {
        if (code === 'TR') return '🇹🇷';
        if (code === 'US') return '🇺🇸';
        if (code === 'DE') return '🇩🇪';
        return '🇹🇷';
    };

    const hostAvatar = room.host_avatar || (room.host?.avatar_url) || 'https://randomuser.me/api/portraits/women/44.jpg';

    return (
        <TouchableOpacity
            activeOpacity={0.88}
            onPress={onPress}
            style={styles.cardWrapper}
        >
            <LinearGradient
                colors={['#171D3A', '#202747']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cardBody}
            >
                {/* Sol Üst: Host Avatar with Glow Ring */}
                <View style={styles.leftSection}>
                    <View style={styles.avatarGlow}>
                        <Image
                            source={{ uri: resolveImageUrl(hostAvatar) }}
                            style={styles.avatarImg}
                        />
                        <View style={styles.liveIndicatorRing} />
                    </View>
                </View>

                {/* Sağ/Orta Ana Bölüm */}
                <View style={styles.mainSection}>
                    {/* Top Row: Title, LIVE badge, and Level */}
                    <View style={styles.topRow}>
                        <View style={styles.titleAndLive}>
                            <Text style={styles.roomTitle} numberOfLines={1}>
                                {title}
                            </Text>
                            <View style={styles.liveBadge}>
                                <View style={styles.liveDot} />
                                <Text style={styles.liveText}>CANLI</Text>
                            </View>
                        </View>
                        
                        <LinearGradient
                            colors={level >= 5 ? ['#FFD700', '#FFA500'] : ['#FF3F86', '#ec4899']}
                            style={styles.levelBadge}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <Text style={styles.levelText}>Lv.{level}</Text>
                        </LinearGradient>
                    </View>

                    {/* Middle Row: Flags & Tags */}
                    <View style={styles.middleRow}>
                        <Text style={styles.flagText}>{getFlag(country)}</Text>
                        <View style={styles.categoryBadge}>
                            <Text style={styles.categoryText}>👍 {category}</Text>
                        </View>
                    </View>

                    {/* Bottom Row: Mini Avatars Pile, User Stats, and Equalizer */}
                    <View style={styles.bottomRow}>
                        <View style={styles.statsAndAvatars}>
                            {/* Face pile */}
                            <View style={styles.facePile}>
                                {participants.slice(0, 3).map((p, idx) => (
                                    <Image
                                        key={p.id || idx}
                                        source={{ uri: resolveImageUrl(p.avatar_url || 'https://via.placeholder.com/50') }}
                                        style={[
                                            styles.pileAvatar,
                                            { marginLeft: idx === 0 ? 0 : -8, zIndex: 10 - idx }
                                        ]}
                                    />
                                ))}
                                {participants.length === 0 && (
                                    <Image
                                        source={{ uri: resolveImageUrl(hostAvatar) }}
                                        style={styles.pileAvatar}
                                    />
                                )}
                            </View>

                            {/* User count badge */}
                            <View style={styles.usersCount}>
                                <Ionicons name="people" size={10} color="#9DA3B8" style={{ marginRight: 2 }} />
                                <Text style={styles.usersCountText}>{onlineCount}</Text>
                            </View>

                            {/* Speaker mic count badge */}
                            <View style={styles.micCount}>
                                <Ionicons name="mic-sharp" size={10} color="#00E5FF" style={{ marginRight: 2 }} />
                                <Text style={styles.micCountText}>{speakerCount}</Text>
                            </View>
                        </View>

                        {/* Equalizer animation */}
                        <View style={styles.equalizerWrapper}>
                            <RoomCardEqualizer />
                        </View>
                    </View>
                </View>
            </LinearGradient>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    cardWrapper: {
        marginHorizontal: 16,
        marginVertical: 6,
        borderRadius: 24,
        borderWidth: 1.2,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        shadowColor: '#FF3F86',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 4,
        overflow: 'hidden',
    },
    cardBody: {
        flexDirection: 'row',
        padding: 14,
        minHeight: 125,
        alignItems: 'center',
    },
    leftSection: {
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    avatarGlow: {
        width: 68,
        height: 68,
        borderRadius: 34,
        borderWidth: 1.5,
        borderColor: '#FF3F86',
        padding: 2,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    avatarImg: {
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: '#171D3A',
    },
    liveIndicatorRing: {
        position: 'absolute',
        top: -2,
        left: -2,
        right: -2,
        bottom: -2,
        borderRadius: 36,
        borderWidth: 1,
        borderColor: 'rgba(255, 63, 134, 0.4)',
    },
    mainSection: {
        flex: 1,
        justifyContent: 'space-between',
        height: '100%',
        minHeight: 88,
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
    },
    titleAndLive: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 8,
        gap: 6,
    },
    roomTitle: {
        fontSize: 14.5,
        fontWeight: 'bold',
        color: '#FFFFFF',
        maxWidth: '70%',
    },
    liveBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        paddingHorizontal: 5,
        paddingVertical: 1.5,
        borderRadius: 5,
        borderWidth: 0.5,
        borderColor: 'rgba(239, 68, 68, 0.35)',
    },
    liveDot: {
        width: 4.5,
        height: 4.5,
        borderRadius: 2.5,
        backgroundColor: '#ef4444',
        marginRight: 3,
    },
    liveText: {
        fontSize: 7.5,
        fontWeight: '900',
        color: '#ef4444',
        letterSpacing: 0.5,
    },
    levelBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2.5,
        borderRadius: 8,
        borderWidth: 0.5,
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    levelText: {
        fontSize: 8.5,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    middleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginVertical: 4,
    },
    flagText: {
        fontSize: 13,
    },
    categoryBadge: {
        backgroundColor: 'rgba(0, 229, 255, 0.08)',
        borderWidth: 0.5,
        borderColor: 'rgba(0, 229, 255, 0.25)',
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    categoryText: {
        fontSize: 9.5,
        color: '#00E5FF',
        fontWeight: '700',
    },
    bottomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 6,
    },
    statsAndAvatars: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    facePile: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    pileAvatar: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 1,
        borderColor: '#171D3A',
    },
    usersCount: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(157, 163, 184, 0.1)',
        paddingHorizontal: 5,
        paddingVertical: 1.5,
        borderRadius: 6,
    },
    usersCountText: {
        fontSize: 9,
        color: '#9DA3B8',
        fontWeight: 'bold',
    },
    micCount: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 229, 255, 0.08)',
        paddingHorizontal: 5,
        paddingVertical: 1.5,
        borderRadius: 6,
    },
    micCountText: {
        fontSize: 9,
        color: '#00E5FF',
        fontWeight: 'bold',
    },
    equalizerWrapper: {
        justifyContent: 'center',
        alignItems: 'center',
    },
});
