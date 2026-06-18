import React, {
    useState, useEffect, useRef, useCallback, useMemo
} from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
    Dimensions, Animated, Alert, StatusBar, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAlert } from '../contexts/AlertContext';
import { useAppStore } from '../store/useAppStore';
import { useRoomStore } from '../store/useRoomStore';
import { useGiftStore } from '../store/useGiftStore';
import { API_URL } from '../config';

// Import New Modular Components
import RoomTopHeader from '../components/party-room/RoomTopHeader';
import RoomGiftBanner from '../components/party-room/RoomGiftBanner';
import RoomSeatLayout from '../components/party-room/RoomSeatLayout';
import RoomSystemMessages from '../components/party-room/RoomSystemMessages';
import RoomRightMenu from '../components/party-room/RoomRightMenu';
import RoomBottomBar from '../components/party-room/RoomBottomBar';
import GiftAnimationOverlay from '../components/party-room/GiftAnimationOverlay';

import RoomMembersPanel from '../components/party-room/RoomMembersPanel';
import MessagesBottomSheet from '../components/party-room/MessagesBottomSheet';

// Existing Sheets
import GiftPickerModal from '../components/GiftPickerModal';
import UserProfileBottomSheet from '../components/room/UserProfileBottomSheet';
import RoomSettingsBottomSheet from '../components/room/RoomSettingsBottomSheet';

const { width, height } = Dimensions.get('window');

// ─── Agora (crash-safe optional import) ────────────────────────────────────
let AgoraRTC = null;
// try { AgoraRTC = require('react-native-agora'); } catch {}

// ─── Chat Message Row Component ───────────────────────────────────────────
const ChatMessageRow = React.memo(({ item, currentUserId }) => {
    if (item.isSystem) {
        const isGift = item.messageType === 'gift';
        
        let namePart = '';
        let actionPart = item.content;
        
        if (item.content.includes(' odaya girdi.')) {
            const parts = item.content.split(' odaya girdi.');
            namePart = '@' + parts[0];
            actionPart = ' odaya girdi.';
        } else if (item.content.includes(' koltuğa oturdu.')) {
            const parts = item.content.split(' koltuğa oturdu.');
            namePart = '@' + parts[0];
            actionPart = ' koltuğa oturdu.';
        }

        return (
            <View style={[styles.systemMsg, isGift && styles.systemMsgGift]}>
                {isGift && <Text style={styles.systemMsgIcon}>🎁 </Text>}
                {namePart ? (
                    <Text numberOfLines={3} style={styles.systemMsgText}>
                        <Text style={styles.systemMsgName}>{namePart}</Text>
                        <Text style={styles.systemMsgAction}>{actionPart}</Text>
                    </Text>
                ) : (
                    <Text style={[styles.systemMsgText, isGift && { color: '#fbbf24' }]} numberOfLines={3}>
                        {item.content}
                    </Text>
                )}
            </View>
        );
    }

    const isMe = currentUserId && item.sender?.id?.toString() === currentUserId?.toString();
    return (
        <View style={styles.chatMsgRow}>
            <Text style={[styles.chatSender, isMe && styles.chatSenderMe]}>
                {item.sender?.display_name || item.sender?.username || 'Katılımcı'}
            </Text>
            <Text style={styles.chatMsgText}>{item.content}</Text>
        </View>
    );
});

export default function PartyRoomScreen({ route, navigation }) {
    const { room: routeRoom } = route.params;
    const insets = useSafeAreaInsets();
    const { showAlert } = useAlert();
    const { user: currentUser, balance, setBalance, syncBalanceWithServer, unreadCount } = useAppStore();

    // ── Store selectors (Zustand) ─────────────────────────────────────────────
    const room          = useRoomStore(s => s.room);
    const seats         = useRoomStore(s => s.seats);
    const members       = useRoomStore(s => s.members);
    const messages      = useRoomStore(s => s.messages);
    const onlineCount   = useRoomStore(s => s.onlineCount);
    const isLoading     = useRoomStore(s => s.isLoading);
    const error         = useRoomStore(s => s.error);
    const currentGiftBanner = useRoomStore(s => s.currentGiftBanner);
    const isMicEnabled  = useRoomStore(s => s.isMicEnabled);
    const isSpeakerEnabled = useRoomStore(s => s.isSpeakerEnabled);
    const lastModerationEvent = useRoomStore(s => s.lastModerationEvent);
    
    const { joinRoom, leaveRoom, takeSeat, leaveSeat,
            toggleSeatMute, lockSeat, sendMessage,
            toggleMic, toggleSpeaker } = useRoomStore();
    const { openGiftPicker, isVisible: isGiftVisible, closeGiftPicker } = useGiftStore();

    // ── Local UI state ────────────────────────────────────────────────────────
    const [inputText, setInputText] = useState('');
    const [chatExpanded, setChatExpanded] = useState(false);
    const [settingsVisible, setSettingsVisible] = useState(false);
    const [membersVisible, setMembersVisible] = useState(false);
    const [inboxVisible, setInboxVisible] = useState(false);
    const [inboxActiveChatUser, setInboxActiveChatUser] = useState(null);
    const [profileSheet, setProfileSheet] = useState({ visible: false, user: null, seat: null });

    const handleOpenInboxWithUser = (targetUser) => {
        setInboxActiveChatUser(targetUser);
        setInboxVisible(true);
    };

    const chatRef = useRef(null);
    const agoraRef = useRef(null);

    // ── Derived ───────────────────────────────────────────────────────────────
    const currentRoom = room || routeRoom;
    const isHost = useMemo(
        () => currentUser?.id && currentRoom?.host_id?.toString() === currentUser.id?.toString(),
        [currentUser, currentRoom]
    );
    const mySeat = useMemo(
        () => seats.find(s => s.user_id?.toString() === currentUser?.id?.toString()),
        [seats, currentUser]
    );

    const listeners = useMemo(() => {
        return members.filter(m => m.is_online && (m.seat_number === undefined || m.seat_number === null));
    }, [members]);

    // Star animation dots layout
    const stars = useMemo(() => {
        return [...Array(22)].map((_, i) => ({
            id: i,
            top: `${Math.random() * 55}%`,
            left: `${Math.random() * 100}%`,
            width: i % 3 === 0 ? 2 : 1.2,
            height: i % 3 === 0 ? 2 : 1.2,
            opacity: 0.25 + Math.random() * 0.45,
        }));
    }, []);

    // ── Initialize ────────────────────────────────────────────────────────────
    useEffect(() => {
        joinRoom(routeRoom.id);
        _initAgora(routeRoom.id);
        syncBalanceWithServer(); // Sync balance from server on entry

        return () => {
            leaveRoom();
            _releaseAgora();
        };
    }, []);

    // ── User friendly connection error handling ──────────────────────────────
    useEffect(() => {
        if (error) {
            console.warn('[RoomStore ERROR logged on screen]:', error);
            showAlert({
                title: 'Bağlantı Hatası',
                message: 'Odaya bağlanılamadı. Tekrar deneniyor...',
                type: 'error'
            });
        }
    }, [error]);

    // ── Handle moderation events ──────────────────────────────────────────────
    useEffect(() => {
        if (!lastModerationEvent) return;
        const ev = lastModerationEvent;

        if (ev.type === 'kicked' && ev.targetUserId?.toString() === currentUser?.id?.toString()) {
            showAlert({
                title: 'Odadan Atıldınız',
                message: ev.reason || 'Moderatör tarafından odadan çıkarıldınız.',
                type: 'warning',
                onConfirm: () => navigation.goBack(),
            });
        }
        if (ev.type === 'room_closed') {
            showAlert({
                title: 'Oda Kapatıldı',
                message: 'Bu oda yönetici tarafından kapatıldı.',
                type: 'info',
                onConfirm: () => navigation.goBack(),
            });
        }
    }, [lastModerationEvent]);

    // ── Auto-scroll chat ──────────────────────────────────────────────────────
    useEffect(() => {
        if (messages.length > 0) {
            setTimeout(() => chatRef.current?.scrollToEnd({ animated: true }), 100);
        }
    }, [messages]);

    // ─── Agora ────────────────────────────────────────────────────────────────
    const _initAgora = async (roomId) => {
        if (!AgoraRTC) return;
        try {
            const token = await AsyncStorage.getItem('token');
            const res = await axios.post(`${API_URL}/rooms/${roomId}/rtc-token`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const { token: rtcToken, channelName, uid } = res.data;
            const engine = await AgoraRTC.createAgoraRtcEngine();
            agoraRef.current = engine;
            await engine.initialize({ appId: 'f80faf42fd0845a9816658ea7e16a755' });
            await engine.setClientRole(AgoraRTC.ClientRoleType.ClientRoleAudience);
            await engine.enableAudio();
            await engine.joinChannel(rtcToken, channelName, '', uid);
        } catch (e) {
            console.log('[Agora] Init warning:', e.message);
        }
    };

    const _releaseAgora = async () => {
        try {
            if (agoraRef.current) {
                await agoraRef.current.leaveChannel();
                await agoraRef.current.release();
                agoraRef.current = null;
            }
        } catch {}
    };

    // ─── Seat press handler ───────────────────────────────────────────────────
    const handleSeatPress = useCallback((seat) => {
        if (seat.isMock) {
            showAlert({
                title: 'Koltuk Durumu',
                message: seat.user_id ? `${seat.display_name} bu koltukta oturuyor.` : 'Bu koltuk şu an boş.',
                type: 'info'
            });
            return;
        }

        if (!currentUser) return;
        const isMe = seat.user_id?.toString() === currentUser.id?.toString();

        if (seat.user_id) {
            const userObj = {
                id: seat.user_id,
                display_name: seat.display_name,
                username: seat.username,
                avatar_url: seat.avatar_url,
                vip_level: seat.vip_level,
            };
            setProfileSheet({ visible: true, user: userObj, seat });
            return;
        }

        // Empty seat
        if (seat.is_locked) {
            if (isHost) {
                Alert.alert('Koltuk Kilitli', 'Kilidi açmak ister misiniz?', [
                    { text: 'Kilidi Aç', onPress: () => lockSeat(seat.seat_number, false) },
                    { text: 'Vazgeç', style: 'cancel' },
                ]);
            } else {
                showAlert({ title: 'Kilitli', message: 'Bu koltuk yönetici tarafından kilitlenmiştir.', type: 'info' });
            }
            return;
        }

        // Switch seat directly if already sitting, otherwise take seat directly
        if (mySeat) {
            leaveSeat(mySeat.seat_number);
        }
        takeSeat(seat.seat_number);
        if (agoraRef.current) {
            agoraRef.current.setClientRole(AgoraRTC.ClientRoleType.ClientRoleBroadcaster).catch(() => {});
        }
    }, [currentUser, mySeat, isHost, seats]);

    const handleMicToggle = () => {
        if (!mySeat) {
            showAlert({ title: 'Mikrofon', message: 'Mikrofonu kullanmak için bir koltuğa oturmalısınız.', type: 'info' });
            return;
        }
        toggleMic();
        toggleSeatMute(mySeat.seat_number);
        if (agoraRef.current) {
            agoraRef.current.muteLocalAudioStream(!isMicEnabled).catch(() => {});
        }
    };

    const handleSendMessage = () => {
        if (!inputText.trim()) return;
        sendMessage(inputText);
        setInputText('');
    };

    const handleCloseRoom = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            await axios.delete(`${API_URL}/party-rooms/${currentRoom.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            navigation.goBack();
        } catch {
            showAlert({ title: 'Hata', message: 'Oda kapatılamadı.', type: 'error' });
        }
    };

    return (
        <View style={styles.root}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            {/* ══ LAYER 1: Background Image ════════════════════════════════════ */}
            <Image
                source={require('../../assets/roombackground.jpg')}
                style={[styles.bgImage, { opacity: 0.8 }]}
                resizeMode="cover"
            />
            {/* Dark Overlay for content readability */}
            <View style={styles.darkOverlay} pointerEvents="none" />

            {/* Sparkle Points */}
            <View style={styles.starsOverlay} pointerEvents="none">
                {stars.map((star) => (
                    <View
                        key={star.id}
                        style={[styles.star, {
                            top: star.top,
                            left: star.left,
                            width: star.width,
                            height: star.height,
                            opacity: star.opacity,
                        }]}
                    />
                ))}
            </View>

            {/* Main Flex layout container to fill screen and push elements properly */}
            <View style={styles.mainContainer} pointerEvents="box-none">
                {/* TOP AREA: Header, Gift Announcement, and Seats */}
                <View style={styles.topArea} pointerEvents="box-none">
                    {/* ══ LAYER 2: Top Room Header ═════════════════════════════════════ */}
                    <RoomTopHeader
                        room={currentRoom}
                        onlineCount={onlineCount}
                        onBack={() => navigation.goBack()}
                        onOpenSettings={() => setSettingsVisible(true)}
                        onOpenMembers={() => setMembersVisible(true)}
                        insets={insets}
                    />


                    {/* ══ LAYER 4: Seat Layout (16 Fixed Positions) ════════════════════ */}
                    {isLoading ? (
                        <View style={styles.loaderContainer}>
                            <ActivityIndicator size="large" color="#00f3ff" />
                            <Text style={styles.loadingText}>Oda yükleniyor...</Text>
                        </View>
                    ) : (
                        <RoomSeatLayout
                            seats={seats}
                            currentUserId={currentUser?.id}
                            onSeatPress={handleSeatPress}
                            isHost={isHost}
                            listeners={listeners}
                        />
                    )}
                </View>

                {/* MIDDLE AREA: Chat List + System messages (flex: 1) and Right floated menu */}
                <View style={styles.middleArea} pointerEvents="box-none">
                    {/* Chat Messages Overlay (Scroll Area) */}
                    <View style={[styles.chatOverlay, chatExpanded && styles.chatOverlayExpanded]}
                        pointerEvents="box-none"
                    >
                        <TouchableOpacity
                            style={styles.chatToggle}
                            onPress={() => setChatExpanded(e => !e)}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name={chatExpanded ? 'chevron-down' : 'chevron-up'}
                                size={12}
                                color="rgba(255,255,255,0.4)"
                            />
                        </TouchableOpacity>

                        <FlatList
                            ref={chatRef}
                            data={messages}
                            keyExtractor={item => item.id?.toString() ?? Math.random().toString()}
                            renderItem={({ item }) => (
                                <ChatMessageRow item={item} currentUserId={currentUser?.id} />
                            )}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.chatList}
                            onContentSizeChange={() => chatRef.current?.scrollToEnd({ animated: false })}
                        />
                    </View>

                    {/* Right Floating Menu inside the flex area */}
                    <RoomRightMenu
                        onToggleFavorite={() => showAlert({ title: 'Favoriler', message: 'Oda favorilerinize eklendi.', type: 'success' })}
                        onOpenTasks={() => showAlert({ title: 'Görevler', message: 'Günlük görev listeniz yakında burada!', type: 'info' })}
                        onOpenRankings={() => showAlert({ title: 'Sıralama', message: 'Haftalık liderlik tablosu yüklendi.', type: 'info' })}
                        onOpenBonus={() => showAlert({ title: 'Etkinlikler', message: 'Yeni bonus çarkı yakında aktif!', type: 'info' })}
                    />
                </View>

                {/* BOTTOM AREA: Control Bar */}
                {/* ══ LAYER 8: Bottom Control Bar ══════════════════════════════════ */}
                <RoomBottomBar
                    message={inputText}
                    setMessage={setInputText}
                    onSendMessage={handleSendMessage}
                    micMuted={mySeat ? !isMicEnabled : true}
                    onToggleMic={handleMicToggle}
                    speakerMuted={!isSpeakerEnabled}
                    onToggleSpeaker={toggleSpeaker}
                    onOpenGift={() => openGiftPicker(null)}
                    onOpenMenu={() => setSettingsVisible(true)}
                    onOpenInbox={() => setInboxVisible(true)}
                    unreadCount={unreadCount}
                    insets={insets}
                />
            </View>

            {/* ══ LAYER 9: Gift Animation Overlay ══════════════════════════════ */}
            <GiftAnimationOverlay giftEvent={currentGiftBanner} />

            {/* ══ Bottom Sheets ════════════════════════════════════════════════ */}
            <GiftPickerModal
                visible={isGiftVisible}
                onClose={closeGiftPicker}
                onSelectGift={async (gift, quantity) => {
                    const sendGift = useGiftStore.getState().sendGift;
                    const SocketService = require('../services/SocketService').default;
                    const adaptedGift = { ...gift, cost: gift.price };
                    await sendGift(adaptedGift, balance, setBalance, SocketService, currentRoom);
                }}
                userBalance={balance}
            />

            <UserProfileBottomSheet
                visible={profileSheet.visible}
                user={profileSheet.user}
                seat={profileSheet.seat}
                currentUser={currentUser}
                isHost={isHost}
                navigation={navigation}
                onClose={() => setProfileSheet({ visible: false, user: null, seat: null })}
                onMute={() => profileSheet.seat && toggleSeatMute(profileSheet.seat.seat_number)}
                onKick={() => {
                    if (!profileSheet.seat) return;
                    const isMe = profileSheet.seat.user_id?.toString() === currentUser?.id?.toString();
                    if (isMe) {
                        leaveSeat(profileSheet.seat.seat_number);
                    } else {
                        lockSeat(profileSheet.seat.seat_number, true);
                    }
                }}
                onGift={() => {
                    openGiftPicker(profileSheet.seat);
                }}
                onMessage={handleOpenInboxWithUser}
            />

            <RoomSettingsBottomSheet
                visible={settingsVisible}
                room={currentRoom}
                isHost={isHost}
                navigation={navigation}
                onClose={() => setSettingsVisible(false)}
                onCloseRoom={handleCloseRoom}
            />

            <RoomMembersPanel
                visible={membersVisible}
                roomId={currentRoom.id}
                currentUser={currentUser}
                onClose={() => setMembersVisible(false)}
                navigation={navigation}
                onSendMessage={handleOpenInboxWithUser}
            />

            <MessagesBottomSheet
                visible={inboxVisible}
                currentUser={currentUser}
                onClose={() => setInboxVisible(false)}
                navigation={navigation}
                initialActiveChatUser={inboxActiveChatUser}
                clearInitialActiveChatUser={() => setInboxActiveChatUser(null)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        width: '100%',
        height: '100%',
        backgroundColor: '#070B24',
    },
    bgImage: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
    },
    mainContainer: {
        flex: 1,
        width: '100%',
        height: '100%',
        justifyContent: 'space-between',
        alignSelf: 'stretch',
    },
    topArea: {
        width: '100%',
        alignSelf: 'stretch',
    },
    middleArea: {
        flex: 1,
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        alignSelf: 'stretch',
        paddingHorizontal: 10,
        paddingBottom: 8,
    },
    darkOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.18)',
    },
    starsOverlay: {
        ...StyleSheet.absoluteFillObject,
    },
    star: {
        position: 'absolute',
        backgroundColor: '#ffffff',
        borderRadius: 99,
    },
    loaderContainer: {
        height: 310,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        color: '#00f3ff',
        fontSize: 12,
        fontWeight: '600',
        marginTop: 10,
    },
    leftSystemSection: {
        position: 'absolute',
        left: 0,
        bottom: 220,
        zIndex: 98,
    },
    chatOverlay: {
        width: width * 0.68,
        maxHeight: 120,
    },
    chatOverlayExpanded: {
        maxHeight: 240,
    },
    chatToggle: {
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 2,
        marginBottom: 2,
    },
    chatList: {
        paddingBottom: 4,
    },
    chatMsgRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        backgroundColor: 'rgba(7, 11, 36, 0.55)',
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 10,
        marginBottom: 4,
        alignSelf: 'flex-start',
        maxWidth: '100%',
        borderWidth: 0.5,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    chatSender: {
        fontWeight: '700',
        color: '#00f3ff',
        fontSize: 11,
        marginRight: 4,
    },
    chatSenderMe: {
        color: '#ff007f',
    },
    chatMsgText: {
        color: '#fff',
        fontSize: 11,
        flexShrink: 1,
    },
    systemMsg: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(7, 11, 36, 0.55)',
        paddingHorizontal: 9,
        paddingVertical: 3,
        borderRadius: 10,
        marginBottom: 4,
        alignSelf: 'flex-start',
        borderWidth: 0.5,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    systemMsgGift: {
        backgroundColor: 'rgba(251,191,36,0.12)',
        borderColor: 'rgba(251,191,36,0.3)',
    },
    systemMsgIcon: {
        fontSize: 11,
    },
    systemMsgText: {
        color: '#00f3ff',
        fontSize: 10,
        fontWeight: '700',
        flexShrink: 1,
    },
    systemMsgName: {
        color: '#ffb900',
        fontWeight: 'bold',
    },
    systemMsgAction: {
        color: '#00f3ff',
    },
});
