import React, { createContext, useState, useContext, useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import axios from 'axios';
import io from 'socket.io-client';
import { API_URL, SOCKET_URL } from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useInAppNotification } from './InAppNotificationContext';
import { useAppStore } from '../store/useAppStore';
import { resolveImageUrl } from '../utils/imageUtils';
import * as RootNavigation from '../services/navigationRef';

const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
    const [unreadCount, setUnreadCount] = useState(0);
    const [activeChatId, setActiveChatId] = useState(null);
    const [balance, setBalance] = useState(0);
    const socketRef = useRef(null);
    const processedCallIdsRef = useRef(new Set());
    const initializedUserIdRef = useRef(null);
    const initializingRef = useRef(false);
    const newMessageHandlerRef = useRef(null);
    const [socket, setSocket] = useState(null);
    const [user, setUser] = useState(null);
    const { showNotification } = useInAppNotification();
    const sessionStatus = useAppStore(state => state.sessionStatus);

    const ensureSocketConnected = useCallback(() => {
        if (useAppStore.getState().sessionStatus !== 'verified') return;
        const activeSocket = socketRef.current;
        if (activeSocket && !activeSocket.connected) {
            console.log('[ChatContext] Triggering socket reconnect on focus/foreground');
            activeSocket.connect();
        }
    }, []);

    const fetchUnreadCount = async (userId) => {
        if (!userId) return;
        try {
            const res = await axios.get(`${API_URL}/users/${userId}/unread-count`);
            setUnreadCount(res.data.count);
            useAppStore.getState().setUnreadCount(res.data.count);
        } catch (error) {
            console.error('[ChatContext] Fetch unread error:', error);
        }
    };

    const fetchBalance = async (userId) => {
        if (!userId) return;
        try {
            const freshBal = await useAppStore.getState().syncBalanceWithServer({ force: true });
            if (freshBal !== undefined && freshBal !== null) {
                setBalance(freshBal);
            }
        } catch (error) {
            console.error('[ChatContext] Fetch balance error:', error);
        }
    };

    const initialize = async (options = {}) => {
        const force = options?.force !== false;
        if (initializingRef.current) return;
        initializingRef.current = true;
        try {
            const userData = await AsyncStorage.getItem('user');
            if (userData) {
                const parsedUser = JSON.parse(userData);
                if (!force && initializedUserIdRef.current === parsedUser.id && socketRef.current) {
                    return;
                }
                initializedUserIdRef.current = parsedUser.id;
                setUser(parsedUser);
                useAppStore.getState().setUser(parsedUser);
                if (useAppStore.getState().sessionStatus !== 'verified') {
                    useAppStore.getState().setSessionStatus('verified');
                }
                fetchUnreadCount(parsedUser.id);
                fetchBalance(parsedUser.id);
                setupSocket(parsedUser.id);
            }
        } finally {
            initializingRef.current = false;
        }
    };

    const setupSocket = async (userId) => {
        if (socketRef.current) {
            socketRef.current.disconnect();
            setSocket(null);
        }

        const token = await AsyncStorage.getItem('token');

        const newSocket = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            auth: { token },
            query: { userId },
            reconnection: true,
            reconnectionDelay: 2000,
            reconnectionDelayMax: 30000,
            randomizationFactor: 0.2,
            reconnectionAttempts: 8,
        });

        socketRef.current = newSocket;
        setSocket(newSocket);

        newSocket.on('connect', () => {
            console.log('[ChatContext] Socket connected:', newSocket.id);
        });

        newSocket.io.on('reconnect_attempt', (attempt) => {
            console.log('[ChatContext] Socket reconnect attempt:', attempt);
        });

        newSocket.io.on('reconnect_failed', () => {
            console.log('[ChatContext] Socket reconnect limit reached (8 attempts); will resume on focus/foreground.');
        });

        const handleContextNewMessage = (data) => {
            console.log('[ChatContext] New message received:', data);
            // If the message is not from the user themselves, increment unread count
            if (data.sender_id !== userId) {
                setUnreadCount(prev => prev + 1);
                useAppStore.getState().setUnreadCount(useAppStore.getState().unreadCount + 1);

                // If message is from a DIFFERENT chat than the active one, show notification
                const incomingChatId = data.chat_id ? data.chat_id.toString() : '';
                const myActiveChatId = activeChatId ? activeChatId.toString() : '';

                if (incomingChatId !== myActiveChatId) {
                    showNotification({
                        title: data.sender_name || 'Yeni Mesaj',
                        body: data.content_type === 'text' ? data.content : (data.content_type === 'gift' ? '🎁 Hediye gönderdi' : (data.content_type === 'image' || data.content_type === 'locked_image' ? '📷 Medya gönderdi' : '💬 Mesaj gönderdi')),
                        icon: resolveImageUrl(data.sender_avatar),
                        data: { chatId: incomingChatId, senderId: data.sender_id, senderName: data.sender_name, senderAvatar: data.sender_avatar },
                        onPress: () => {
                            const currentUser = useAppStore.getState().user;
                            RootNavigation.navigate('Chat', {
                                chatId: incomingChatId,
                                operatorId: data.sender_id,
                                name: data.sender_name,
                                avatar_url: data.sender_avatar,
                                user: currentUser
                            });
                        }
                    });
                }
            }
        };
        newMessageHandlerRef.current = handleContextNewMessage;
        newSocket.on('new_message', handleContextNewMessage);

        // Listen for profile views
        newSocket.on('profile_viewed', (data) => {
            console.log('[ChatContext] Profile viewed event:', data);
            showNotification({
                title: 'Birisi profilini ziyaret etti',
                body: `${data.totalViews} kullanıcısı profilini ziyaret etti, gidip göz at ~`,
                icon: resolveImageUrl(data.viewerAvatar),
                data: { type: 'profile_view', viewerId: data.viewerId },
                onPress: () => {
                    RootNavigation.navigate('ProfileVisitors', { user: user });
                }
            });
        });

        // Listen for balance updates
        socketRef.current.on('balance_updated', (data) => {
            if (data && typeof data.balance === 'number') {
                setBalance(data.balance);
                useAppStore.getState().setBalance(data.balance);
            }
        });

        // Listen for 1-to-1 incoming voice calls
        const handleIncomingCall = (data) => {
            console.log('[CALL LOG 📱] ChatContext: incoming_call payload received:', JSON.stringify(data));
            if (!data || !data.callId) return;

            // Deduplicate by callId
            if (processedCallIdsRef.current.has(data.callId)) {
                console.log(`[CALL LOG ⏭️] Duplicate callId ${data.callId} received. Ignoring packet.`);
                return;
            }

            const currentUser = useAppStore.getState().user;
            if (data.receiverId && currentUser && data.receiverId.toString() !== currentUser.id?.toString()) {
                console.log(`[CALL LOG ⏭️] Call is for user ${data.receiverId}, but current user is ${currentUser.id}. Bypassing.`);
                return;
            }

            // Mark callId as processed to prevent duplicate packet execution
            processedCallIdsRef.current.add(data.callId);
            if (processedCallIdsRef.current.size > 20) {
                const first = processedCallIdsRef.current.values().next().value;
                processedCallIdsRef.current.delete(first);
            }

            const activeCallChatId = useAppStore.getState().activeCallChatId;
            // Only consider busy if user is in a DIFFERENT active call
            if (activeCallChatId && activeCallChatId.toString() !== data.chatId.toString()) {
                console.log('[CALL LOG ⚠️] User in different call activeCallChatId=' + activeCallChatId + ', sending call_busy.');
                newSocket.emit('call_busy', { chatId: data.chatId, callerId: data.callerId });
                return;
            }

            useAppStore.getState().setActiveCallChatId(data.chatId);

            const targetScreen = data.callType === 'video' ? 'VideoCall' : 'VoiceCall';
            console.log(`[CALL LOG 🚀] Navigating to ${targetScreen} with caller ${data.callerName} (${data.callerId})`);

            RootNavigation.navigate(targetScreen, {
                receiver: {
                    id: data.callerId,
                    name: data.callerName,
                    avatar_url: data.callerAvatar
                },
                rtcToken: data.rtcToken,
                channelName: data.channelName,
                isIncoming: true,
                chatId: data.chatId,
                callId: data.callId
            });
        };

        newSocket.on('incoming_call', handleIncomingCall);
        newSocket.on('incoming_call_global', handleIncomingCall);
    };

    useEffect(() => {
        if (sessionStatus === 'verified') {
            initialize({ force: false });
        } else if (sessionStatus === 'unauthenticated') {
            initializedUserIdRef.current = null;
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
                setSocket(null);
            }
            setUser(null);
            setUnreadCount(0);
            setBalance(0);
        }
    }, [sessionStatus]);

    useEffect(() => {
        const sub = AppState.addEventListener('change', (nextState) => {
            if (nextState === 'active') {
                ensureSocketConnected();
            }
        });
        return () => sub?.remove?.();
    }, [ensureSocketConnected]);

    useEffect(() => {
        return () => {
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, []);

    // Also update notification logic if activeChatId changes (re-bind listener or use ref)
    const activeChatIdRef = useRef(activeChatId);
    useEffect(() => {
        activeChatIdRef.current = activeChatId;
    }, [activeChatId]);

    // Redefine socket listener cleanly with scoped handler reference so sibling listeners stay intact
    useEffect(() => {
        const currentSocket = socketRef.current;
        if (!currentSocket || !user) return undefined;

        if (newMessageHandlerRef.current) {
            currentSocket.off('new_message', newMessageHandlerRef.current);
        }

        const handleNewMessageNotification = (data) => {
            if (data.sender_id !== user.id) {
                setUnreadCount(prev => prev + 1);
                const incomingChatId = data.chat_id ? data.chat_id.toString() : '';
                const currentActiveId = activeChatIdRef.current ? activeChatIdRef.current.toString() : '';

                if (incomingChatId !== currentActiveId) {
                    showNotification({
                        title: data.sender_name || 'Yeni Mesaj',
                        body: data.content_type === 'text' ? data.content : (data.content_type === 'gift' ? '🎁 Hediye gönderdi' : (data.content_type === 'image' || data.content_type === 'locked_image' ? '📷 Medya gönderdi' : '💬 Mesaj gönderdi')),
                        icon: resolveImageUrl(data.sender_avatar),
                        data: { chatId: incomingChatId, senderId: data.sender_id, senderName: data.sender_name, senderAvatar: data.sender_avatar },
                        onPress: () => {
                            RootNavigation.navigate('Chat', {
                                chatId: incomingChatId,
                                operatorId: data.sender_id,
                                name: data.sender_name,
                                avatar_url: data.sender_avatar,
                                user: user
                            });
                        }
                    });
                }
            }
        };

        newMessageHandlerRef.current = handleNewMessageNotification;
        currentSocket.on('new_message', handleNewMessageNotification);

        return () => {
            currentSocket.off('new_message', handleNewMessageNotification);
        };
    }, [user, showNotification, socket]);

    return (
        <ChatContext.Provider value={{ 
            unreadCount, 
            setUnreadCount, 
            fetchUnreadCount, 
            user, 
            activeChatId, 
            setActiveChatId,
            balance,
            setBalance,
            fetchBalance,
            refreshUser: initialize,
            ensureSocketConnected,
            socket
        }}>
            {children}
        </ChatContext.Provider>
    );
};

export const useChat = () => useContext(ChatContext);
