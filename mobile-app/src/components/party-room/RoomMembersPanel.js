import React, { useState, useEffect, useMemo } from 'react';
import {
    Modal, View, Text, StyleSheet, TouchableOpacity,
    TextInput, FlatList, Image, Dimensions, Alert, ActivityIndicator
} from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRoomStore } from '../../store/useRoomStore';
import { resolveImageUrl } from '../../utils/imageUtils';

const { width, height } = Dimensions.get('window');

const cleanUsername = (name) => {
    if (!name) return '';
    let cleaned = name.replace(/^op_/i, '');
    cleaned = cleaned.replace(/_\d+(-\d+)?$/g, '');
    if (name.toLowerCase().startsWith('op_') && cleaned.length > 0) {
        cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
    return cleaned;
};

// ─── Sub-Component: MemberRoleBadge ──────────────────────────────────────────
export function MemberRoleBadge({ role }) {
    let colors = ['#6B7280', '#4B5563'];
    let text = 'Üye';

    switch (role) {
        case 'room_owner':
            colors = ['#FF4D8D', '#FF9B3D'];
            text = 'Kurucu';
            break;
        case 'room_admin':
            colors = ['#A855F7', '#6366F1'];
            text = 'Admin';
            break;
        case 'room_moderator':
            colors = ['#06B6D4', '#3B82F6'];
            text = 'Mod';
            break;
        case 'speaker':
            colors = ['#10B981', '#059669'];
            text = 'Konuşmacı';
            break;
        case 'listener':
            colors = ['#374151', '#1F2937'];
            text = 'Dinleyici';
            break;
    }

    return (
        <LinearGradient
            colors={colors}
            style={styles.roleBadge}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
        >
            <Text style={styles.roleBadgeText}>{text}</Text>
        </LinearGradient>
    );
}

// ─── Sub-Component: MemberListItem ───────────────────────────────────────────
export function MemberListItem({ item, onSelect, isBannedTab, onUnban }) {
    const initials = (cleanUsername(item.display_name || item.username) || 'K').charAt(0).toUpperCase();

    return (
        <View style={styles.listItem}>
            <View style={styles.listItemLeft}>
                {item.avatar_url ? (
                    <Image source={{ uri: resolveImageUrl(item.avatar_url) }} style={styles.avatar} />
                ) : (
                    <LinearGradient
                        colors={['#7B2CFF', '#FF4D8D']}
                        style={styles.avatarPlaceholder}
                    >
                        <Text style={styles.avatarInitials}>{initials}</Text>
                    </LinearGradient>
                )}
                <View style={styles.memberInfo}>
                    <View style={styles.nameRow}>
                        <Text style={styles.memberName} numberOfLines={1}>
                            {cleanUsername(item.display_name || item.username)}
                        </Text>
                        {item.vip_level > 0 && (
                            <LinearGradient
                                colors={['#FF9B3D', '#FF4D8D']}
                                style={styles.vipBadge}
                            >
                                <Text style={styles.vipBadgeText}>VIP {item.vip_level}</Text>
                            </LinearGradient>
                        )}
                    </View>
                    <Text style={styles.memberMeta}>
                        ID: {item.user_id?.slice?.(0, 8)?.toUpperCase() || item.user_id || item.id?.slice?.(0, 8)}
                        {item.level && ` • Lv.${item.level}`}
                        {item.seat_number !== undefined && item.seat_number !== null && ` • Koltuk ${item.seat_number}`}
                    </Text>
                    <View style={styles.tagsRow}>
                        {!isBannedTab && <MemberRoleBadge role={item.role} />}
                        {item.is_muted && (
                            <View style={styles.muteIndicator}>
                                <Ionicons name="mic-off" size={10} color="#FF9B3D" />
                                <Text style={styles.muteIndicatorText}>Susturuldu</Text>
                            </View>
                        )}
                        {isBannedTab && (
                            <Text style={styles.bannedByText}>
                                Engelleyen ID: {item.banned_by?.slice(0, 8)?.toUpperCase()}
                            </Text>
                        )}
                    </View>
                </View>
            </View>

            <View style={styles.listItemRight}>
                {isBannedTab ? (
                    <TouchableOpacity style={styles.unbanBtn} onPress={() => onUnban(item.user_id)}>
                        <Text style={styles.unbanBtnText}>Yasağı Kaldır</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity style={styles.optionsBtn} onPress={() => onSelect(item)}>
                        <Ionicons name="ellipsis-horizontal" size={18} color="rgba(255,255,255,0.6)" />
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}

// ─── Sub-Component: MemberEmptyState ──────────────────────────────────────────
export function MemberEmptyState({ text }) {
    return (
        <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color="rgba(255,255,255,0.15)" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyStateText}>{text || 'Bulunamadı'}</Text>
        </View>
    );
}

// ─── Sub-Component: MemberManagementSheet ────────────────────────────────────
export function MemberManagementSheet({
    visible,
    user,
    currentUser,
    membersList,
    onClose,
    onMute,
    onKick,
    onBan,
    onAssignRole,
    onInviteToSeat,
    onRemoveFromSeat,
    onViewProfile,
    onSendMessage,
    onFollow,
    onReport
}) {
    if (!visible || !user) return null;

    // Resolve roles
    const myId = currentUser?.id?.toString();
    const targetId = user.user_id?.toString() || user.id?.toString();

    const isMe = myId === targetId;

    // Find local roles in membership list
    const myMember = membersList.find(m => m.user_id?.toString() === myId);
    const targetMember = membersList.find(m => m.user_id?.toString() === targetId) || user;

    const myRole = myMember?.role || 'listener';
    const targetRole = targetMember?.role || 'listener';

    // Authority tiers
    const isGlobalAdmin = ['admin', 'super_admin'].includes(currentUser?.role);
    const isOwner = myRole === 'room_owner' || isGlobalAdmin;
    const isAdmin = myRole === 'room_admin' || isOwner;
    const isMod = myRole === 'room_moderator' || isAdmin;

    // Hierarchy check: Caller must be strictly higher tier than target
    const getTier = (role) => {
        if (role === 'room_owner') return 5;
        if (role === 'room_admin') return 4;
        if (role === 'room_moderator') return 3;
        if (role === 'speaker') return 2;
        return 1; // listener / member
    };

    const myTier = getTier(myRole);
    const targetTier = getTier(targetRole);

    const hasModerationRights = isMod && myTier > targetTier && !isMe;
    const isTargetOnSeat = targetMember.seat_number !== undefined && targetMember.seat_number !== null;

    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
            <View style={styles.sheetBackdrop}>
                <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
                <View style={styles.sheetContent}>
                    <View style={styles.sheetHandle} />
                    <Text style={styles.sheetTitle}>{cleanUsername(targetMember.display_name || targetMember.username)}</Text>
                    <Text style={styles.sheetSubtitle}>ID: {targetId?.slice(0, 8)?.toUpperCase()}</Text>

                    <View style={styles.sheetGrid}>
                        {/* Everyone actions */}
                        <TouchableOpacity style={styles.gridBtn} onPress={() => { onViewProfile(targetId); onClose(); }}>
                            <Ionicons name="person-circle-outline" size={20} color="#00D5FF" />
                            <Text style={styles.gridBtnText}>Profili Gör</Text>
                        </TouchableOpacity>

                        {!isMe && (
                            <>
                                <TouchableOpacity style={styles.gridBtn} onPress={() => { onFollow(targetMember); onClose(); }}>
                                    <Ionicons name="person-add-outline" size={20} color="#00D5FF" />
                                    <Text style={styles.gridBtnText}>Takip Et</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.gridBtn} onPress={() => { onSendMessage(targetMember); onClose(); }}>
                                    <Ionicons name="chatbubble-ellipses-outline" size={20} color="#00D5FF" />
                                    <Text style={styles.gridBtnText}>Mesaj Gönder</Text>
                                </TouchableOpacity>
                            </>
                        )}

                        {/* Moderation actions */}
                        {hasModerationRights && (
                            <>
                                {/* Seat controls */}
                                {isTargetOnSeat ? (
                                    <TouchableOpacity style={styles.gridBtn} onPress={() => { onRemoveFromSeat(targetMember); onClose(); }}>
                                        <Ionicons name="exit-outline" size={20} color="#FF9B3D" />
                                        <Text style={styles.gridBtnText}>Koltuktan İndir</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity style={styles.gridBtn} onPress={() => { onInviteToSeat(targetMember); onClose(); }}>
                                        <Ionicons name="mic-outline" size={20} color="#00D5FF" />
                                        <Text style={styles.gridBtnText}>Koltuğa Al</Text>
                                    </TouchableOpacity>
                                )}

                                {/* Mute controls */}
                                <TouchableOpacity style={styles.gridBtn} onPress={() => { onMute(targetId, !targetMember.is_muted); onClose(); }}>
                                    <Ionicons name={targetMember.is_muted ? 'mic' : 'mic-off'} size={20} color="#FF9B3D" />
                                    <Text style={styles.gridBtnText}>{targetMember.is_muted ? 'Sesi Aç' : 'Sustur'}</Text>
                                </TouchableOpacity>

                                {/* Role promotions (Owner only) */}
                                {isOwner && (
                                    <>
                                        {targetRole === 'room_admin' ? (
                                            <TouchableOpacity style={styles.gridBtn} onPress={() => { onAssignRole(targetId, 'listener'); onClose(); }}>
                                                <Ionicons name="shield-outline" size={20} color="#FF4D8D" />
                                                <Text style={styles.gridBtnText}>Adminlik Kaldır</Text>
                                            </TouchableOpacity>
                                        ) : (
                                            <TouchableOpacity style={styles.gridBtn} onPress={() => { onAssignRole(targetId, 'room_admin'); onClose(); }}>
                                                <Ionicons name="shield-checkmark" size={20} color="#A855F7" />
                                                <Text style={styles.gridBtnText}>Admin Yap</Text>
                                            </TouchableOpacity>
                                        )}

                                        {targetRole === 'room_moderator' ? (
                                            <TouchableOpacity style={styles.gridBtn} onPress={() => { onAssignRole(targetId, 'listener'); onClose(); }}>
                                                <Ionicons name="star-outline" size={20} color="#FF4D8D" />
                                                <Text style={styles.gridBtnText}>Mod Yetkisi Al</Text>
                                            </TouchableOpacity>
                                        ) : (
                                            <TouchableOpacity style={styles.gridBtn} onPress={() => { onAssignRole(targetId, 'room_moderator'); onClose(); }}>
                                                <Ionicons name="star" size={20} color="#06B6D4" />
                                                <Text style={styles.gridBtnText}>Moderatör Yap</Text>
                                            </TouchableOpacity>
                                        )}
                                    </>
                                )}

                                {/* Destructive actions */}
                                <TouchableOpacity style={[styles.gridBtn, styles.dangerBtn]} onPress={() => { onKick(targetId); onClose(); }}>
                                    <Ionicons name="log-out" size={20} color="#FF4D8D" />
                                    <Text style={[styles.gridBtnText, { color: '#FF4D8D' }]}>Odadan At</Text>
                                </TouchableOpacity>

                                {/* Ban action (Admin and Owner only) */}
                                {isAdmin && (
                                    <TouchableOpacity style={[styles.gridBtn, styles.dangerBtn]} onPress={() => { onBan(targetId); onClose(); }}>
                                        <Ionicons name="ban" size={20} color="#FF4D8D" />
                                        <Text style={[styles.gridBtnText, { color: '#FF4D8D' }]}>Yasakla</Text>
                                    </TouchableOpacity>
                                )}
                            </>
                        )}

                        {!isMe && !hasModerationRights && (
                            <TouchableOpacity style={[styles.gridBtn, styles.dangerBtn]} onPress={() => { onReport(targetMember); onClose(); }}>
                                <Ionicons name="flag-outline" size={20} color="#FF4D8D" />
                                <Text style={[styles.gridBtnText, { color: '#FF4D8D' }]}>Şikayet Et</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    <TouchableOpacity style={styles.closeSheetBtn} onPress={onClose}>
                        <Text style={styles.closeSheetText}>Kapat</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

// ─── Main Component: RoomMembersPanel (Default Export) ───────────────────────
export default function RoomMembersPanel({ visible, roomId, currentUser, onClose, navigation, onSendMessage }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTab, setSelectedTab] = useState('all'); // all, speakers, listeners, banned
    const [selectedMember, setSelectedMember] = useState(null);

    const members = useRoomStore(s => s.members);
    const bannedMembers = useRoomStore(s => s.bannedMembers);
    const fetchMembers = useRoomStore(s => s.fetchMembers);
    const fetchBannedMembers = useRoomStore(s => s.fetchBannedMembers);

    const promoteToRoomAdmin = useRoomStore(s => s.promoteToRoomAdmin);
    const demoteRoomAdmin = useRoomStore(s => s.demoteRoomAdmin);
    const promoteToModerator = useRoomStore(s => s.promoteToModerator);
    const demoteModerator = useRoomStore(s => s.demoteModerator);
    const muteMember = useRoomStore(s => s.muteMember);
    const kickMember = useRoomStore(s => s.kickMember);
    const banMember = useRoomStore(s => s.banMember);
    const unbanMember = useRoomStore(s => s.unbanMember);

    const takeSeat = useRoomStore(s => s.takeSeat);
    const lockSeat = useRoomStore(s => s.lockSeat);

    // Initial Load
    useEffect(() => {
        if (visible && roomId) {
            fetchMembers(roomId, searchQuery);
            fetchBannedMembers(roomId);
        }
    }, [visible, roomId]);

    // Handle Search
    const handleSearch = (text) => {
        setSearchQuery(text);
        if (roomId) {
            fetchMembers(roomId, text);
        }
    };

    // Filter List based on tab selection
    const filteredList = useMemo(() => {
        if (selectedTab === 'banned') {
            return bannedMembers;
        }
        return members.filter(member => {
            if (selectedTab === 'speakers') {
                return member.seat_number !== undefined && member.seat_number !== null;
            }
            if (selectedTab === 'listeners') {
                return member.seat_number === undefined || member.seat_number === null;
            }
            return true; // all
        });
    }, [members, bannedMembers, selectedTab]);

    // Actions implementation
    const handleMute = (userId, shouldMute) => {
        muteMember(roomId, userId, shouldMute);
    };

    const handleKick = (userId) => {
        Alert.alert('Odadan At', 'Kullanıcıyı odadan atmak istediğinize emin misiniz?', [
            { text: 'Evet', style: 'destructive', onPress: () => kickMember(roomId, userId) },
            { text: 'İptal', style: 'cancel' }
        ]);
    };

    const handleBan = (userId) => {
        Alert.alert('Yasakla', 'Kullanıcıyı bu odaya girişe kapatmak istiyor musunuz?', [
            { text: 'Evet', style: 'destructive', onPress: () => banMember(roomId, userId, 'Yönetici kararı') },
            { text: 'İptal', style: 'cancel' }
        ]);
    };

    const handleUnban = (userId) => {
        unbanMember(roomId, userId);
    };

    const handleAssignRole = (userId, role) => {
        if (role === 'room_admin') {
            Alert.alert('Admin Yap', 'Bu kullanıcıyı oda admini yapmak istiyor musunuz?', [
                { text: 'Evet', onPress: () => promoteToRoomAdmin(roomId, userId) },
                { text: 'İptal', style: 'cancel' }
            ]);
        } else if (role === 'room_moderator') {
            Alert.alert('Moderatör Yap', 'Bu kullanıcıyı oda moderatörü yapmak istiyor musunuz?', [
                { text: 'Evet', onPress: () => promoteToModerator(roomId, userId) },
                { text: 'İptal', style: 'cancel' }
            ]);
        } else {
            // demote
            const member = members.find(m => m.user_id === userId);
            if (member?.role === 'room_admin') {
                demoteRoomAdmin(roomId, userId);
            } else {
                demoteModerator(roomId, userId);
            }
        }
    };

    const handleInviteToSeat = (member) => {
        // Find a free seat in the room
        const seats = useRoomStore.getState().seats;
        const freeSeat = seats.find(s => !s.user_id && !s.is_locked);
        if (freeSeat) {
            Alert.alert('Koltuğa Davet Et', `${cleanUsername(member.display_name || member.username)} koltuğa alınacaktır. Onaylıyor musunuz?`, [
                { text: 'Onayla', onPress: () => {
                    const SocketService = require('../../services/SocketService').default;
                    // Direct socket assign for moderation invite
                    SocketService.takeSeat(roomId, freeSeat.seat_number, member.user_id);
                }},
                { text: 'İptal', style: 'cancel' }
            ]);
        } else {
            Alert.alert('Hata', 'Odadaki tüm koltuklar dolu veya kilitli.');
        }
    };

    const handleRemoveFromSeat = (member) => {
        if (member.seat_number !== undefined && member.seat_number !== null) {
            Alert.alert('Koltuktan İndir', `${cleanUsername(member.display_name || member.username)} koltuktan indirilsin mi?`, [
                { text: 'Evet', style: 'destructive', onPress: () => lockSeat(member.seat_number, true) },
                { text: 'İptal', style: 'cancel' }
            ]);
        }
    };

    const handleViewProfile = (userId) => {
        onClose();
        if (navigation) {
            navigation.navigate('Profile', { userId });
        }
    };

    const handleSendMessage = (member) => {
        onClose();
        if (onSendMessage) {
            onSendMessage(member);
        } else if (navigation) {
            navigation.navigate('Chat', {
                operatorId: member.user_id,
                name: cleanUsername(member.display_name || member.username),
                avatar_url: member.avatar_url,
                vip_level: member.vip_level || 0,
                user: currentUser
            });
        }
    };

    const handleFollow = (member) => {
        Alert.alert('Başarılı', `${cleanUsername(member.display_name || member.username)} takip edildi!`);
    };

    const handleReport = (member) => {
        Alert.alert('Şikayet Et', `${cleanUsername(member.display_name || member.username)} şikayet edildi. İncelemeye alındı.`);
    };

    // Tabs definition
    const tabs = [
        { id: 'all', title: 'Tümü' },
        { id: 'speakers', title: 'Konuşmacılar' },
        { id: 'listeners', title: 'Dinleyiciler' },
        { id: 'banned', title: 'Yasaklılar', minRole: 'room_moderator' }
    ];

    // Check caller local role
    const myMember = members.find(m => m.user_id?.toString() === currentUser?.id?.toString());
    const myRole = myMember?.role || 'listener';
    const isCallerOwner = myRole === 'room_owner' || ['admin', 'super_admin'].includes(currentUser?.role);
    const isCallerAdmin = myRole === 'room_admin' || isCallerOwner;
    const isCallerMod = myRole === 'room_moderator' || isCallerAdmin;

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            {/* Dark glassmorphism modal sheet container */}
            <View style={styles.backdrop}>
                <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
                <View style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.titleRow}>
                            <Text style={styles.title}>Oda Katılımcıları</Text>
                            <View style={styles.countBadge}>
                                <Text style={styles.countBadgeText}>{members.length}</Text>
                            </View>
                        </View>
                        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                            <Ionicons name="close" size={24} color="#FFF" />
                        </TouchableOpacity>
                    </View>

                    {/* Search bar */}
                    <View style={styles.searchContainer}>
                        <Ionicons name="search" size={18} color="rgba(255,255,255,0.4)" style={styles.searchIcon} />
                        <TextInput
                            placeholder="Kullanıcı adı veya ID ile ara..."
                            placeholderTextColor="rgba(255,255,255,0.4)"
                            value={searchQuery}
                            onChangeText={handleSearch}
                            style={styles.searchInput}
                        />
                    </View>

                    {/* Tabs */}
                    <View style={styles.tabsRow}>
                        {tabs.map(tab => {
                            if (tab.minRole) {
                                const isAllowed = (tab.minRole === 'room_moderator' && isCallerMod) ||
                                                 (tab.minRole === 'room_admin' && isCallerAdmin);
                                if (!isAllowed) return null;
                            }
                            const isActive = selectedTab === tab.id;
                            return (
                                <TouchableOpacity
                                    key={tab.id}
                                    style={[styles.tabBtn, isActive && styles.tabBtnActive]}
                                    onPress={() => setSelectedTab(tab.id)}
                                >
                                    <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                                        {tab.title}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* List */}
                    <FlatList
                        data={filteredList}
                        keyExtractor={item => item.id || item.user_id || Math.random().toString()}
                        renderItem={({ item }) => (
                            <MemberListItem
                                item={item}
                                isBannedTab={selectedTab === 'banned'}
                                onUnban={handleUnban}
                                onSelect={(member) => setSelectedMember(member)}
                            />
                        )}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={
                            <MemberEmptyState
                                text={
                                    selectedTab === 'banned'
                                        ? 'Yasaklı kullanıcı bulunmuyor.'
                                        : selectedTab === 'speakers'
                                        ? 'Koltuklarda kimse bulunmuyor.'
                                        : selectedTab === 'listeners'
                                        ? 'Dinleyici odada bulunmuyor.'
                                        : 'Katılımcı listesi boş.'
                                }
                            />
                        }
                    />

                    {/* Action Sheet Modal */}
                    <MemberManagementSheet
                        visible={!!selectedMember}
                        user={selectedMember}
                        currentUser={currentUser}
                        membersList={members}
                        onClose={() => setSelectedMember(null)}
                        onMute={handleMute}
                        onKick={handleKick}
                        onBan={handleBan}
                        onAssignRole={handleAssignRole}
                        onInviteToSeat={handleInviteToSeat}
                        onRemoveFromSeat={handleRemoveFromSeat}
                        onViewProfile={handleViewProfile}
                        onSendMessage={handleSendMessage}
                        onFollow={handleFollow}
                        onReport={handleReport}
                    />
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(7, 4, 18, 0.75)',
        justifyContent: 'flex-end',
    },
    container: {
        width: '100%',
        height: height * 0.85,
        backgroundColor: '#100720', // Premium cosmic dark background
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 12,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFF',
    },
    countBadge: {
        backgroundColor: 'rgba(255, 77, 141, 0.15)',
        borderWidth: 1,
        borderColor: '#FF4D8D',
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    countBadgeText: {
        color: '#FF4D8D',
        fontSize: 11,
        fontWeight: 'bold',
    },
    closeBtn: {
        padding: 4,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderRadius: 14,
        marginHorizontal: 20,
        marginBottom: 12,
        paddingHorizontal: 12,
        borderWidth: 0.5,
        borderColor: 'rgba(255, 255, 255, 0.06)',
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        color: '#FFF',
        fontSize: 13,
        paddingVertical: 10,
    },
    tabsRow: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        marginBottom: 12,
        gap: 6,
    },
    tabBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderWidth: 0.5,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    tabBtnActive: {
        backgroundColor: 'rgba(255, 77, 141, 0.12)',
        borderColor: '#FF4D8D',
    },
    tabText: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 11.5,
        fontWeight: '600',
    },
    tabTextActive: {
        color: '#FF4D8D',
        fontWeight: '700',
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 0.5,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    listItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 12,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.12)',
    },
    avatarPlaceholder: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarInitials: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    memberInfo: {
        flex: 1,
        gap: 2.5,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    memberName: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    },
    vipBadge: {
        paddingHorizontal: 5,
        paddingVertical: 1.5,
        borderRadius: 5,
    },
    vipBadgeText: {
        color: '#FFF',
        fontSize: 7.5,
        fontWeight: 'bold',
    },
    memberMeta: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 10.5,
    },
    tagsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 2,
    },
    roleBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    roleBadgeText: {
        color: '#FFF',
        fontSize: 8,
        fontWeight: 'bold',
    },
    muteIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 155, 61, 0.08)',
        borderWidth: 0.5,
        borderColor: 'rgba(255, 155, 61, 0.2)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        gap: 3,
    },
    muteIndicatorText: {
        color: '#FF9B3D',
        fontSize: 8,
        fontWeight: 'bold',
    },
    bannedByText: {
        color: 'rgba(255, 77, 141, 0.6)',
        fontSize: 8.5,
    },
    listItemRight: {
        justifyContent: 'center',
    },
    optionsBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.03)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    unbanBtn: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 77, 141, 0.12)',
        borderWidth: 0.5,
        borderColor: '#FF4D8D',
    },
    unbanBtnText: {
        color: '#FF4D8D',
        fontSize: 10,
        fontWeight: 'bold',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyStateText: {
        color: 'rgba(255,255,255,0.3)',
        fontSize: 13,
    },
    sheetBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        justifyContent: 'flex-end',
    },
    sheetContent: {
        backgroundColor: '#100720',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        paddingHorizontal: 20,
        paddingBottom: 34,
        paddingTop: 8,
    },
    sheetHandle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignSelf: 'center',
        marginBottom: 16,
    },
    sheetTitle: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
        alignSelf: 'center',
    },
    sheetSubtitle: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 12,
        alignSelf: 'center',
        marginBottom: 16,
    },
    sheetGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    gridBtn: {
        width: '31%',
        aspectRatio: 1.15,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 0.5,
        borderColor: 'rgba(255,255,255,0.06)',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: 6,
    },
    gridBtnText: {
        color: '#FFF',
        fontSize: 10.5,
        fontWeight: '600',
        textAlign: 'center',
    },
    dangerBtn: {
        backgroundColor: 'rgba(255, 77, 141, 0.08)',
        borderColor: 'rgba(255, 77, 141, 0.2)',
    },
    closeSheetBtn: {
        width: '100%',
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 14,
        paddingVertical: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    closeSheetText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: 'bold',
    },
});
