import React, { useEffect, useRef } from 'react';
import {
    Modal, View, Text, StyleSheet, TouchableOpacity,
    Dimensions, Animated, ScrollView, Image, Alert
} from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import VipFrame from '../ui/VipFrame';
import { useGiftStore } from '../../store/useGiftStore';

const { width, height } = Dimensions.get('window');

export default function UserProfileBottomSheet({ visible, user, seat, currentUser, isHost, onClose, onKick, onMute, onGift, navigation }) {
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

    return (
        <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
            <View style={styles.backdrop}>
                <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
            </View>
            <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
                {/* Handle */}
                <View style={styles.handle} />

                {/* Profile Header */}
                <View style={styles.profileHeader}>
                    <VipFrame
                        level={user.vip_level || 0}
                        avatar={user.avatar_url}
                        size={72}
                        isStatic={true}
                    />
                    <View style={styles.profileInfo}>
                        <Text style={styles.profileName}>
                            {user.display_name || user.username}
                        </Text>
                        {user.level && (
                            <LinearGradient colors={['#ec4899', '#8b5cf6']} style={styles.levelBadge}>
                                <Text style={styles.levelText}>Lv. {user.level}</Text>
                            </LinearGradient>
                        )}
                        <Text style={styles.profileId}>ID: {user.id?.slice?.(0, 8)?.toUpperCase?.() ?? user.id}</Text>
                    </View>
                </View>

                {/* Stats row */}
                <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{user.follower_count ?? '—'}</Text>
                        <Text style={styles.statLabel}>Takipçi</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{user.following_count ?? '—'}</Text>
                        <Text style={styles.statLabel}>Takip</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{user.gift_count ?? '—'}</Text>
                        <Text style={styles.statLabel}>Hediye</Text>
                    </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.actionBtn} onPress={handleViewProfile}>
                        <Ionicons name="person-outline" size={18} color="#fff" />
                        <Text style={styles.actionBtnText}>Profil</Text>
                    </TouchableOpacity>

                    {!isMe && (
                        <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPrimary]} onPress={handleGift}>
                            <Ionicons name="gift-outline" size={18} color="#fff" />
                            <Text style={styles.actionBtnText}>Hediye</Text>
                        </TouchableOpacity>
                    )}

                    {!isMe && (
                        <TouchableOpacity style={styles.actionBtn}>
                            <Ionicons name="person-add-outline" size={18} color="#fff" />
                            <Text style={styles.actionBtnText}>Takip Et</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Host/Admin Controls */}
                {isHost && !isMe && seat && (
                    <View style={styles.moderationSection}>
                        <Text style={styles.moderationTitle}>Yönetici Kontrolleri</Text>
                        <View style={styles.moderationRow}>
                            <TouchableOpacity
                                style={styles.modBtn}
                                onPress={() => { onMute?.(); onClose(); }}
                            >
                                <Ionicons name={isMuted ? 'mic-outline' : 'mic-off-outline'} size={16} color="#fbbf24" />
                                <Text style={styles.modBtnText}>{isMuted ? 'Sesi Aç' : 'Sustur'}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modBtn, styles.modBtnDanger]}
                                onPress={() => {
                                    onKick?.();
                                    onClose();
                                }}
                            >
                                <Ionicons name="exit-outline" size={16} color="#ef4444" />
                                <Text style={[styles.modBtnText, { color: '#ef4444' }]}>Koltuktan İndir</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* Leave seat for self */}
                {isMe && seat && (
                    <TouchableOpacity
                        style={styles.leaveSeatBtn}
                        onPress={() => {
                            onKick?.();
                            onClose();
                        }}
                    >
                        <Ionicons name="exit-outline" size={16} color="#ef4444" />
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
        backgroundColor: 'rgba(0,0,0,0.65)',
    },
    sheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#0f0720',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        paddingBottom: 34,
        paddingHorizontal: 20,
        paddingTop: 8,
    },
    handle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignSelf: 'center',
        marginBottom: 16,
    },
    profileHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        marginBottom: 16,
    },
    profileInfo: {
        flex: 1,
        gap: 4,
    },
    profileName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
    },
    levelBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    levelText: {
        fontSize: 11,
        color: '#fff',
        fontWeight: 'bold',
    },
    profileId: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.4)',
    },
    statsRow: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 12,
        marginBottom: 16,
        alignItems: 'center',
        justifyContent: 'space-around',
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
    },
    statLabel: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.4)',
        marginTop: 2,
    },
    statDivider: {
        width: 1,
        height: 28,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    actionRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 16,
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 14,
        paddingVertical: 10,
        gap: 6,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    actionBtnPrimary: {
        backgroundColor: 'rgba(236,72,153,0.2)',
        borderColor: '#ec4899',
    },
    actionBtnText: {
        fontSize: 12,
        color: '#fff',
        fontWeight: '600',
    },
    moderationSection: {
        borderTopWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        paddingTop: 14,
    },
    moderationTitle: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.4)',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 10,
    },
    moderationRow: {
        flexDirection: 'row',
        gap: 10,
    },
    modBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: 'rgba(251,191,36,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(251,191,36,0.3)',
        borderRadius: 12,
        paddingVertical: 10,
    },
    modBtnDanger: {
        backgroundColor: 'rgba(239,68,68,0.1)',
        borderColor: 'rgba(239,68,68,0.3)',
    },
    modBtnText: {
        fontSize: 12,
        color: '#fbbf24',
        fontWeight: '600',
    },
    leaveSeatBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: 'rgba(239,68,68,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(239,68,68,0.3)',
        borderRadius: 14,
        paddingVertical: 12,
        marginTop: 4,
    },
    leaveSeatText: {
        fontSize: 14,
        color: '#ef4444',
        fontWeight: '600',
    },
});
