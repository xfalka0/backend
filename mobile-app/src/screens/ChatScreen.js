import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity, Image, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import io from 'socket.io-client';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av'; // Import Audio
import { API_URL, SOCKET_URL } from '../config';
import MessageBubble from '../components/animated/MessageBubble';
import TypingIndicator from '../components/animated/TypingIndicator';
import VipFrame from '../components/ui/VipFrame';
import { useTheme } from '../contexts/ThemeContext';
import { useAlert } from '../contexts/AlertContext';
import { GIFTS } from '../constants/gifts';

// ...

// This top-level socketRef and recording state are likely placeholders or incorrect.
// The actual state and ref should be inside the functional component.
// const socketRef = useRef(null);
// const [recording, setRecording] = useState(null); // Recording State

// ...

// --- VOICE MESSAGE LOGIC ---
// The original voice message logic block is moved inside the component.
// const startRecording = async () => {
//     try {
//         const permission = await Audio.requestPermissionsAsync();
//         if (permission.status === 'granted') {
//             await Audio.setAudioModeAsync({
//                 allowsRecordingIOS: true,
//                 playsInSilentModeIOS: true,
//             });
//             const { recording } = await Audio.Recording.createAsync(
//                 Audio.RecordingOptionsPresets.HIGH_QUALITY
//             );
//             setRecording(recording);
//         } else {
//             Alert.alert('İzin Gerekli', 'Mikrofon izni vermelisiniz.');
//         }
//     } catch (err) {
//         console.error('Failed to start recording', err);
//     }
// };

// const stopRecording = async () => {
//     if (!recording) return;
//     setRecording(null);
//     await recording.stopAndUnloadAsync();
//     const uri = recording.getURI();
//     uploadAndSendAudio(uri);
// };

// const uploadAndSendAudio = async (uri) => {
//     try {
//         const formData = new FormData();
//         formData.append('audio', {
//             uri: uri,
//             type: 'audio/m4a', // Expo default is m4a
//             name: 'voice_message.m4a',
//         });

//         const res = await axios.post(`${API_URL}/upload`, formData, {
//             headers: { 'Content-Type': 'multipart/form-data' },
//         });

//         const audioUrl = res.data.url || `${API_URL}${res.data.relativePath}`;

//         const msgData = {
//             chatId: chatId,
//             senderId: user.id,
//             content: audioUrl,
//             type: 'audio'
//         };
//         socketRef.current.emit('send_message', msgData);

//     } catch (error) {
//         console.error('Audio Upload Error:', error);
//         Alert.alert('Hata', 'Ses gönderilemedi.');
//     }
// };

// const playAudio = async (uri) => {
//     try {
//         const { sound } = await Audio.Sound.createAsync({ uri });
//         await sound.playAsync();
//     } catch (error) {
//         console.error('Play Audio Error:', error);
//     }
// };

// ...

// The original renderMessage and mic button are replaced below.
// const renderMessage = ({ item }) => {
//     const isUser = item.sender_id === user.id;

//     let content = <Text style={styles.messageText}>{item.content}</Text>;

//     if (item.content_type === 'image') {
//         content = (
//             <Image
//                 source={{ uri: item.content }}
//                 style={{ width: 200, height: 200, borderRadius: 12 }}
//                 resizeMode="cover"
//             />
//         );
//     } else if (item.content_type === 'audio') {
//         content = (
//             <TouchableOpacity onPress={() => playAudio(item.content)} style={{ flexDirection: 'row', alignItems: 'center' }}>
//                 <Ionicons name="play-circle" size={32} color="white" />
//                 <Text style={{ color: 'white', marginLeft: 8 }}>Ses Kaydı Oynat</Text>
//             </TouchableOpacity>
//         );
//     }

//     return (
//         <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.operatorBubble]}>
//     // ...
//             // ... inside Action Bar:
//             <TouchableOpacity style={styles.actionIcon} onPress={recording ? stopRecording : startRecording}>
//                 <Ionicons name={recording ? "stop-circle" : "mic-outline"} size={26} color={recording ? "#ef4444" : "#94a3b8"} />
//             </TouchableOpacity>

import { COLORS, GRADIENTS, SHADOWS } from '../theme';
import ReportModal from '../components/ReportModal';
import InsufficientCoinsModal from '../components/InsufficientCoinsModal';
import GiftPickerModal from '../components/GiftPickerModal';
import GiftOverlay from '../components/animated/GiftOverlay';

export default function ChatScreen({ route, navigation }) {
    const { showAlert } = useAlert();
    const { theme, themeMode } = useTheme();
    const { operatorId, chatId: existingChatId, name, job, user: routeUser = {}, avatar_url, is_online, vip_level = 0 } = route.params;

    // User Handling
    const TEST_USER_ID = 'c917f7d6-cc44-4b04-8917-1dbbed0b1e9b';
    const user = { ...routeUser, id: routeUser.id || TEST_USER_ID };

    const [messages, setMessages] = useState([]);
    const [isTyping, setIsTyping] = useState(false);
    const [input, setInput] = useState('');
    const [chatId, setChatId] = useState(existingChatId || null);

    // UI Toggles
    const [showOptions, setShowOptions] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [showCoinModal, setShowCoinModal] = useState(false);
    const [showGiftModal, setShowGiftModal] = useState(false);

    // Track Balance for Gift Modal (Initial from route, updated via socket)
    const [currentBalance, setCurrentBalance] = useState(user.balance || 0);
    const [recording, setRecording] = useState(null);
    const [activeGift, setActiveGift] = useState(null);

    const socketRef = useRef(null);
    const flatListRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    // Header Config
    React.useLayoutEffect(() => {
        navigation.setOptions({
            headerTitle: () => (
                <View style={{ alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                        <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '900', marginRight: 6 }}>
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
                                    paddingHorizontal: 6,
                                    paddingVertical: 2,
                                    borderRadius: 6,
                                    marginRight: 6
                                }}
                            >
                                <Ionicons name="star" size={10} color="white" />
                                <Text style={{ color: 'white', fontSize: 10, fontWeight: '900', marginLeft: 2 }}>VIP {vip_level}</Text>
                            </LinearGradient>
                        )}

                        <Ionicons name="checkmark-circle" size={16} color="#3b82f6" />
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{
                            width: 7,
                            height: 7,
                            borderRadius: 3.5,
                            backgroundColor: is_online ? '#10b981' : theme.colors.textSecondary,
                            marginRight: 6
                        }} />
                        <Text style={{ color: is_online ? '#10b981' : theme.colors.textSecondary, fontSize: 12, fontWeight: '700' }}>
                            {is_online ? 'Çevrimiçi' : 'Çevrimdışı'}
                        </Text>
                    </View>
                </View>
            ),
            headerRight: () => (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity
                        onPress={() => navigation.navigate('OperatorProfile', { operator: { id: operatorId, name, avatar_url, is_online, vip_level }, user })}
                        style={{ marginRight: 15 }}
                    >
                        <VipFrame
                            level={vip_level}
                            avatar={avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=random&color=fff`}
                            size={38}
                            isStatic={true}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setShowOptions(!showOptions)} style={{ padding: 5 }}>
                        <Ionicons name="ellipsis-vertical" size={24} color={theme.colors.text} />
                    </TouchableOpacity>
                </View>
            ),
            headerTitleAlign: 'center',
        });
    }, [navigation, showOptions, name, is_online, avatar_url, operatorId, user, vip_level]);

    // Initialize Chat
    const initializeChat = async () => {
        try {
            let realChatId = chatId;

            // 1. Get or Create Chat UUID if missing
            if (!realChatId) {
                const chatRes = await axios.post(`${API_URL}/chats`, {
                    userId: user.id,
                    operatorId: operatorId
                });
                realChatId = chatRes.data.id;
                setChatId(realChatId);
                console.log('[ChatScreen] Created/Fetched chatId:', realChatId);
            } else {
                console.log('[ChatScreen] Using existing chatId:', realChatId);
            }

            // 2. Fetch Latest User Balance & History
            const [balanceRes, historyRes] = await Promise.all([
                axios.get(`${API_URL}/users/${user.id}`),
                axios.get(`${API_URL}/messages/${realChatId}`)
            ]);

            // Mark messages as read
            await axios.put(`${API_URL}/chats/${realChatId}/read`, { userId: user.id });

            if (balanceRes.data && balanceRes.data.balance !== undefined) {
                setCurrentBalance(balanceRes.data.balance);
            }
            setMessages(historyRes.data);

            // 3. Connect Socket
            if (socketRef.current) socketRef.current.disconnect();

            const token = await AsyncStorage.getItem('token');
            console.log('[ChatScreen] Connecting to socket with token:', token ? 'Exists' : 'Missing');

            socketRef.current = io(SOCKET_URL, {
                auth: { token }
            });

            socketRef.current.on('connect', () => {
                console.log('[SOCKET] Connected to Backend. Room ID:', realChatId);
                socketRef.current.emit('join_room', realChatId);
            });

            socketRef.current.on('disconnect', (reason) => {
                console.warn('[SOCKET] Disconnected from server:', reason);
            });

            // Listeners
            socketRef.current.on('receive_message', (msg) => {
                setMessages(prev => {
                    // Check if we have an optimistic message with the same tempId (if provided)
                    // or if the message ID already exists
                    const exists = prev.some(m => m.id === msg.id);
                    if (exists) return prev;

                    if (msg.tempId) {
                        // Find and replace the optimistic message
                        const optimisticIndex = prev.findIndex(m => m.id === msg.tempId);
                        if (optimisticIndex !== -1) {
                            const newMessages = [...prev];
                            newMessages[optimisticIndex] = msg; // Replace optimistic with confirmed
                            return newMessages;
                        }
                    } else {
                        // Fallback: try to match by content/time if tempId missing (less reliable but helpful)
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
                    showAlert({ title: 'Hata', message: data.message || 'Mesaj gönderilemedi.', type: 'error' });
                }
            });

            socketRef.current.on('balance_update', (data) => {
                console.log('[SOCKET] Balance Update received:', data);
                if (data.userId === user.id || data.id === user.id) {
                    setCurrentBalance(data.newBalance);
                }
            });

            socketRef.current.on('display_typing', (data) => {
                console.log('[SOCKET] display_typing received on Mobile:', data);
                // Don't show indicator if it's our own typing event
                if (data.chatId === realChatId && data.userId !== user.id) {
                    setIsTyping(true);
                }
            });

            socketRef.current.on('hide_typing', (data) => {
                console.log('[SOCKET] hide_typing received on Mobile:', data);
                if (data.chatId === realChatId) {
                    setIsTyping(false);
                }
            });

        } catch (error) {
            console.error('Chat Initialization Error:', error);
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

    const sendMessage = () => {
        if (input.trim() === '' || !chatId) return;

        // Check Balance
        if (currentBalance < 10 && vip_level < 1) { // Assuming 10 is cost and VIPs might bypass or checking balance logic
            setShowCoinModal(true);
            return;
        }

        // Optimistic Balance Update
        setCurrentBalance(prev => Math.max(0, prev - 10));

        const tempId = Date.now().toString();
        const optimisticMsg = {
            id: tempId,
            chat_id: chatId,
            sender_id: user.id,
            content: input,
            type: 'text',
            created_at: new Date().toISOString(),
            is_optimistic: true // Flag to identify and replace later
        };

        setMessages(prev => [...prev, optimisticMsg]);
        setInput('');

        const msgData = {
            chatId: chatId,
            senderId: user.id,
            content: input,
            type: 'text',
            tempId: tempId // Send tempId to track confirmation
        };

        socketRef.current?.emit('send_message', msgData);

        // Stop typing immediately
        socketRef.current?.emit('typing_end', { chatId });
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };



    const handleSendGift = (gift) => {
        if (!chatId) return;

        if (currentBalance < gift.price) {
            setShowGiftModal(false);
            setShowCoinModal(true);
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
        if (currentBalance < 50) {
            setShowCoinModal(true);
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

            const res = await axios.post(`${API_URL}/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-type' },
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
        if (currentBalance < 30) {
            setShowCoinModal(true);
            return;
        }

        try {
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

            const res = await axios.post(`${API_URL}/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
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
            await axios.post(`${API_URL}/block`, {
                blockerId: user.id,
                blockedId: operatorId
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
                    <MessageBubble isMine={isUser} index={index} isRead={item.is_read}>
                        <View style={styles.giftMessageContent}>
                            <Image
                                source={gift.image || require('../assets/gift_icon.webp')}
                                style={{ width: 80, height: 80, marginBottom: 8 }}
                                resizeMode="contain"
                            />
                            <View style={styles.giftInfo}>
                                <Text style={styles.giftNameText}>{gift.name}</Text>
                                <View style={styles.giftPriceBadge}>
                                    <Text style={styles.giftPriceText}>{gift.price} COIN</Text>
                                </View>
                            </View>
                        </View>
                    </MessageBubble>
                </View>
            );
        }

        let content = <Text style={styles.messageText}>{item.content}</Text>;

        if (item.content_type === 'image' || item.type === 'image') {
            content = (
                <TouchableOpacity activeOpacity={0.9} onPress={() => { /* View full screen logic optional */ }}>
                    <Image
                        source={{ uri: item.content }}
                        style={{ width: 220, height: 220, borderRadius: 16, backgroundColor: '#cbd5e1' }}
                        resizeMode="cover"
                    />
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
            <MessageBubble isMine={isUser} index={index} isRead={item.is_read}>
                {content}
            </MessageBubble>
        );
    };

    // Pagination State
    const [refreshing, setRefreshing] = useState(false);

    const loadPreviousMessages = async () => {
        if (!chatId || refreshing) return;
        setRefreshing(true);
        try {
            const limit = 50;
            const offset = messages.length;
            const res = await axios.get(`${API_URL}/messages/${chatId}?limit=${limit}&offset=${offset}`);

            if (res.data.length > 0) {
                // For inverted list, new (older) messages are added to the END of array (which is top visual)
                // But since we reverse the array in render, we actually need to append them to state as usual
                setMessages(prev => [...prev, ...res.data]);
                // Wait, if messages = [Oldest, ..., Newest]
                // Reversed = [Newest, ..., Oldest]
                // FlatList Inverted: Bottom is Index 0 (Newest). Top is Last Index (Oldest).
                // When we load more (older), we want them to appear at the Top.
                // So they should be at the END of the Reversed array, which means they should be at the START of the original array?
                // Original: [Msg1, Msg2] (Msg1 is older). Visual Top: Msg1.
                // Load More: [Msg0, Msg1, Msg2]. Visual Top: Msg0.
                // So we should PREPEND to state.
                setMessages(prev => [...res.data, ...prev]);
            }
        } catch (error) {
            console.error('Load Previous Messages Error:', error);
        } finally {
            setRefreshing(false);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {themeMode === 'dark' && (
                <LinearGradient
                    colors={['#0f172a', '#1e1b4b', '#0f172a']}
                    style={styles.background}
                />
            )}

            <FlatList
                ref={flatListRef}
                data={[...messages].reverse()} // Reverse messages for inverted list
                inverted={true} // Start from bottom
                keyExtractor={item => item.id.toString()}
                renderItem={renderMessage}
                contentContainerStyle={styles.messagesList}
                scrollIndicatorInsets={{ right: 1 }} // Fix scrollbar on iOS
                ListHeaderComponent={isTyping ? <TypingIndicator /> : null}
            />

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90}>
                <View style={[styles.inputContainer, { backgroundColor: theme.colors.background, borderTopColor: theme.colors.glassBorder }]}>
                    <TextInput
                        style={[styles.input, { backgroundColor: theme.colors.glass, borderColor: theme.colors.glassBorder, color: theme.colors.text }]}
                        value={input}
                        onChangeText={handleTyping}
                        placeholder="Mesaj yaz..."
                        placeholderTextColor={theme.colors.textSecondary}
                    />

                    <TouchableOpacity onPress={sendMessage} style={styles.sendButton}>
                        <LinearGradient colors={theme.gradients.primary} style={styles.sendGradient}>
                            <Ionicons name="send" size={20} color="white" />
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                {/* Bottom Action Bar */}
                <View style={styles.actionBar}>
                    <TouchableOpacity style={styles.actionIcon} onPress={() => navigation.navigate('VideoCall', { name, avatar_url })}>
                        <Ionicons name="videocam-outline" size={26} color="#94a3b8" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionIcon} onPress={() => navigation.navigate('VoiceCall', { name, avatar_url })}>
                        <Ionicons name="call-outline" size={24} color="#94a3b8" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.giftIconContainer} onPress={() => setShowGiftModal(true)}>
                        <Image
                            source={require('../assets/gift_icon.webp')}
                            style={styles.giftLogoLarge}
                            resizeMode="contain"
                        />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionIcon} onPress={recording ? stopRecording : startRecording}>
                        <Ionicons name={recording ? "stop-circle" : "mic-outline"} size={26} color={recording ? "#ef4444" : "#94a3b8"} />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionIcon} onPress={handleSendImage}>
                        <Ionicons name="image-outline" size={26} color="#94a3b8" />
                    </TouchableOpacity>
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

            {/* COIN WARNING MODAL */}
            <InsufficientCoinsModal
                visible={showCoinModal}
                onClose={() => setShowCoinModal(false)}
                onBuyCoins={() => {
                    setShowCoinModal(false);
                    navigation.navigate('Shop', { user });
                }}
            />
            {/* GIFT ANIMATION OVERLAY */}
            <GiftOverlay
                gift={activeGift}
                receiver={{ avatar_url, display_name: name, username: name }}
                onFinish={() => setActiveGift(null)}
            />
        </View >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    background: {
        ...StyleSheet.absoluteFillObject,
    },
    messagesList: {
        paddingHorizontal: 16,
        paddingTop: 20,    // Visual BOTTOM padding (inverted)
        paddingBottom: 100, // Visual TOP padding (inverted - space for header)
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
        backgroundColor: COLORS.card,
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
    },
    bubbleGradient: {
        paddingHorizontal: 20,
        paddingVertical: 14,
    },
    messageText: {
        color: COLORS.text,
        fontSize: 15,
        lineHeight: 22,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16, // Restored to symmetric padding
        paddingVertical: 12,
        backgroundColor: 'rgba(9, 9, 11, 0.8)',
        borderTopWidth: 1,
        borderTopColor: COLORS.glassBorder,
    },
    input: {
        flex: 1,
        backgroundColor: COLORS.glass,
        borderRadius: 24,
        paddingHorizontal: 16,
        paddingVertical: 10,
        color: COLORS.text,
        fontSize: 15,
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        marginLeft: 12,
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
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingVertical: 16,
        backgroundColor: COLORS.card,
        marginHorizontal: 16,
        marginBottom: Platform.OS === 'ios' ? 0 : 16,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
        ...SHADOWS.medium,
    },
    actionIcon: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 20,
        backgroundColor: COLORS.glass,
    },
    giftIconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: -32, // Adjusted for slightly smaller logo
    },
    giftLogoLarge: {
        width: 54, // Reduced from 70
        height: 54,
        ...SHADOWS.glow,
    },
    giftEmoji: {
        fontSize: 24,
    },
    optionsMenu: {
        position: 'absolute',
        top: 60,
        right: 20,
        backgroundColor: COLORS.card,
        borderRadius: 16,
        padding: 8,
        width: 160,
        zIndex: 100,
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
        color: COLORS.text,
        marginLeft: 12,
        fontSize: 14,
        fontWeight: '600',
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.glassBorder,
        marginVertical: 4,
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
