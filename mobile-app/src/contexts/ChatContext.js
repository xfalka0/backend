import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { API_URL, SOCKET_URL } from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
    const [unreadCount, setUnreadCount] = useState(0);
    const socketRef = useRef(null);
    const [user, setUser] = useState(null);

    const fetchUnreadCount = async (userId) => {
        if (!userId) return;
        try {
            const res = await axios.get(`${API_URL}/users/${userId}/unread-count`);
            setUnreadCount(res.data.count);
        } catch (error) {
            console.error('[ChatContext] Fetch unread error:', error);
        }
    };

    const initialize = async () => {
        const userData = await AsyncStorage.getItem('user');
        if (userData) {
            const parsedUser = JSON.parse(userData);
            setUser(parsedUser);
            fetchUnreadCount(parsedUser.id);
            setupSocket(parsedUser.id);
        }
    };

    const setupSocket = (userId) => {
        if (socketRef.current) socketRef.current.disconnect();

        socketRef.current = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            query: { userId }
        });

        socketRef.current.on('new_message', (data) => {
            // If the message is not from the user themselves, increment unread count
            if (data.sender_id !== userId) {
                setUnreadCount(prev => prev + 1);
            }
        });

        socketRef.current.on('chats_updated', () => {
            fetchUnreadCount(userId);
        });
    };

    useEffect(() => {
        initialize();
        return () => {
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, []);

    return (
        <ChatContext.Provider value={{ unreadCount, setUnreadCount, fetchUnreadCount, user }}>
            {children}
        </ChatContext.Provider>
    );
};

export const useChat = () => useContext(ChatContext);
