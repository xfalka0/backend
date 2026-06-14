import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function RoomTopHeader({ room, onlineCount, onBack, onOpenSettings, insets }) {
    const roomId = room?.id?.slice(0, 7)?.toUpperCase() || '4086795';

    return (
        <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
            {/* Left compact pill */}
            <View style={styles.leftContainer}>
                <View style={styles.roomPill}>
                    <TouchableOpacity style={styles.speakerBtn}>
                        <Ionicons name="volume-medium-sharp" size={13} color="#fff" />
                    </TouchableOpacity>
                    <View style={styles.roomTextContainer}>
                        <Text style={styles.roomTitle} numberOfLines={1}>
                            {room?.title || 'CİLVELİ KIZLAR'}
                        </Text>
                        <Text style={styles.roomId}>ID:{roomId}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={10} color="rgba(255,255,255,0.4)" style={{ marginRight: 4 }} />
                </View>
            </View>

            {/* Right compact actions */}
            <View style={styles.rightContainer}>
                {/* 3 VIP Avatars */}
                <View style={styles.vipAvatarsRow}>
                    <View style={[styles.vipHeaderAvatar, styles.vipGold]}>
                        <Image
                            source={{ uri: 'https://randomuser.me/api/portraits/women/32.jpg' }}
                            style={styles.vipAvatarImg}
                        />
                    </View>
                    <View style={[styles.vipHeaderAvatar, styles.vipSilver]}>
                        <Image
                            source={{ uri: 'https://randomuser.me/api/portraits/men/45.jpg' }}
                            style={styles.vipAvatarImg}
                        />
                    </View>
                    <View style={[styles.vipHeaderAvatar, styles.vipBronze]}>
                        <Image
                            source={{ uri: 'https://randomuser.me/api/portraits/women/68.jpg' }}
                            style={styles.vipAvatarImg}
                        />
                    </View>
                </View>
 
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
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        borderRadius: 14,
        paddingLeft: 4,
        paddingRight: 6,
        paddingVertical: 3,
        gap: 6,
        borderWidth: 0.5,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    speakerBtn: {
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    roomTextContainer: {
        justifyContent: 'center',
    },
    roomTitle: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#fff',
        maxWidth: 90,
    },
    roomId: {
        fontSize: 7.5,
        color: 'rgba(255,255,255,0.5)',
        fontWeight: '600',
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
});
