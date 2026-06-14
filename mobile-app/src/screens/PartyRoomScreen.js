import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, FlatList, TouchableOpacity, TextInput, Modal, Dimensions, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useChat } from '../contexts/ChatContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAlert } from '../contexts/AlertContext';
import { API_URL } from '../config';
import GlassCard from '../components/ui/GlassCard';
import VipFrame from '../components/ui/VipFrame';

const { width, height } = Dimensions.get('window');

// Dynamic module loading for Agora native package to keep Expo Go fully crash-safe
let AgoraRTC = null;
try {
    AgoraRTC = require('react-native-agora');
} catch (e) {
    console.log('[Agora] Native Agora SDK not found. Operating in local Simulation Mode.');
}

const DEFAULT_GIFTS = [
    { id: 1, name: 'Gül', cost: 50, icon: '🌹' },
    { id: 2, name: 'Kahve', cost: 100, icon: '☕' },
    { id: 3, name: 'Çikolata', cost: 250, icon: '🍫' },
    { id: 4, name: 'Ayıcık', cost: 500, icon: '🧸' },
    { id: 5, name: 'Pırlanta', cost: 1000, icon: '💎' },
    { id: 6, name: 'Yarış Arabası', cost: 2000, icon: '🏎️' },
    { id: 7, name: 'Şato', cost: 5000, icon: '🏰' },
    { id: 10, name: 'Taç', cost: 20000, icon: '👑' }
];

export default function PartyRoomScreen({ route, navigation }) {
    const { room } = route.params;
    const { socket, balance, setBalance } = useChat();
    const { theme, themeMode } = useTheme();
    const { showAlert } = useAlert();

    const [currentUser, setCurrentUser] = useState(null);
    const [seats, setSeats] = useState([]);
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [giftModalVisible, setGiftModalVisible] = useState(false);
    const [gameModalVisible, setGameModalVisible] = useState(false);
    const [selectedSeatForGift, setSelectedSeatForGift] = useState(null);
    const [agoraConnected, setAgoraConnected] = useState(false);

    // Simulated game state
    const [diceResult, setDiceResult] = useState(null);
    const [rolling, setRolling] = useState(false);

    const chatListRef = useRef(null);

    // Agora Client Reference
    const agoraEngineRef = useRef(null);

    const isHost = currentUser?.id && room?.host_id && room.host_id.toString() === currentUser.id.toString();

    useEffect(() => {
        const loadUserAndInitialize = async () => {
            const userStr = await AsyncStorage.getItem('user');
            if (userStr) {
                const userObj = JSON.parse(userStr);
                setCurrentUser(userObj);
            }

            // Bind socket listeners
            if (socket) {
                socket.emit('join_party_room', { roomId: room.id });

                socket.on('party_seats_state', (seatsState) => {
                    setSeats(seatsState);
                });

                socket.on('party_seat_updated', (updatedSeat) => {
                    setSeats(prev => prev.map(s => 
                        s.seat_number === updatedSeat.seat_number ? { ...s, ...updatedSeat } : s
                    ));
                    
                    // Add system message if someone occupied or left a seat
                    if (updatedSeat.user_id) {
                        addSystemMessage(`${updatedSeat.display_name || updatedSeat.username} koltuğa oturdu.`);
                    }
                });

                socket.on('party_seat_mute_changed', (data) => {
                    setSeats(prev => prev.map(s => 
                        s.seat_number === data.seat_number ? { ...s, is_muted: data.is_muted } : s
                    ));
                });

                socket.on('party_seat_lock_changed', (data) => {
                    setSeats(prev => prev.map(s => 
                        s.seat_number === data.seat_number ? { ...s, is_locked: data.is_locked, user_id: data.is_locked ? null : s.user_id } : s
                    ));
                });

                socket.on('receive_party_message', (msg) => {
                    setMessages(prev => [...prev, msg]);
                });

                socket.on('user_joined_party', (data) => {
                    addSystemMessage(`${data.display_name || data.username} odaya giriş yaptı.`);
                });

                socket.on('user_left_party', (data) => {
                    // Clean up seat lists if needed
                });

                socket.on('party_gift_sent', (data) => {
                    const giftIcon = DEFAULT_GIFTS.find(g => g.id === data.gift_id)?.icon || '🎁';
                    addSystemMessage(`${data.sender.display_name || data.sender.username}, koltuktaki üyeye ${giftIcon} ${data.gift_name} gönderdi!`);
                });

                socket.on('party_room_closed', () => {
                    showAlert({
                        title: 'Oda Kapatıldı',
                        message: 'Bu oda yönetici tarafından kapatılmıştır.',
                        type: 'info',
                        onConfirm: () => navigation.goBack()
                    });
                });

                socket.on('party_room_error', (err) => {
                    showAlert({ title: 'Hata', message: err.message, type: 'error' });
                });
            }

            // Initialize Audio Streaming (Agora)
            initAgoraAudio();
        };

        loadUserAndInitialize();

        return () => {
            if (socket) {
                socket.emit('leave_party_room', { roomId: room.id });
                socket.off('party_seats_state');
                socket.off('party_seat_updated');
                socket.off('party_seat_mute_changed');
                socket.off('party_seat_lock_changed');
                socket.off('receive_party_message');
                socket.off('user_joined_party');
                socket.off('user_left_party');
                socket.off('party_gift_sent');
                socket.off('party_room_closed');
                socket.off('party_room_error');
            }
            leaveAgoraChannel();
        };
    }, [socket]);

    const addSystemMessage = (text) => {
        setMessages(prev => [
            ...prev,
            {
                id: `system_${Date.now()}_${Math.random()}`,
                isSystem: true,
                content: text,
                created_at: new Date()
            }
        ]);
    };

    // --- AGORA REAL-TIME AUDIO SETUP ---
    const initAgoraAudio = async () => {
        if (!AgoraRTC) {
            console.log('[Agora] Simulation mode activated (Expo Go compatibility).');
            setAgoraConnected(true);
            return;
        }

        try {
            const token = await AsyncStorage.getItem('token');
            const res = await axios.post(`${API_URL}/party-rooms/${room.id}/token`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const { token: rtcToken, channelName, uid } = res.data;

            // Initialize Agora engine
            const engine = await AgoraRTC.createAgoraRtcEngine();
            agoraEngineRef.current = engine;
            
            await engine.initialize({
                appId: 'f80faf42fd0845a9816658ea7e16a755', // User's Agora App ID
                channelProfile: AgoraRTC.ChannelProfileType.ChannelProfileLiveBroadcasting,
            });

            // Set role: Speaker if sitting on seat, Audience otherwise.
            // For now, join as Audience by default, upgrade dynamically when taking seat.
            await engine.setClientRole(AgoraRTC.ClientRoleType.ClientRoleAudience);
            await engine.enableAudio();
            await engine.joinChannel(rtcToken, channelName, '', uid);
            
            setAgoraConnected(true);
            console.log('[Agora] Audio stream channel joined successfully:', channelName);
        } catch (err) {
            console.warn('[Agora] Failed to init native audio, falling back to simulated channel:', err.message);
            setAgoraConnected(true);
        }
    };

    const leaveAgoraChannel = async () => {
        try {
            if (agoraEngineRef.current) {
                await agoraEngineRef.current.leaveChannel();
                await agoraEngineRef.current.release();
                agoraEngineRef.current = null;
                console.log('[Agora] Audio stream channel left.');
            }
        } catch (err) {
            console.log('[Agora] Clean up warning:', err.message);
        }
    };

    const handleSeatPress = async (seat) => {
        if (!currentUser) return;

        const isMySeat = seat.user_id && seat.user_id.toString() === currentUser.id.toString();

        if (isMySeat) {
            // Options for my own seat
            Alert.alert(
                'Koltuk Yönetimi',
                'Kendi koltuğunuz üzerinde ne yapmak istersiniz?',
                [
                    { text: seat.is_muted ? 'Mikrofonu Aç' : 'Mikrofonu Kapat', onPress: () => toggleMute(seat.seat_number) },
                    { text: 'Koltuktan İn', style: 'destructive', onPress: () => leaveSeat(seat.seat_number) },
                    { text: 'Vazgeç', style: 'cancel' }
                ]
            );
            return;
        }

        if (seat.user_id) {
            // Seat is occupied by someone else, show options to send gift or host commands
            const options = [
                { text: 'Hediye Gönder 🎁', onPress: () => openGiftPanel(seat) }
            ];

            if (isHost) {
                options.push({ text: seat.is_muted ? 'Sesini Aç' : 'Sessize Al', onPress: () => toggleMute(seat.seat_number) });
                options.push({ text: 'Koltuktan İndir', style: 'destructive', onPress: () => kickSeat(seat.seat_number) });
            }

            options.push({ text: 'Vazgeç', style: 'cancel' });

            Alert.alert(`${seat.display_name || seat.username}`, 'Yapmak istediğiniz işlemi seçin:', options);
        } else {
            // Seat is empty
            if (seat.is_locked) {
                if (isHost) {
                    Alert.alert('Koltuk Kilitli', 'Bu koltuğun kilidini açmak ister misiniz?', [
                        { text: 'Kilidi Aç', onPress: () => toggleLock(seat.seat_number, false) },
                        { text: 'Vazgeç', style: 'cancel' }
                    ]);
                } else {
                    showAlert({ title: 'Kilitli Koltuk', message: 'Bu koltuk yönetici tarafından kilitlenmiştir.', type: 'info' });
                }
                return;
            }

            // Confirm taking seat
            Alert.alert('Koltuk', `${seat.seat_number}. Koltuğa oturmak istiyor musunuz?`, [
                { text: 'Evet', onPress: () => takeSeat(seat.seat_number) },
                { text: 'Hayır', style: 'cancel' }
            ]);
        }
    };

    const takeSeat = async (seatNumber) => {
        if (socket) {
            socket.emit('request_seat', { roomId: room.id, seatNumber });
            // Dynamic client role upgrade on Agora if native SDK exists
            try {
                if (agoraEngineRef.current) {
                    await agoraEngineRef.current.setClientRole(AgoraRTC.ClientRoleType.ClientRoleBroadcaster);
                    console.log('[Agora] Upgraded to Broadcaster role.');
                }
            } catch (e) {}
        }
    };

    const leaveSeat = async (seatNumber) => {
        if (socket) {
            socket.emit('leave_seat', { roomId: room.id, seatNumber });
            // Downgrade client role to audience
            try {
                if (agoraEngineRef.current) {
                    await agoraEngineRef.current.setClientRole(AgoraRTC.ClientRoleType.ClientRoleAudience);
                    console.log('[Agora] Downgraded to Audience role.');
                }
            } catch (e) {}
        }
    };

    const toggleMute = (seatNumber) => {
        if (socket) socket.emit('toggle_seat_mute', { roomId: room.id, seatNumber });
    };

    const toggleLock = (seatNumber, isLocked) => {
        if (socket) socket.emit('lock_seat', { roomId: room.id, seatNumber, isLocked });
    };

    const kickSeat = (seatNumber) => {
        Alert.alert('Kullanıcıyı At', 'Bu kullanıcıyı koltuktan indirmek istediğinize emin misiniz?', [
            { text: 'Evet', style: 'destructive', onPress: () => toggleLock(seatNumber, true) }, // Locking temporarily kicks out user
            { text: 'Hayır', style: 'cancel' }
        ]);
    };

    const openGiftPanel = (seat) => {
        setSelectedSeatForGift(seat);
        setGiftModalVisible(true);
    };

    const handleSendGift = (gift) => {
        if (!selectedSeatForGift || !socket) return;

        if (balance < gift.cost) {
            showAlert({ title: 'Yetersiz Bakiye', message: 'Hediye göndermek için bakiyeniz yetersiz. Yükleme yapmak ister misiniz?', type: 'warning', onConfirm: () => navigation.navigate('Shop') });
            return;
        }

        socket.emit('send_party_gift', {
            roomId: room.id,
            targetUserId: selectedSeatForGift.user_id,
            giftId: gift.id
        });

        // Optimistic local balance decrement
        setBalance(prev => Math.max(0, prev - gift.cost));
        setGiftModalVisible(false);
    };

    const handleSendMessage = () => {
        if (!inputText.trim() || !socket) return;
        socket.emit('send_party_message', { roomId: room.id, content: inputText.trim() });
        setInputText('');
    };

    const handleCloseRoom = () => {
        Alert.alert('Odayı Kapat', 'Odayı tamamen kapatıp sonlandırmak istiyor musunuz?', [
            { text: 'Kapat (Evet)', style: 'destructive', onPress: async () => {
                try {
                    const token = await AsyncStorage.getItem('token');
                    await axios.delete(`${API_URL}/party-rooms/${room.id}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    navigation.goBack();
                } catch (e) {
                    showAlert({ title: 'Hata', message: 'Oda kapatılamadı.', type: 'error' });
                }
            }},
            { text: 'Vazgeç', style: 'cancel' }
        ]);
    };

    // Simulation Game: Lucky Dice roll
    const rollDice = () => {
        if (rolling) return;
        setRolling(true);
        setDiceResult(null);

        setTimeout(() => {
            const result = Math.floor(Math.random() * 6) + 1;
            setDiceResult(result);
            setRolling(false);
            
            // Broadcast victory / result to room chat
            if (socket && currentUser) {
                socket.emit('send_party_message', { 
                    roomId: room.id, 
                    content: `🎲 Şans oyununda zar attı ve [${result}] kazandı!` 
                });
            }
        }, 1500);
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <LinearGradient
                colors={['#0f0720', '#1a0b2e', '#2d0a31']}
                style={StyleSheet.absoluteFill}
            />

            {/* Room Header Info */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color="#fff" />
                </TouchableOpacity>

                <View style={styles.headerText}>
                    <Text style={styles.roomName} numberOfLines={1}>{room.title}</Text>
                    <View style={styles.badgeRow}>
                        <LinearGradient colors={['#9333ea', '#6b21a8']} style={styles.roomLvlBadge}>
                            <Text style={styles.roomLvlText}>Lv.{room.room_level}</Text>
                        </LinearGradient>
                        <Text style={styles.headerHostName}>ID: {room.id.slice(0, 6).toUpperCase()}</Text>
                    </View>
                </View>

                {isHost ? (
                    <TouchableOpacity onPress={handleCloseRoom} style={styles.closeBtn}>
                        <Ionicons name="power" size={24} color="#ef4444" />
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 40 }} />
                )}
            </View>

            {/* Simulated Live Broadcast banner */}
            <View style={styles.liveBanner}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>SES YAYINI AKTİF</Text>
            </View>

            {/* Seats Grid */}
            <View style={styles.seatsArea}>
                <View style={styles.seatsGrid}>
                    {seats.length === 0 ? (
                        <ActivityIndicator size="small" color="#ec4899" />
                    ) : (
                        seats.map((seat, index) => {
                            const isUserOnSeat = seat.user_id;
                            return (
                                <TouchableOpacity 
                                    key={seat.id} 
                                    style={styles.seatCell}
                                    onPress={() => handleSeatPress(seat)}
                                    activeOpacity={0.8}
                                >
                                    <View style={styles.avatarContainer}>
                                        {isUserOnSeat ? (
                                            <VipFrame 
                                                level={seat.vip_level || 0}
                                                avatar={seat.avatar_url}
                                                size={58}
                                                isStatic={true}
                                            />
                                        ) : (
                                            <View style={styles.emptyAvatar}>
                                                {seat.is_locked ? (
                                                    <Ionicons name="lock-closed" size={20} color="rgba(255,255,255,0.4)" />
                                                ) : (
                                                    <Ionicons name="mic-outline" size={22} color="rgba(255,255,255,0.4)" />
                                                )}
                                            </View>
                                        )}
                                        {/* Status badges: Mute or Lock */}
                                        {isUserOnSeat && seat.is_muted && (
                                            <View style={styles.micStatusBadge}>
                                                <Ionicons name="mic-off" size={10} color="#fff" />
                                            </View>
                                        )}
                                    </View>
                                    <Text style={styles.seatName} numberOfLines={1}>
                                        {isUserOnSeat ? (seat.display_name || seat.username) : `${seat.seat_number}. Koltuk`}
                                    </Text>
                                    <View style={styles.seatNumberCircle}>
                                        <Text style={styles.seatNumText}>{seat.seat_number}</Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })
                    )}
                </View>
            </View>

            {/* Interactive Game / Slots launcher button */}
            <TouchableOpacity style={styles.gameLauncher} onPress={() => setGameModalVisible(true)}>
                <LinearGradient colors={['#fbbf24', '#f59e0b']} style={styles.gameLauncherGrad}>
                    <FontAwesome5 name="dice" size={20} color="#fff" />
                    <Text style={styles.gameLauncherText}>Zar Oyunu</Text>
                </LinearGradient>
            </TouchableOpacity>

            {/* Chat Messages */}
            <View style={styles.chatArea}>
                <FlatList
                    ref={chatListRef}
                    data={messages}
                    keyExtractor={item => item.id}
                    onContentSizeChange={() => chatListRef.current?.scrollToEnd({ animated: true })}
                    renderItem={({ item }) => {
                        if (item.isSystem) {
                            return (
                                <View style={styles.systemMsgContainer}>
                                    <Text style={styles.systemMsgText}>📢 {item.content}</Text>
                                </View>
                            );
                        }
                        const isMessageFromSender = currentUser?.id && item.sender.id.toString() === currentUser.id.toString();
                        return (
                            <View style={styles.msgRow}>
                                <Text style={[styles.msgSender, isMessageFromSender && { color: '#ec4899' }]}>
                                    {item.sender.display_name || item.sender.username}
                                    {item.sender.vip_level > 0 && <Text style={styles.vipTagText}> (VIP {item.sender.vip_level})</Text>}: 
                                </Text>
                                <Text style={styles.msgText}>{item.content}</Text>
                            </View>
                        );
                    }}
                    contentContainerStyle={styles.chatList}
                />
            </View>

            {/* Bottom Input & Tool Bar */}
            <View style={styles.bottomBar}>
                <TextInput
                    placeholder="Sohbete katıl..."
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    style={styles.chatInput}
                    value={inputText}
                    onChangeText={setInputText}
                    onSubmitEditing={handleSendMessage}
                />
                <TouchableOpacity onPress={handleSendMessage} style={styles.sendIconBtn}>
                    <Ionicons name="send" size={20} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* Gifting Panel Modal */}
            <Modal
                visible={giftModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setGiftModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setGiftModalVisible(false)} />
                    <GlassCard style={styles.giftPanel} intensity={50} tint="dark">
                        <Text style={styles.giftPanelTitle}>
                            Hediye Gönder: {selectedSeatForGift?.display_name || selectedSeatForGift?.username}
                        </Text>
                        <Text style={styles.balanceText}>Bakiyeniz: 🪙 {balance} Coin</Text>
                        
                        <FlatList
                            data={DEFAULT_GIFTS}
                            numColumns={4}
                            keyExtractor={item => item.id.toString()}
                            renderItem={({ item }) => (
                                <TouchableOpacity 
                                    style={styles.giftItem}
                                    onPress={() => handleSendGift(item)}
                                >
                                    <Text style={styles.giftEmoji}>{item.icon}</Text>
                                    <Text style={styles.giftName}>{item.name}</Text>
                                    <Text style={styles.giftCost}>🪙 {item.cost}</Text>
                                </TouchableOpacity>
                            )}
                            contentContainerStyle={styles.giftList}
                        />
                    </GlassCard>
                </View>
            </Modal>

            {/* Simulated Zar Oyunu Modal */}
            <Modal
                visible={gameModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setGameModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setGameModalVisible(false)} />
                    <GlassCard style={styles.gamePanel} intensity={50} tint="dark">
                        <Text style={styles.gameTitle}>Şans Zarı 🎲</Text>
                        <Text style={styles.gameSubtitle}>Zarı salla, şansını odadaki herkesle paylaş!</Text>

                        <View style={styles.diceBox}>
                            {rolling ? (
                                <ActivityIndicator size="large" color="#fbbf24" />
                            ) : diceResult ? (
                                <View style={styles.resultBox}>
                                    <FontAwesome5 name={`dice-${['one', 'two', 'three', 'four', 'five', 'six'][diceResult - 1]}`} size={72} color="#fbbf24" />
                                    <Text style={styles.resultText}>Zar Sonucu: {diceResult}</Text>
                                </View>
                            ) : (
                                <FontAwesome5 name="dice" size={72} color="rgba(255,255,255,0.2)" />
                            )}
                        </View>

                        <TouchableOpacity 
                            style={styles.rollBtn}
                            onPress={rollDice}
                            disabled={rolling}
                        >
                            <LinearGradient
                                colors={['#fbbf24', '#d97706']}
                                style={styles.rollBtnGrad}
                            >
                                <Text style={styles.rollBtnText}>{rolling ? 'Zar Dönebilir...' : 'Salla!'}</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </GlassCard>
                </View>
            </Modal>
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
        paddingHorizontal: 15,
        paddingTop: 50,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    backButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerText: {
        flex: 1,
        marginLeft: 12,
    },
    roomName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
    },
    badgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 2,
    },
    roomLvlBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
    },
    roomLvlText: {
        fontSize: 9,
        fontWeight: 'bold',
        color: '#fff',
    },
    headerHostName: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.4)',
    },
    closeBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: 'rgba(239, 68, 68, 0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    liveBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'center',
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 10,
        marginTop: 10,
        gap: 6,
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#10b981',
    },
    liveText: {
        fontSize: 10,
        color: '#10b981',
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    seatsArea: {
        paddingVertical: 15,
        paddingHorizontal: 20,
    },
    seatsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 15,
    },
    seatCell: {
        width: (width - 70) / 4,
        alignItems: 'center',
        marginBottom: 10,
    },
    avatarContainer: {
        width: 62,
        height: 62,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    emptyAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: 'rgba(255,255,255,0.25)',
        backgroundColor: 'rgba(255,255,255,0.04)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    micStatusBadge: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        backgroundColor: '#ef4444',
        width: 18,
        height: 18,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#110c28',
    },
    seatName: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.7)',
        marginTop: 6,
        textAlign: 'center',
        width: '100%',
    },
    seatNumberCircle: {
        backgroundColor: 'rgba(255,255,255,0.12)',
        width: 16,
        height: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 4,
    },
    seatNumText: {
        fontSize: 9,
        color: 'rgba(255,255,255,0.6)',
        fontWeight: 'bold',
    },
    gameLauncher: {
        alignSelf: 'center',
        borderRadius: 18,
        overflow: 'hidden',
        marginBottom: 10,
    },
    gameLauncherGrad: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 8,
    },
    gameLauncherText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 13,
    },
    chatArea: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderTopWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    chatList: {
        padding: 15,
    },
    msgRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 8,
    },
    msgSender: {
        fontWeight: 'bold',
        color: '#8b5cf6',
        fontSize: 13,
    },
    vipTagText: {
        fontSize: 10,
        color: '#f59e0b',
    },
    msgText: {
        color: '#fff',
        fontSize: 13,
        marginLeft: 4,
    },
    systemMsgContainer: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        marginBottom: 8,
        alignSelf: 'flex-start',
    },
    systemMsgText: {
        color: '#fbbf24',
        fontSize: 12,
        fontWeight: '500',
    },
    bottomBar: {
        flexDirection: 'row',
        paddingHorizontal: 15,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#0f0720',
    },
    chatInput: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        borderRadius: 20,
        paddingHorizontal: 16,
        height: 40,
        color: '#fff',
        fontSize: 14,
    },
    sendIconBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#ec4899',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'flex-end',
    },
    giftPanel: {
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        height: height * 0.45,
    },
    giftPanelTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 4,
    },
    balanceText: {
        fontSize: 13,
        color: '#fbbf24',
        fontWeight: '600',
        marginBottom: 15,
    },
    giftList: {
        paddingBottom: 20,
    },
    giftItem: {
        width: (width - 40) / 4,
        alignItems: 'center',
        marginVertical: 10,
    },
    giftEmoji: {
        fontSize: 32,
        marginBottom: 4,
    },
    giftName: {
        fontSize: 11,
        color: '#fff',
        fontWeight: '500',
    },
    giftCost: {
        fontSize: 10,
        color: '#fbbf24',
        marginTop: 2,
    },
    gamePanel: {
        alignSelf: 'center',
        width: width - 40,
        borderRadius: 28,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        marginBottom: height * 0.3,
    },
    gameTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 6,
    },
    gameSubtitle: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.6)',
        textAlign: 'center',
        marginBottom: 20,
    },
    diceBox: {
        height: 120,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    resultBox: {
        alignItems: 'center',
        gap: 10,
    },
    resultText: {
        color: '#fbbf24',
        fontSize: 16,
        fontWeight: 'bold',
    },
    rollBtn: {
        width: '80%',
        height: 50,
        borderRadius: 25,
        overflow: 'hidden',
    },
    rollBtnGrad: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rollBtnText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
});
