import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
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
    const [socket, setSocket] = useState(null);
    const [user, setUser] = useState(null);
    const { showNotification } = useInAppNotification();

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
            const token = await AsyncStorage.getItem('token');
            const res = await axios.get(`${API_URL}/users/${userId}/balance`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            setBalance(res.data.balance);
            useAppStore.getState().setBalance(res.data.balance);
        } catch (error) {
            console.error('[ChatContext] Fetch balance error:', error);
        }
    };

    const initialize = async () => {
        const userData = await AsyncStorage.getItem('user');
        if (userData) {
            const parsedUser = JSON.parse(userData);
            setUser(parsedUser);
            useAppStore.getState().setUser(parsedUser);
            fetchUnreadCount(parsedUser.id);
            fetchBalance(parsedUser.id);
            setupSocket(parsedUser.id);
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
            query: { userId }
        });

        socketRef.current = newSocket;
        setSocket(newSocket);

        newSocket.on('new_message', (data) => {
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
                        body: data.content_type === 'text' ? data.content : (data.content_type === 'gift' ? '🎁 Hediye gönderdi' : '📷 Medya gönderdi'),
                        icon: resolveImageUrl(data.sender_avatar),
                        data: { chatId: incomingChatId },
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
        });

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

        socketRef.current.on('chats_updated', () => {
            fetchUnreadCount(userId);
        });

        // Listen for balance updates
        socketRef.current.on('balance_updated', (data) => {
            if (data && typeof data.balance === 'number') {
                setBalance(data.balance);
                useAppStore.getState().setBalance(data.balance);
            }
        });

        // Listen for 1-to-1 incoming voice calls
        newSocket.on('incoming_call', (data) => {
            console.log('[ChatContext] Incoming call received:', data);
            const activeCallChatId = useAppStore.getState().activeCallChatId;
            if (activeCallChatId) {
                console.log('[ChatContext] Already in call, sending call_busy.');
                newSocket.emit('call_busy', { chatId: data.chatId, callerId: data.callerId });
                return;
            }

            // Set call in progress in store
            useAppStore.getState().setActiveCallChatId(data.chatId);

            const targetScreen = data.callType === 'video' ? 'VideoCall' : 'VoiceCall';

            // Navigate to appropriate Call Screen
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
        });
    };

    useEffect(() => {
        initialize();
        return () => {
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, []);

    // Also update notification logic if activeChatId changes (re-bind listener or use ref)
    const activeChatIdRef = useRef(activeChatId);
    useEffect(() => {
        activeChatIdRef.current = activeChatId;
    }, [activeChatId]);

    // Redefine socket listener when activeChatId changes to use current value
    useEffect(() => {
        if (socketRef.current && user) {
            socketRef.current.off('new_message');
            socketRef.current.on('new_message', (data) => {
                if (data.sender_id !== user.id) {
                    setUnreadCount(prev => prev + 1);
                    const incomingChatId = data.chat_id ? data.chat_id.toString() : '';
                    const currentActiveId = activeChatIdRef.current ? activeChatIdRef.current.toString() : '';

                    if (incomingChatId !== currentActiveId) {
                        showNotification({
                            title: data.sender_name || 'Yeni Mesaj',
                            body: data.content_type === 'text' ? data.content : (data.content_type === 'gift' ? '🎁 Hediye gönderdi' : '📷 Medya gönderdi'),
                            icon: resolveImageUrl(data.sender_avatar),
                            data: { chatId: incomingChatId },
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
            });
        }
    }, [user, showNotification]);

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
            socket
        }}>
            {children}
        </ChatContext.Provider>
    );
};

export const useChat = () => useContext(ChatContext);
