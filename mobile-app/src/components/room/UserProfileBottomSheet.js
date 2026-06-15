import React, { useEffect, useRef } from 'react';
import {
    Modal, View, Text, StyleSheet, TouchableOpacity,
    Dimensions, Animated, Image, Alert
} from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import VipFrame from '../ui/VipFrame';
import { useGiftStore } from '../../store/useGiftStore';

const { width, height } = Dimensions.get('window');

// ─── Sub-Component: UserMiniProfileHeader ─────────────────────────────────
function UserMiniProfileHeader({ user }) {
    const initials = (user.display_name || user.username || 'K').charAt(0).toUpperCase();
    
    return (
        <View style={styles.headerContainer}>
            <View style={styles.avatarWrapper}>
                {user.avatar_url ? (
                    <VipFrame
                        level={user.vip_level || 0}
                        avatar={user.avatar_url}
                        size={74}
                        isStatic={true}
                    />
                ) : (
                    <LinearGradient
                        colors={['#7B2CFF', '#FF4D8D']}
                        style={styles.avatarPlaceholder}
                    >
                        <Text style={styles.avatarInitials}>{initials}</Text>
                    </LinearGradient>
                )}
                {/* Online Status Ring Dot */}
                <View style={styles.onlineStatusDot} />
            </View>

            <View style={styles.profileInfo}>
                <View style={styles.nameRow}>
                    <Text style={styles.profileName} numberOfLines={1}>
                        {user.display_name || user.username}
                    </Text>
                    {user.vip_level > 0 && (
                        <LinearGradient
                            colors={['#FF9B3D', '#FF4D8D']}
                            style={styles.vipBadge}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <Text style={styles.vipBadgeText}>VIP {user.vip_level}</Text>
                        </LinearGradient>
                    )}
                </View>
                
                <Text style={styles.profileId}>ID: {user.id?.slice?.(0, 8)?.toUpperCase?.() ?? user.id}</Text>

                {/* Level and Agency Badges */}
                <View style={styles.badgesRow}>
                    <LinearGradient
                        colors={['#FF4D8D', '#7B2CFF']}
                        style={styles.levelBadge}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <Text style={styles.levelText}>Lv. {user.level || 1}</Text>
                    </LinearGradient>

                    {user.agency_name && (
                        <View style={styles.agencyBadge}>
                            <Ionicons name="shield-checkmark" size={10} color="#00D5FF" />
                            <Text style={styles.agencyText} numberOfLines={1}>{user.agency_name}</Text>
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
}

// ─── Sub-Component: UserStatsRow ──────────────────────────────────────────
function UserStatsRow({ user }) {
    const followers = user.follower_count !== undefined && user.follower_count !== null && user.follower_count !== '—' ? user.follower_count : 0;
    const following = user.following_count !== undefined && user.following_count !== null && user.following_count !== '—' ? user.following_count : 0;
    const gifts = user.gift_count !== undefined && user.gift_count !== null && user.gift_count !== '—' ? user.gift_count : 0;

    return (
        <View style={styles.statsRow}>
            <View style={styles.statItem}>
                <Text style={styles.statValue}>{followers}</Text>
                <Text style={styles.statLabel}>Takipçi</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
                <Text style={styles.statValue}>{following}</Text>
                <Text style={styles.statLabel}>Takip</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
                <Text style={styles.statValue}>{gifts}</Text>
                <Text style={styles.statLabel}>Hediye</Text>
            </View>
        </View>
    );
}

// ─── Sub-Component: UserQuickActions ──────────────────────────────────────
function UserQuickActions({ isMe, handleViewProfile, handleGift, handleMessage, handleFollow }) {
    return (
        <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={handleViewProfile}>
                <Ionicons name="person-outline" size={18} color="#FFFFFF" />
                <Text style={styles.actionBtnText}>Profil</Text>
            </TouchableOpacity>

            {!isMe && (
                <>
                    <TouchableOpacity style={styles.actionBtn} onPress={handleFollow}>
                        <Ionicons name="person-add-outline" size={18} color="#FFFFFF" />
                        <Text style={styles.actionBtnText}>Takip Et</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionBtn} onPress={handleMessage}>
                        <Ionicons name="chatbubble-ellipses-outline" size={18} color="#FFFFFF" />
                        <Text style={styles.actionBtnText}>Mesaj</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPrimary]} onPress={handleGift}>
                        <Ionicons name="gift-outline" size={18} color="#FFFFFF" />
                        <Text style={styles.actionBtnText}>Hediye</Text>
                    </TouchableOpacity>
                </>
            )}
        </View>
    );
}

// ─── Sub-Component: ModeratorActions ─────────────────────────────────────
function ModeratorActions({ isMuted, onMutePress, onKickPress, onBanPress }) {
    return (
        <View style={styles.moderationSection}>
            <Text style={styles.moderationTitle}>Yönetici Kontrolleri</Text>
            <View style={styles.moderationRow}>
                <TouchableOpacity style={styles.modBtn} onPress={onMutePress}>
                    <Ionicons name={isMuted ? 'mic-outline' : 'mic-off-outline'} size={15} color="#FF9B3D" />
                    <Text style={styles.modBtnText}>{isMuted ? 'Sesi Aç' : 'Sustur'}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.modBtn, styles.modBtnDanger]} onPress={onKickPress}>
                    <Ionicons name="exit-outline" size={15} color="#FF4D8D" />
                    <Text style={[styles.modBtnText, { color: '#FF4D8D' }]}>Koltuktan İndir</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.modBtn, styles.modBtnDanger]} onPress={onBanPress}>
                    <Ionicons name="ban-outline" size={15} color="#FF4D8D" />
                    <Text style={[styles.modBtnText, { color: '#FF4D8D' }]}>Odadan At</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

// ─── Main Component: RoomUserBottomSheet (Default Export) ─────────────────
export default function RoomUserBottomSheet({ visible, user, seat, currentUser, isHost, onClose, onKick, onMute, onGift, navigation }) {
    const slideAnim = useRef(new Animated.Value(height)).current;
    const { openGiftPicker } = useGiftStore();

    useEffect(() => {
        if (visible) {
            Animated.spring(slideAnim, {
                toValue: 0, tension: 65, friction: 12, useNativeDriver: true
            }).start();
        } else {
            Animated.timing(slideAnim, {
                toValue: height, duration: 300, useNativeDriver: true
            }).start();
        }
    }, [visible]);

    if (!visible || !user) return null;

    const isMe = currentUser?.id && user.id?.toString() === currentUser.id?.toString();
    const isMuted = seat?.is_muted || false;

    const handleGift = () => {
        onClose();
        openGiftPicker(seat);
    };

    const handleViewProfile = () => {
        onClose();
        if (navigation && user.id) {
            navigation.navigate('Profile', { userId: user.id });
        }
    };

    const handleMessage = () => {
        onClose();
        if (navigation && user.id) {
            navigation.navigate('Chat', {
                operatorId: user.id,
                name: user.display_name || user.username,
                avatar_url: user.avatar_url,
                user: currentUser
            });
        }
    };

    const handleFollow = () => {
        Alert.alert('Başarılı', `${user.display_name || user.username} takip edildi!`);
    };

    const handleBan = () => {
        Alert.alert('Odadan At', `${user.display_name || user.username} odadan uzaklaştırılıyor.`, [
            { text: 'Evet', onPress: () => {
                onKick?.();
                onClose();
            }},
            { text: 'Hayır', style: 'cancel' }
        ]);
    };

    return (
        <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
            {/* Dark Dim Backdrop */}
            <View style={styles.backdrop}>
                <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
            </View>

            <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
                {/* Drag Handle */}
                <View style={styles.handle} />

                {/* Sub-Component: User Profile Header */}
                <UserMiniProfileHeader user={user} />

                {/* Sub-Component: Stats Row */}
                <UserStatsRow user={user} />

                {/* Sub-Component: Quick Actions Row */}
                <UserQuickActions
                    isMe={isMe}
                    handleViewProfile={handleViewProfile}
                    handleGift={handleGift}
                    handleMessage={handleMessage}
                    handleFollow={handleFollow}
                />

                {/* Sub-Component: Host Moderation controls */}
                {isHost && !isMe && seat && (
                    <ModeratorActions
                        isMuted={isMuted}
                        onMutePress={() => { onMute?.(); onClose(); }}
                        onKickPress={() => { onKick?.(); onClose(); }}
                        onBanPress={handleBan}
                    />
                )}

                {/* Symmetrical Premium outline button for leaving own seat */}
                {isMe && seat && (
                    <TouchableOpacity
                        style={styles.leaveSeatBtn}
                        onPress={() => {
                            onKick?.();
                            onClose();
                        }}
                    >
                        <Ionicons name="exit-outline" size={16} color="#FF4D8D" />
                        <Text style={styles.leaveSeatText}>Koltuktan Çık</Text>
                    </TouchableOpacity>
                )}
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
    },
    sheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#100720', // Luxurious deep violet/navy
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        paddingBottom: 34,
        paddingHorizontal: 20,
        paddingTop: 8,
    },
    handle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignSelf: 'center',
        marginBottom: 16,
    },
    headerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        marginBottom: 16,
    },
    avatarWrapper: {
        position: 'relative',
    },
    avatarPlaceholder: {
        width: 74,
        height: 74,
        borderRadius: 37,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarInitials: {
        color: '#FFFFFF',
        fontSize: 26,
        fontWeight: '900',
    },
    onlineStatusDot: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#00D5FF', // Neon Cyan
        borderWidth: 2,
        borderColor: '#100720',
        zIndex: 10,
    },
    profileInfo: {
        flex: 1,
        gap: 3.5,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6.5,
    },
    profileName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    vipBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    vipBadgeText: {
        color: '#FFFFFF',
        fontSize: 8.5,
        fontWeight: '900',
    },
    profileId: {
        fontSize: 11.5,
        color: 'rgba(255, 255, 255, 0.45)',
    },
    badgesRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 2,
    },
    levelBadge: {
        paddingHorizontal: 7,
        paddingVertical: 2.5,
        borderRadius: 8,
    },
    levelText: {
        fontSize: 10,
        color: '#FFFFFF',
        fontWeight: '800',
    },
    agencyBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 213, 255, 0.08)',
        borderWidth: 0.5,
        borderColor: 'rgba(0, 213, 255, 0.25)',
        paddingHorizontal: 6,
        paddingVertical: 2.5,
        borderRadius: 8,
        gap: 3.5,
        maxWidth: 110,
    },
    agencyText: {
        color: '#00D5FF',
        fontSize: 9.5,
        fontWeight: '700',
    },
    statsRow: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 8,
        marginBottom: 16,
        alignItems: 'center',
        justifyContent: 'space-around',
        borderWidth: 0.5,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    statLabel: {
        fontSize: 10,
        color: 'rgba(255, 255, 255, 0.45)',
        marginTop: 2.5,
    },
    statDivider: {
        width: 1,
        height: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    actionRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.055)',
        borderRadius: 14,
        paddingVertical: 11,
        gap: 6.5,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    actionBtnPrimary: {
        backgroundColor: 'rgba(255, 77, 141, 0.12)',
        borderColor: '#FF4D8D',
    },
    actionBtnText: {
        fontSize: 12.5,
        color: '#FFFFFF',
        fontWeight: '600',
    },
    moderationSection: {
        borderTopWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
        paddingTop: 14,
        marginBottom: 4,
    },
    moderationTitle: {
        fontSize: 10.5,
        color: 'rgba(255, 255, 255, 0.45)',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 10,
    },
    moderationRow: {
        flexDirection: 'row',
        gap: 8,
    },
    modBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5.5,
        backgroundColor: 'rgba(255, 155, 61, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255, 155, 61, 0.25)',
        borderRadius: 12,
        paddingVertical: 10.5,
    },
    modBtnDanger: {
        backgroundColor: 'rgba(255, 77, 141, 0.08)',
        borderColor: 'rgba(255, 77, 141, 0.25)',
    },
    modBtnText: {
        fontSize: 12,
        color: '#FF9B3D',
        fontWeight: '600',
    },
    leaveSeatBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: 'rgba(255, 77, 141, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255, 77, 141, 0.25)',
        borderRadius: 14,
        paddingVertical: 12,
        marginTop: 4,
    },
    leaveSeatText: {
        fontSize: 13.5,
        color: '#FF4D8D',
        fontWeight: '600',
    },
});
