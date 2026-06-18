import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { resolveImageUrl } from '../../utils/imageUtils';

export default function RoomTopHeader({ room, onlineCount, listeners = [], onBack, onOpenSettings, onOpenMembers, insets }) {
    const roomId = room?.id?.slice(0, 7)?.toUpperCase() || '4086795';

    return (
        <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
            {/* Left compact pill */}
            <View style={styles.leftContainer}>
                <View style={styles.roomPill}>
                    {/* Thumbnail Image Container with Mute/Speaker Overlay */}
                    <View style={styles.thumbnailContainer}>
                        <Image
                            source={{ uri: room?.host_avatar || room?.background_url || 'https://via.placeholder.com/150' }}
                            style={styles.roomThumbnail}
                        />
                        <TouchableOpacity style={styles.speakerBtnOverlay}>
                            <Ionicons name="volume-medium-sharp" size={11} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    {/* Title and ID text */}
                    <View style={styles.roomTextContainer}>
                        <View style={styles.titleRow}>
                            <Text style={styles.roomTitle} numberOfLines={1}>
                                {room?.title || 'Oda Başlığı'}
                            </Text>
                            <Ionicons name="flame" size={9} color="#ff9f0a" style={{ marginLeft: 3 }} />
                        </View>
                        <Text style={styles.roomId}>ID:{roomId}</Text>
                    </View>

                    {/* Circular expand button on far right of the pill */}
                    <TouchableOpacity style={styles.expandPillBtn}>
                        <Ionicons name="chevron-down" size={8} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Right compact actions */}
            <View style={styles.rightContainer}>
                {/* Online participant count pill */}
                <TouchableOpacity style={styles.onlineUserBubbles} onPress={onOpenMembers}>
                    <Ionicons name="people-sharp" size={12} color="#34d399" />
                    <View style={styles.onlineCountTextWrapper}>
                        <Text style={styles.onlineCountText}>{onlineCount || 1}</Text>
                    </View>
                </TouchableOpacity>

                {/* 3 VIP Avatars */}
                {listeners && listeners.length > 0 && (
                    <View style={styles.vipAvatarsRow}>
                        {listeners.slice(0, 3).map((listener, idx) => (
                            <View 
                                key={listener.user_id || listener.id || idx} 
                                style={[
                                    styles.vipHeaderAvatar, 
                                    idx === 0 ? styles.vipGold : idx === 1 ? styles.vipSilver : styles.vipBronze,
                                    idx > 0 && { marginLeft: -6 }
                                ]}
                            >
                                <Image
                                    source={{ uri: resolveImageUrl(listener.avatar_url) || `https://ui-avatars.com/api/?name=${encodeURIComponent(listener.display_name || listener.username || 'U')}&background=random&color=fff` }}
                                    style={styles.vipAvatarImg}
                                />
                            </View>
                        ))}
                    </View>
                )}
 
                {/* Flat borderless share button */}
                <TouchableOpacity style={styles.flatIconBtn} onPress={onOpenSettings}>
                    <Ionicons name="arrow-redo-outline" size={17} color="#fff" style={styles.iconGlow} />
                </TouchableOpacity>
 
                {/* Flat borderless exit power button */}
                <TouchableOpacity style={styles.flatIconBtn} onPress={onBack}>
                    <Ionicons name="power" size={17} color="#fff" style={styles.iconGlow} />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingBottom: 6,
        backgroundColor: 'transparent',
    },
    leftContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    roomPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(7, 11, 36, 0.65)', // Darker premium glass background
        borderRadius: 16,
        paddingLeft: 4,
        paddingRight: 6,
        paddingVertical: 4,
        gap: 6,
        borderWidth: 0.5,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    thumbnailContainer: {
        position: 'relative',
        width: 24,
        height: 24,
        borderRadius: 5,
        overflow: 'hidden',
        borderWidth: 0.5,
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    roomThumbnail: {
        width: '100%',
        height: '100%',
    },
    speakerBtnOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.35)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    roomTextContainer: {
        justifyContent: 'center',
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    roomTitle: {
        fontSize: 9.5,
        fontWeight: 'bold',
        color: '#fff',
        maxWidth: 90,
    },
    roomId: {
        fontSize: 7.5,
        color: 'rgba(255,255,255,0.65)',
        fontWeight: '600',
        marginTop: 0.5,
    },
    expandPillBtn: {
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 2,
    },
    rightContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    trophyBtn: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 0.5,
        borderColor: '#ffd700',
    },
    onlineUserBubbles: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 11,
        paddingHorizontal: 5,
        paddingVertical: 2.5,
        borderWidth: 0.5,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    miniAvatar: {
        width: 14,
        height: 14,
        borderRadius: 7,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 0.8,
        borderColor: '#070B24',
    },
    onlineCountTextWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 4,
        gap: 1.5,
    },
    onlineCountText: {
        fontSize: 8,
        color: '#34d399',
        fontWeight: 'bold',
    },
    actionBtn: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 0.5,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    exitBtn: {
        backgroundColor: 'rgba(255,59,48,0.12)',
        borderColor: 'rgba(255,59,48,0.25)',
    },
    vipAvatarsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 4,
    },
    vipHeaderAvatar: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 1.2,
        borderColor: '#fff',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        overflow: 'hidden',
    },
    vipAvatarImg: {
        width: '100%',
        height: '100%',
    },
    vipGold: {
        borderColor: '#ffd700',
    },
    vipSilver: {
        borderColor: '#c0c0c0',
    },
    vipBronze: {
        borderColor: '#cd7f32',
    },
});
