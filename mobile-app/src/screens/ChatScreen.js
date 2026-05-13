import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity, Image, RefreshControl, Animated, Alert, ScrollView } from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import io from 'socket.io-client';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av'; // Import Audio
import { API_URL, SOCKET_URL } from '../config';
import MessageBubble from '../components/animated/MessageBubble';
import TypingIndicator from '../components/animated/TypingIndicator';
import ChatBackground from '../components/animated/ChatBackground';
import VipFrame from '../components/ui/VipFrame';
import { useTheme } from '../contexts/ThemeContext';
import { useAlert } from '../contexts/AlertContext';
import { useStarterPack } from '../contexts/StarterPackContext';
import { GIFTS } from '../constants/gifts';
import GlassCard from '../components/ui/GlassCard';
import ModernAlert from '../components/ui/ModernAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { resolveImageUrl } from '../utils/imageUtils';

import { SHADOWS, COLORS } from '../theme';
import ReportModal from '../components/ReportModal';
import InsufficientCoinsModal from '../components/InsufficientCoinsModal';
import GiftPickerModal from '../components/GiftPickerModal';
import GiftOverlay from '../components/animated/GiftOverlay';
import ImageLightbox from '../components/ui/ImageLightbox';

import { useChat } from '../contexts/ChatContext';

export default function ChatScreen({ route, navigation }) {
    const insets = useSafeAreaInsets();
    const { fetchUnreadCount, setActiveChatId } = useChat();
    const { showAlert } = useAlert();

    useEffect(() => {
        if (chatId) {
            setActiveChatId(chatId);
        }
        return () => {
            setActiveChatId(null);
        };
    }, [chatId]);
    const { theme, themeMode } = useTheme();
    const { operatorId, chatId: existingChatId, name, job, user: routeUser = {}, avatar_url, is_online, vip_level = 0, gender } = route.params;

    // User Handling
    const TEST_USER_ID = 'c917f7d6-cc44-4b04-8917-1dbbed0b1e9b';
    const user = { ...routeUser, id: routeUser.id || TEST_USER_ID };

    const [messages, setMessages] = useState([]);
    const [isTyping, setIsTyping] = useState(false);
    const [input, setInput] = useState('');
    const [chatId, setChatId] = useState(existingChatId || null);
    const [selectedImage, setSelectedImage] = useState(null);
    const [recordTime, setRecordTime] = useState('00:00');
    const recordInterval = useRef(null);
    const waveAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (isRecording) {
            let seconds = 0;
            recordInterval.current = setInterval(() => {
                seconds++;
                const mins = Math.floor(seconds / 60);
                const secs = seconds % 60;
                setRecordTime(`${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`);
            }, 1000);

            Animated.loop(
                Animated.sequence([
                    Animated.timing(waveAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
                    Animated.timing(waveAnim, { toValue: 0, duration: 400, useNativeDriver: true })
                ])
            ).start();
        } else {
            clearInterval(recordInterval.current);
            setRecordTime('00:00');
            waveAnim.setValue(0);
        }
    }, [isRecording]);
    const [isLoading, setIsLoading] = useState(true);

    // UI Toggles
    const [showOptions, setShowOptions] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [showGiftModal, setShowGiftModal] = useState(false);
    const { openStarterPack, handleInsufficientCoins } = useStarterPack();
    const [showCoinModal, setShowCoinModal] = useState(false);

    // Track Balance for Gift Modal (Initial from route, updated via socket)
    const [currentBalance, setCurrentBalance] = useState(user.balance || 0);
    const [recording, setRecording] = useState(null);
    const [activeGift, setActiveGift] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [audioLevel, setAudioLevel] = useState(0);

    const [showIcebreakers, setShowIcebreakers] = useState(false);

    const ICEBREAKERS = [
        "Selam, nasılsın? 😊",
        "Seninle tanışmak istiyorum ✨",
        "Profilin çok etkileyici 💜",
        "Harika bir enerjin var! 🔥",
        "Sohbet etmek ister misin? 💬"
    ];

    const socketRef = useRef(null);
    const flatListRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const giftAnim = useRef(new Animated.Value(0)).current;
    const offerPulseAnim = useRef(new Animated.Value(1)).current;

    // Gift Floating & Offer Pulse Animations
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(giftAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
                Animated.timing(giftAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
            ])
        ).start();

        Animated.loop(
            Animated.sequence([
                Animated.timing(offerPulseAnim, { toValue: 1.1, duration: 1000, useNativeDriver: true }),
                Animated.timing(offerPulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    // Header Config
    React.useLayoutEffect(() => {
        navigation.setOptions({
            headerShown: true,
            headerTitle: () => (
                <View style={{ alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 1 }}>
                        <Text style={{ color: theme.colors.text, fontSize: 15, fontWeight: '900', marginRight: 4 }}>
                            {name ? name.toUpperCase() : 'SOHBET'}
                        </Text>

                        {vip_level > 0 && (
                            <LinearGradient
                                colors={vip_level >= 5 ? ['#e879f9', '#d946ef'] : (vip_level >= 3 ? ['#fbbf24', '#d97706'] : ['#8b5cf6', '#6366f1'])}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingHorizontal: 5,
                                    paddingVertical: 1.5,
                                    borderRadius: 6,
                                    marginRight: 4
                                }}
                            >
                                <Ionicons name="star" size={9} color="white" />
                                <Text style={{ color: 'white', fontSize: 9, fontWeight: '900', marginLeft: 2 }}>VIP {vip_level}</Text>
                            </LinearGradient>
                        )}

                        <Ionicons name="checkmark-circle" size={14} color="#3b82f6" />
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: is_online ? '#10b981' : theme.colors.textSecondary,
                            marginRight: 4
                        }} />
                        <Text style={{ color: is_online ? '#10b981' : theme.colors.textSecondary, fontSize: 11, fontWeight: '700' }}>
                            {is_online ? 'Çevrimiçi' : 'Çevrimdışı'}
                        </Text>
                    </View>
                </View>
            ),
            headerLeft: () => (
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginLeft: 10, padding: 5 }}>
                    <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
                </TouchableOpacity>
            ),
            headerRight: () => (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity
                        onPress={() => navigation.navigate('OperatorProfile', { operator: { id: operatorId, name, avatar_url, is_online, vip_level }, user })}
                        style={{ marginRight: 15 }}
                    >
                        <VipFrame
                            level={gender === 'coin_bayisi' ? 'dealer' : vip_level}
                            avatar={avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=random&color=fff`}
                            size={40}
                            isStatic={true}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setShowOptions(!showOptions)} style={{ padding: 5, marginRight: 5 }}>
                        <Ionicons name="ellipsis-vertical" size={24} color={theme.colors.text} />
                    </TouchableOpacity>
                </View>
            ),
            headerTitleAlign: 'center',
            headerTransparent: true,
            headerStyle: {
                backgroundColor: 'transparent',
                elevation: 0,
                shadowOpacity: 0,
            },
            headerTintColor: theme.colors.text,
            headerBackVisible: false,
        });
    }, [navigation, showOptions, name, is_online, avatar_url, operatorId, user, vip_level]);

    // Initialize Chat
    const initializeChat = async () => {
        try {
            let realChatId = chatId;

            const token = await AsyncStorage.getItem('token');
            const authHeader = { headers: { Authorization: `Bearer ${token}` } };

            // 1. Get or Create Chat UUID if missing
            if (!realChatId) {
                const chatRes = await axios.post(`${API_URL}/chats`, {
                    userId: user.id,
                    operatorId: operatorId
                }, authHeader);
                realChatId = chatRes.data.id;
                setChatId(realChatId);
                console.log('[ChatScreen] Created/Fetched chatId:', realChatId);
            }

            // 2. Parallelize: Balance, History and Read Status
            const [balanceRes, historyRes] = await Promise.all([
                axios.get(`${API_URL}/users/${user.id}`, authHeader),
                axios.get(`${API_URL}/messages/${realChatId}`, authHeader),
                axios.put(`${API_URL}/chats/${realChatId}/read`, { userId: user.id }, authHeader)
            ]);

            fetchUnreadCount(user.id);

            if (balanceRes.data && balanceRes.data.balance !== undefined) {
                setCurrentBalance(balanceRes.data.balance);
            }
            setMessages(historyRes.data);
            setIsLoading(false);

            // 3. Connect Socket (Keep this at the end)
            if (socketRef.current) socketRef.current.disconnect();

            console.log('[ChatScreen] Connecting to socket with token:', token ? 'Exists' : 'Missing', 'Local user.id:', user.id);

            socketRef.current = io(SOCKET_URL, {
                transports: ['websocket', 'polling'],
                reconnection: true,
                auth: { token }
            });

            socketRef.current.on('connect', () => {
                const roomStr = realChatId.toString();
                console.log('[SOCKET] Connected to Backend. ID:', socketRef.current.id, 'Joining Room:', roomStr);
                socketRef.current.emit('join_room', roomStr);
            });

            socketRef.current.on('connect_error', (err) => {
                console.error('[SOCKET] Connection Error:', err.message);
            });

            socketRef.current.on('disconnect', (reason) => {
                console.warn('[SOCKET] Disconnected from server:', reason);
            });

            // Listeners
            socketRef.current.on('receive_message', (msg) => {
                console.log('[SOCKET] receive_message on Mobile:', msg.id, 'for chatId:', msg.chat_id, 'Current chatId:', realChatId);

                // Add explicit chatId check just in case global emission leaks or room logic fails
                if (msg.chat_id && realChatId && msg.chat_id.toString() !== realChatId.toString()) {
                    console.warn('[SOCKET] Received message for different chat! Ignoring.');
                    return;
                }

                setMessages(prev => {
                    const exists = prev.some(m => m.id === msg.id);
                    if (exists) return prev;

                    if (msg.tempId) {
                        const optimisticIndex = prev.findIndex(m => m.id === msg.tempId);
                        if (optimisticIndex !== -1) {
                            const newMessages = [...prev];
                            newMessages[optimisticIndex] = msg;
                            return newMessages;
                        }
                    } else {
                        const optimisticIndex = prev.findIndex(m =>
                            m.is_optimistic &&
                            m.content === msg.content &&
                            m.type === msg.type &&
                            Math.abs(new Date(m.created_at) - new Date(msg.created_at)) < 5000
                        );
                        if (optimisticIndex !== -1) {
                            const newMessages = [...prev];
                            newMessages[optimisticIndex] = msg;
                            return newMessages;
                        }
                    }

                    return [...prev, msg];
                });
            });

            socketRef.current.on('message_error', (data) => {
                console.log('[SOCKET] Message Error:', data);

                // Rollback optimistic update if tempId is present
                if (data.tempId) {
                    setMessages(prev => prev.filter(m => m.id !== data.tempId));
                    // Refund optimistic balance deduction if needed (optional complexity)
                }

                if (data.code === 'INSUFFICIENT_FUNDS') {
                    // Show Coin Modal on insufficient balance error
                    setShowCoinModal(true);
                } else {
                    const errorMsg = data.debug ? `${data.message}\n(Hata: ${data.debug})` : (data.message || 'Mesaj gönderilemedi.');
                    showAlert({ title: 'Hata', message: errorMsg, type: 'error' });
                }
            });

            socketRef.current.on('balance_update', (data) => {
                console.log('[SOCKET] Balance Update received:', data);
                if (data.userId === user.id || data.id === user.id) {
                    setCurrentBalance(data.newBalance);
                }
            });

            socketRef.current.on('message_reaction', (data) => {
                console.log('[SOCKET] Reaction received:', data);
                setMessages(prev => prev.map(m => 
                    m.id === data.messageId ? { ...m, reaction: data.reaction } : m
                ));
            });

            socketRef.current.on('display_typing', (data) => {
                console.log('[SOCKET] display_typing received on Mobile:', data, 'Current realChatId:', realChatId);
                const incomingChatId = data.chatId ? data.chatId.toString() : '';
                const incomingUserId = data.userId ? data.userId.toString() : '';
                const myId = user?.id ? user.id.toString() : '';
                const myChatId = realChatId ? realChatId.toString() : '';

                if (incomingChatId === myChatId && incomingUserId !== myId) {
                    console.log('[ChatScreen] Showing Typing Indicator');
                    setIsTyping(true);
                }
            });

            socketRef.current.on('hide_typing', (data) => {
                console.log('[SOCKET] hide_typing received on Mobile:', data);
                const incomingChatId = data.chatId ? data.chatId.toString() : '';
                const myChatId = realChatId ? realChatId.toString() : '';
                if (incomingChatId === myChatId) {
                    setIsTyping(false);
                }
            });

        } catch (err) {
            console.error('[ChatScreen] Init Error:', err);
            setIsLoading(false);
        }
    };

    useEffect(() => {
        initializeChat();
        return () => {
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, []);

    const handleTyping = (text) => {
        setInput(text);

        if (!socketRef.current) {
            console.log('[ChatScreen] socketRef.current is null, cannot emit typing');
            return;
        }

        if (text.length > 0) {
            console.log(`[ChatScreen] Emitting typing_start for chatId: ${chatId}`);
            socketRef.current.emit('typing_start', { chatId });

            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

            typingTimeoutRef.current = setTimeout(() => {
                console.log(`[ChatScreen] Emitting typing_end (timeout) for chatId: ${chatId}`);
                socketRef.current.emit('typing_end', { chatId });
            }, 2000);
        } else {
            console.log(`[ChatScreen] Emitting typing_end (empty) for chatId: ${chatId}`);
            socketRef.current.emit('typing_end', { chatId });
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        }
    };

    const handleUnlockImage = async (msg) => {
        const cost = msg.unlock_cost || 50;
        if (currentBalance < cost) {
            setShowCoinModal(true);
            return;
        }

        try {
            const token = await AsyncStorage.getItem('token');
            const res = await axios.post(`${API_URL}/messages/unlock`, {
                messageId: msg.id
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success) {
                setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_unlocked: true } : m));
                setCurrentBalance(prev => prev - cost);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
        } catch (error) {
            if (error.response?.data?.code === 'INSUFFICIENT_FUNDS') {
                setShowCoinModal(true);
            } else {
                showAlert({ title: 'Hata', message: 'Fotoğraf açılamadı.', type: 'error' });
            }
        }
    };

    const confirmUnlock = (msg) => {
        const cost = msg.unlock_cost || 50;
        Alert.alert(
            "Kilitli Fotoğraf",
            `Bu fotoğrafı görmek için ${cost} Coin ödemek istiyor musunuz?`,
            [
                { text: "İptal", style: "cancel" },
                { text: "Aç", onPress: () => handleUnlockImage(msg) }
            ]
        );
    };

    const sendMessage = (textOrEvent) => {
        const textToSend = typeof textOrEvent === 'string' ? textOrEvent : input;
        if (!textToSend || typeof textToSend !== 'string' || textToSend.trim() === '' || !chatId) return;
        
        // SOCKET CHECK
        if (!socketRef.current || !socketRef.current.connected) {
            showAlert({ 
                title: 'Bağlantı Hatası', 
                message: 'Sunucu ile bağlantı kurulamadı. Lütfen internetinizi kontrol edin veya birazdan tekrar deneyin.', 
                type: 'error' 
            });
            console.error('[ChatScreen] Socket is not connected!');
            return;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        // Check Balance
        if (currentBalance < 10 && (user.vip_level || 0) < 1) { 
            console.log('[ChatScreen] Insufficient balance detected! Current:', currentBalance, 'User VIP:', user.vip_level);
            handleInsufficientCoins();
            return;
        }

        // Optimistic Balance Update
        const nextBalance = Math.max(0, currentBalance - 10);
        setCurrentBalance(nextBalance);

        // If balance reached 0, trigger the centralized flow
        if (nextBalance <= 0 && (user.vip_level || 0) < 1) {
            setTimeout(() => {
                handleInsufficientCoins();
            }, 1000); 
        }

        const tempId = Date.now().toString();
        const optimisticMsg = {
            id: tempId,
            chat_id: chatId,
            sender_id: user.id,
            content: textToSend,
            type: 'text',
            created_at: new Date().toISOString(),
            is_optimistic: true
        };

        setMessages(prev => [...prev, optimisticMsg]);
        setInput('');

        const msgData = {
            chatId: chatId,
            senderId: user.id,
            content: textToSend,
            type: 'text',
            tempId: tempId
        };

        socketRef.current.emit('send_message', msgData);

        // Stop typing immediately
        socketRef.current.emit('typing_end', { chatId });
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };

    const renderIcebreakers = () => {
        // Only show in empty chats AND when input is empty
        if ((messages && messages.length > 0) || input.length > 0) return null;

        return (
            <View style={styles.icebreakerContainer}>
                <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.icebreakerScroll}
                >
                    {ICEBREAKERS.map((text, index) => (
                        <TouchableOpacity
                            key={index}
                            style={[styles.icebreakerPill, { backgroundColor: 'rgba(255,255,255,0.12)' }]}
                            onPress={() => {
                                sendMessage(text);
                                setShowIcebreakers(false);
                            }}
                        >
                            <Text style={styles.icebreakerText}>{text}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        );
    };



    const handleSendGift = (gift) => {
        if (!chatId) return;

        if (currentBalance < gift.price) {
            setShowGiftModal(false);
            handleInsufficientCoins();
            return;
        }

        // Show Fullscreen Animation
        setActiveGift(gift);
        setShowGiftModal(false);

        const tempId = Date.now().toString();
        const optimisticMsg = {
            id: tempId,
            chat_id: chatId,
            sender_id: user.id,
            content: gift.name,
            type: 'gift',
            gift_id: gift.id,
            created_at: new Date().toISOString(),
            is_optimistic: true
        };
        setMessages(prev => [...prev, optimisticMsg]);

        const msgData = {
            chatId: chatId,
            senderId: user.id,
            content: gift.name,
            type: 'gift',
            tempId: tempId,
            giftId: gift.id
        };

        socketRef.current?.emit('send_message', msgData);
    };

    // --- MEDIA SHARING LOGIC ---
    const handleSendImage = async () => {
        if (currentBalance < 50 && (user.vip_level || 0) < 1) {
            handleInsufficientCoins();
            return;
        }

        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            showAlert({ title: 'İzin Gerekli', message: 'Galeriye erişim izni vermelisiniz.', type: 'warning' });
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.7,
        });

        if (!result.canceled) {
            uploadAndSendImage(result.assets[0].uri);
        }
    };

    const uploadAndSendImage = async (uri) => {
        try {
            const formData = new FormData();
            formData.append('file', {
                uri: uri,
                type: 'image/jpeg',
                name: 'chat_upload.jpg',
            });

            const token = await AsyncStorage.getItem('token');
            const res = await axios.post(`${API_URL}/upload`, formData, {
                headers: { 
                    'Content-Type': 'multipart/form-data',
                    'Authorization': `Bearer ${token}`
                },
            });

            const imageUrl = res.data.url || `${API_URL}${res.data.relativePath}`; // Handle both formats if flexible

            const tempId = Date.now().toString();
            const optimisticMsg = {
                id: tempId,
                chat_id: chatId,
                sender_id: user.id,
                content: imageUrl,
                type: 'image',
                content_type: 'image',
                created_at: new Date().toISOString(),
                is_optimistic: true
            };
            setMessages(prev => [...prev, optimisticMsg]);

            const msgData = {
                chatId: chatId,
                senderId: user.id,
                content: imageUrl,
                type: 'image',
                tempId: tempId
            };
            socketRef.current?.emit('send_message', msgData);

        } catch (error) {
            console.error('Upload Error:', error);
            showAlert({ title: 'Hata', message: 'Resim gönderilemedi.', type: 'error' });
        }
    };

    // --- VOICE MESSAGE LOGIC ---
    const startRecording = async () => {
        if (currentBalance < 30 && (user.vip_level || 0) < 1) {
            handleInsufficientCoins();
            return;
        }

        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const permission = await Audio.requestPermissionsAsync();
            if (permission.status === 'granted') {
                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: true,
                    playsInSilentModeIOS: true,
                });
                const { recording } = await Audio.Recording.createAsync(
                    Audio.RecordingOptionsPresets.HIGH_QUALITY
                );
                setRecording(recording);
            } else {
                showAlert({ title: 'İzin Gerekli', message: 'Mikrofon izni vermelisiniz.', type: 'warning' });
            }
        } catch (err) {
            console.error('Failed to start recording', err);
        }
    };

    const stopRecording = async () => {
        if (!recording) return;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setRecording(null);
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        uploadAndSendAudio(uri);
    };

    const uploadAndSendAudio = async (uri) => {
        try {
            const formData = new FormData();
            formData.append('file', {
                uri: uri,
                type: 'audio/m4a',
                name: 'voice_message.m4a',
            });

            const token = await AsyncStorage.getItem('token');
            const res = await axios.post(`${API_URL}/upload`, formData, {
                headers: { 
                    'Content-Type': 'multipart/form-data',
                    'Authorization': `Bearer ${token}`
                },
            });

            const audioUrl = res.data.url || `${API_URL}${res.data.relativePath}`;

            const tempId = Date.now().toString();
            const optimisticMsg = {
                id: tempId,
                chat_id: chatId,
                sender_id: user.id,
                content: audioUrl,
                type: 'audio',
                content_type: 'audio',
                created_at: new Date().toISOString(),
                is_optimistic: true
            };
            setMessages(prev => [...prev, optimisticMsg]);

            const msgData = {
                chatId: chatId,
                senderId: user.id,
                content: audioUrl,
                type: 'audio',
                tempId: tempId
            };
            socketRef.current?.emit('send_message', msgData);

        } catch (error) {
            console.error('Audio Upload Error:', error);
            showAlert({ title: 'Hata', message: 'Ses gönderilemedi.', type: 'error' });
        }
    };

    const playAudio = async (uri) => {
        try {
            const { sound } = await Audio.Sound.createAsync({ uri });
            await sound.playAsync();
        } catch (error) {
            console.error('Play Audio Error:', error);
        }
    };

    const handleBlock = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            await axios.post(`${API_URL}/block`, {
                blockerId: user.id,
                blockedId: operatorId
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setShowOptions(false);
            navigation.goBack();
            showAlert({ title: 'Engellendi', message: 'Kullanıcı engellendi.', type: 'info' });
        } catch (error) {
            console.error(error);
            showAlert({ title: 'Hata', message: 'Engelleme başarısız.', type: 'error' });
        }
    };

    const renderMessage = ({ item, index }) => {
        const isUser = item.sender_id === user.id;

        if (item.type === 'gift' || item.content_type === 'gift') {
            const giftId = parseInt(item.gift_id || item.giftId);
            const gift = GIFTS.find(g => g.id === giftId) || { name: item.content || 'Hediye', price: '?' };

            return (
                <View style={[styles.giftBubbleContainer, isUser ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]}>
                    <MessageBubble 
                        isMine={isUser} 
                        index={index} 
                        isRead={item.is_read}
                        reaction={item.reaction}
                        onReaction={(type) => {
                            socketRef.current?.emit('message_reaction', { messageId: item.id, reaction: type, chatId });
                            setMessages(prev => prev.map(m => m.id === item.id ? { ...m, reaction: type } : m));
                        }}
                    >
                        <View style={styles.giftMessageContent}>
                            <Image
                                source={gift.image || require('../assets/gift_icon.webp')}
                                style={{ width: 80, height: 80, marginBottom: 8 }}
                                resizeMode="contain"
                            />
                            <View style={styles.giftInfo}>
                                <Text style={[styles.giftNameText, { color: theme.colors.text }]}>{gift.name}</Text>
                                <View style={styles.giftPriceBadge}>
                                    <Text style={[styles.giftPriceText, { color: theme.colors.text }]}>{gift.price} COIN</Text>
                                </View>
                            </View>
                        </View>
                    </MessageBubble>
                </View>
            );
        }

        let content = <Text style={[styles.messageText, { color: theme.colors.text }]}>{item.content}</Text>;

        if (item.content_type === 'image' || item.type === 'image' || item.content_type === 'locked_image' || item.type === 'locked_image') {
            const isLocked = (item.content_type === 'locked_image' || item.type === 'locked_image') && !item.is_unlocked && !isUser;
            content = (
                <TouchableOpacity 
                    activeOpacity={0.9} 
                    onPress={() => { 
                        if (isLocked) {
                            confirmUnlock(item);
                        } else {
                            setSelectedImage(item.content);
                        }
                    }}
                >
                    <View style={{ position: 'relative' }}>
                        <Image
                            source={{ uri: resolveImageUrl(item.content) }}
                            style={{ width: 220, height: 220, borderRadius: 16, backgroundColor: '#cbd5e1' }}
                            resizeMode="cover"
                            blurRadius={isLocked ? 30 : 0}
                        />
                        {isLocked && (
                            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 16 }}>
                                <View style={{ backgroundColor: 'rgba(0,0,0,0.5)', padding: 12, borderRadius: 50, alignItems: 'center' }}>
                                    <Ionicons name="lock-closed" size={32} color="#fbbf24" />
                                    <Text style={{ color: '#fbbf24', fontWeight: '900', marginTop: 4, fontSize: 12 }}>{item.unlock_cost || 50} COIN</Text>
                                </View>
                            </View>
                        )}
                    </View>
                </TouchableOpacity>
            );
        } else if (item.content_type === 'audio') {
            content = (
                <TouchableOpacity onPress={() => playAudio(item.content)} style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="play-circle" size={32} color="white" />
                    <Text style={{ color: 'white', marginLeft: 8 }}>Ses Kaydı Oynat</Text>
                </TouchableOpacity>
            );
        }

        return (
            <MessageBubble
                isMine={isUser}
                index={index}
                isRead={item.is_read}
                avatar={resolveImageUrl(isUser ? user.avatar : avatar_url)}
                vipLevel={isUser ? user.vip_level : vip_level}
                timestamp={item.created_at}
                reaction={item.reaction}
                onReaction={(type) => {
                    socketRef.current?.emit('message_reaction', { messageId: item.id, reaction: type, chatId });
                    setMessages(prev => prev.map(m => m.id === item.id ? { ...m, reaction: type } : m));
                }}
            >
                {content}
            </MessageBubble>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar style="light" translucent backgroundColor="transparent" />
            <ChatBackground themeMode={themeMode} />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 20}
                style={{ flex: 1 }}
            >
                <FlatList
                    ref={flatListRef}
                    data={[...messages].reverse()} // Reverse messages for inverted list
                    inverted={true} // Start from bottom
                    keyExtractor={item => item.id.toString()}
                    renderItem={renderMessage}
                    contentContainerStyle={styles.messagesList}
                    scrollIndicatorInsets={{ right: 1 }} // Fix scrollbar on iOS
                />

                {isTyping && <TypingIndicator />}

                <View style={[styles.modernInputWrapper, { paddingBottom: Math.max(insets.bottom + 10, Platform.OS === 'ios' ? 20 : 15) }]}>
                    {renderIcebreakers()}
                    <GlassCard intensity={40} tint="dark" style={styles.glassInputContainer}>
                        <View style={styles.inputRow}>
                             <TouchableOpacity 
                                 style={styles.quickMsgToggle} 
                                 activeOpacity={0.7}
                                 onPressIn={() => {
                                     Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                     startRecording();
                                 }}
                                 onPressOut={stopRecording}
                             >
                                 <Ionicons 
                                     name="mic" 
                                     size={18} 
                                     color={isRecording ? "#ec4899" : "rgba(255,255,255,0.4)"} 
                                 />
                                 {isRecording && (
                                     <Animated.View style={[styles.recordingRipple, {
                                         transform: [{ scale: waveAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }],
                                         opacity: waveAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] })
                                     }]} />
                                 )}
                             </TouchableOpacity>
                             
                             <View style={styles.inputFlexContainer}>
                                 {isRecording ? (
                                     <View style={styles.recordingRow}>
                                         <View style={styles.waveformContainer}>
                                             {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                                                 <Animated.View 
                                                     key={i}
                                                     style={[
                                                         styles.waveBar,
                                                         {
                                                             height: waveAnim.interpolate({
                                                                 inputRange: [0, 1],
                                                                 outputRange: [8, 12 + (i % 4) * 6]
                                                             })
                                                         }
                                                     ]}
                                                 />
                                             ))}
                                         </View>
                                         <Text style={styles.recordTimerText}>{recordTime}</Text>
                                     </View>
                                 ) : (
                                     <TextInput
                                         style={[styles.input, { color: theme.colors.text }]}
                                         value={input}
                                         onChangeText={handleTyping}
                                         placeholder="Mesaj yaz..."
                                         placeholderTextColor="rgba(255,255,255,0.4)"
                                         multiline
                                         maxHeight={100}
                                         cursorColor={theme.colors.primary}
                                     />
                                 )}
                             </View>

                             {!isRecording && (
                                 <TouchableOpacity onPress={sendMessage} style={styles.sendButton} activeOpacity={0.7}>
                                     <LinearGradient colors={theme.gradients.primary} style={styles.sendGradient}>
                                         <Ionicons name="send" size={20} color="white" />
                                     </LinearGradient>
                                 </TouchableOpacity>
                             )}
                        </View>

                        {/* Bottom Action Bar */}
                        <View style={styles.actionBar}>
                            <TouchableOpacity style={styles.modernActionBtn} onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                navigation.navigate('VideoCall', { receiver: userData });
                            }}>
                                <BlurView intensity={20} tint="light" style={styles.btnBlur}>
                                    <Ionicons name="videocam" size={22} color="rgba(255,255,255,0.8)" />
                                </BlurView>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.modernActionBtn} onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                navigation.navigate('VoiceCall', { receiver: userData });
                            }}>
                                <BlurView intensity={20} tint="light" style={styles.btnBlur}>
                                    <Ionicons name="call" size={22} color="rgba(255,255,255,0.8)" />
                                </BlurView>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.giftIconContainer} onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                setShowGiftModal(true);
                            }}>
                                <Animated.View style={{
                                    transform: [{
                                        translateY: giftAnim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [0, -8]
                                        })
                                    }]
                                }}>
                                    <Image
                                        source={require('../assets/gift_icon.webp')}
                                        style={styles.giftLogoLarge}
                                        resizeMode="contain"
                                    />
                                </Animated.View>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.modernActionBtn} onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setShowIcebreakers(!showIcebreakers);
                            }}>
                                <BlurView intensity={20} tint="light" style={[styles.btnBlur, showIcebreakers && { backgroundColor: 'rgba(236, 72, 153, 0.2)' }]}>
                                    <Ionicons name="flash" size={22} color={showIcebreakers ? "#ec4899" : "rgba(255,255,255,0.8)"} />
                                </BlurView>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.modernActionBtn} onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                handleSendImage();
                            }}>
                                <BlurView intensity={20} tint="light" style={styles.btnBlur}>
                                    <Ionicons name="image" size={22} color="rgba(255,255,255,0.8)" />
                                </BlurView>
                            </TouchableOpacity>
                        </View>
                    </GlassCard>
                </View>
            </KeyboardAvoidingView>

            {/* OPTIONS MENU */}
            {
                showOptions && (
                    <View style={[styles.optionsMenu, { backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.glassBorder }]}>
                        <TouchableOpacity style={styles.optionItem} onPress={() => { setShowOptions(false); setShowReportModal(true); }}>
                            <Ionicons name="flag-outline" size={20} color={theme.colors.text} />
                            <Text style={[styles.optionText, { color: theme.colors.text }]}>Şikayet Et</Text>
                        </TouchableOpacity>
                        <View style={styles.divider} />
                        <TouchableOpacity style={styles.optionItem} onPress={handleBlock}>
                            <Ionicons name="ban-outline" size={20} color="#ef4444" />
                            <Text style={[styles.optionText, { color: '#ef4444' }]}>Engelle</Text>
                        </TouchableOpacity>
                    </View>
                )
            }

            {/* LIGHTBOX MODAL */}
            <ImageLightbox 
                visible={!!selectedImage}
                imageUri={resolveImageUrl(selectedImage)}
                onClose={() => setSelectedImage(null)}
            />

            {/* REPORT MODAL */}
            <ReportModal
                visible={showReportModal}
                onClose={() => setShowReportModal(false)}
                reporterId={user.id}
                reportedId={operatorId}
                onReportSubmitted={() => {
                    setShowReportModal(false);
                    navigation.goBack();
                }}
            />

            {/* GIFT MODAL */}
            <GiftPickerModal
                visible={showGiftModal}
                onClose={() => setShowGiftModal(false)}
                onSelectGift={handleSendGift}
                userBalance={currentBalance}
            />

            {/* GIFT ANIMATION OVERLAY */}
            <GiftOverlay
                gift={activeGift}
                receiver={{ avatar_url: resolveImageUrl(avatar_url), display_name: name, username: name }}
                onFinish={() => setActiveGift(null)}
            />
        </View >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f051a', // Fallback color
    },
    background: {
        ...StyleSheet.absoluteFillObject,
    },
    messagesList: {
        paddingHorizontal: 8,
        paddingTop: 10,
        paddingBottom: 90,
    },
    messageBubble: {
        maxWidth: '75%',
        marginBottom: 16,
        borderRadius: 24,
        overflow: 'hidden',
        ...SHADOWS.medium,
    },
    userBubble: {
        alignSelf: 'flex-end',
        borderBottomRightRadius: 4,
    },
    operatorBubble: {
        alignSelf: 'flex-start',
        borderBottomLeftRadius: 4,
        borderWidth: 1,
    },
    bubbleGradient: {
        paddingHorizontal: 20,
        paddingVertical: 14,
    },
    messageText: {
        fontSize: 13,
        lineHeight: 22,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    modernInputWrapper: {
        paddingBottom: Platform.OS === 'ios' ? 20 : 10,
        backgroundColor: 'transparent',
    },
    glassInputContainer: {
        marginHorizontal: 12,
        borderRadius: 32,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    input: {
        flex: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        minHeight: 44,
        fontSize: 15,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        marginLeft: 10,
        ...SHADOWS.glow,
    },
    sendGradient: {
        flex: 1,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 28,
        paddingBottom: 16,
        paddingTop: 4,
    },
    modernActionBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        overflow: 'hidden',
    },
    btnBlur: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    giftIconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        height: 50,
        width: 60,
    },
    giftLogoLarge: {
        width: 52,
        height: 52,
        zIndex: 2,
    },
    giftEmoji: {
        fontSize: 24,
    },
    optionsMenu: {
        position: 'absolute',
        top: 60,
        right: 20,
        borderRadius: 16,
        padding: 8,
        width: 160,
        zIndex: 100,
        borderWidth: 1,
        ...SHADOWS.medium,
    },
    optionsContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        padding: 20,
        elevation: 10,
        zIndex: 1000,
        borderBottomWidth: 1,
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
        ...SHADOWS.medium,
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    optionText: {
        marginLeft: 12,
        fontSize: 14,
        fontWeight: '600',
    },
    quickMsgToggle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
        marginLeft: 8,
        backgroundColor: 'rgba(255,255,255,0.08)',
        zIndex: 10,
    },
    recordingRipple: {
        position: 'absolute',
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#ec4899',
        zIndex: -1,
    },
    inputFlexContainer: {
        flex: 1,
        height: 44,
        justifyContent: 'center',
    },
    recordingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
        backgroundColor: 'rgba(236, 72, 153, 0.1)',
        borderRadius: 22,
        height: '100%',
    },
    waveformContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        height: '100%',
    },
    waveBar: {
        width: 3,
        backgroundColor: '#ec4899',
        marginHorizontal: 1.5,
        borderRadius: 1.5,
    },
    recordTimerText: {
        color: '#ec4899',
        fontSize: 14,
        fontWeight: '700',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    lightboxClose: {
        position: 'absolute',
        top: 50,
        right: 25,
        zIndex: 100,
        padding: 10,
    },
    lightboxContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    fullImage: {
        width: '100%',
        height: '80%',
    },
    typingText: {
        fontSize: 12,
        fontStyle: 'italic',
    },
    icebreakerContainer: {
        marginBottom: 12,
    },
    icebreakerScroll: {
        paddingHorizontal: 15,
    },
    icebreakerPill: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 18,
        marginRight: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        backgroundColor: 'rgba(255,255,255,0.06)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    icebreakerText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#fff',
    },
    divider: {
        height: 1,
        marginVertical: 4,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 30,
        marginHorizontal: 15,
        marginBottom: 10,
        borderWidth: 1,
    },
    giftBubbleContainer: {
        marginVertical: 8,
        maxWidth: '80%',
    },
    giftMessageContent: {
        alignItems: 'center',
        padding: 10,
        minWidth: 120,
    },
    giftIconLarge: {
        fontSize: 48,
        marginBottom: 8,
    },
    giftInfo: {
        alignItems: 'center',
    },
    giftNameText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 4,
    },
    giftPriceBadge: {
        backgroundColor: 'rgba(251, 191, 36, 0.2)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(251, 191, 36, 0.3)',
    },
    giftPriceText: {
        color: '#fbbf24',
        fontSize: 12,
        fontWeight: '900',
    },
});
