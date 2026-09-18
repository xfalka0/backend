import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import io from 'socket.io-client';

import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_URL = '';
const SOCKET_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'https://backend-kj17.onrender.com'
    : window.location.origin;

const Chats = () => {
    const { token, user } = useAuth(); // Get token and user from Context
    const [chats, setChats] = useState([]);
    const [selectedChat, setSelectedChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [isTyping, setIsTyping] = useState(false);
    const [input, setInput] = useState('');
    const [quickReplies, setQuickReplies] = useState([]);
    const [showQuickMessages, setShowQuickMessages] = useState(false);
    const [voiceMessages, setVoiceMessages] = useState([]);
    const [showVoiceMessages, setShowVoiceMessages] = useState(false);
    const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [isLockedImage, setIsLockedImage] = useState(false);
    const [lockedImageCost, setLockedImageCost] = useState(200);
    const [loadingMoreChats, setLoadingMoreChats] = useState(false);
    const socketRef = useRef(null);
    const messagesEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const fileInputRef = useRef(null);
    const selectedChatIdRef = useRef(null);
    const chatListRef = useRef(null);
    const isSendingTypingRef = useRef(false);
    const isFetchingChatsRef = useRef(false);

    const handleTyping = (e) => {
        const text = e.target.value;
        setInput(text);

        if (!socketRef.current || !selectedChatIdRef.current) {
            return;
        }

        const roomStr = selectedChatIdRef.current.toString();

        if (text.length > 0) {
            // Only emit typing_start ONCE when starting to type
            if (!isSendingTypingRef.current) {
                isSendingTypingRef.current = true;
                socketRef.current.emit('typing_start', { chatId: roomStr });
            }

            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

            typingTimeoutRef.current = setTimeout(() => {
                socketRef.current.emit('typing_end', { chatId: roomStr });
                isSendingTypingRef.current = false;
            }, 2000);
        } else {
            socketRef.current.emit('typing_end', { chatId: roomStr });
            isSendingTypingRef.current = false;
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        }
    };



    useEffect(() => {
    useEffect(() => {
        selectedChatIdRef.current = selectedChat?.id;
    }, [selectedChat]);

    useEffect(() => {
        if (!token) return;

        fetchChats();
        fetchQuickReplies();
        fetchVoiceMessages();

        console.log('[SOCKET] Connecting to:', API_URL);

        socketRef.current = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            auth: { token: token },
            query: { token: token },
            extraHeaders: { Authorization: `Bearer ${token}` }
        });

        socketRef.current.on('connect', () => {
            console.log('[SOCKET] Connected with ID:', socketRef.current.id);
            if (selectedChatIdRef.current) {
                const roomStr = selectedChatIdRef.current.toString();
                socketRef.current.emit('join_room', roomStr);
            }
        });

        socketRef.current.on('disconnect', (reason) => {
            console.warn('[SOCKET] Disconnected! Reason:', reason);
        });

        socketRef.current.on('connect_error', (err) => {
            console.error('[SOCKET] Connection Error:', err);
        });

        socketRef.current.on('receive_message', (msg) => {
            if (selectedChatIdRef.current == msg.chat_id) {
                setMessages((prev) => {
                    if (prev.some(m => m.id === msg.id)) return prev;

                    if (msg.tempId) {
                        const optimisticIndex = prev.findIndex(m => m.id === msg.tempId);
                        if (optimisticIndex !== -1) {
                            const newMessages = [...prev];
                            newMessages[optimisticIndex] = msg;
                            return newMessages;
                        }
                    }

                    const optimisticMatchIndex = prev.findIndex(m =>
                        m.is_optimistic && m.content === msg.content && m.sender_id === msg.sender_id && Date.now() - new Date(m.created_at).getTime() < 10000
                    );

                    if (optimisticMatchIndex !== -1) {
                        const newMessages = [...prev];
                        newMessages[optimisticMatchIndex] = msg;
                        return newMessages;
                    }
                    return [...prev, msg];
                });
            }
        });

        socketRef.current.on('admin_notification', (msg) => {
            fetchChats();
        });

        socketRef.current.on('display_typing', (data) => {
            if (selectedChatIdRef.current == data.chatId) {
                setIsTyping(true);
                if (window.adminTypingTimeout) clearTimeout(window.adminTypingTimeout);
                window.adminTypingTimeout = setTimeout(() => setIsTyping(false), 5000);
            }
        });

        socketRef.current.on('hide_typing', (data) => {
            if (selectedChatIdRef.current == data.chatId) {
                setIsTyping(false);
                if (window.adminTypingTimeout) clearTimeout(window.adminTypingTimeout);
            }
        });

        socketRef.current.on('message_error', (err) => {
            alert(`Mesaj gönderilemedi: ${err.message}`);
        });

        return () => {
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleChatListScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollHeight - scrollTop - clientHeight < 100) {
            if (chats.length >= 50 && !isFetchingChatsRef.current) {
                fetchChats(chats.length, true);
            }
        }
    };

    const fetchQuickReplies = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/admin/quick-replies`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setQuickReplies(res.data);
        } catch (err) {
            console.error('Error fetching quick replies:', err);
        }
    };

    const fetchVoiceMessages = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/admin/voice-messages`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setVoiceMessages(res.data);
        } catch (err) {
            console.error('Error fetching voice messages:', err);
        }
    };

    const fetchChats = async (offsetVal = 0, isLoadMore = false) => {
        if (isFetchingChatsRef.current) return;
        isFetchingChatsRef.current = true;
        if (isLoadMore) setLoadingMoreChats(true);
        try {
            const list = chatListRef.current;
            const currentScroll = list ? list.scrollTop : 0;

            const limit = 50;
            const res = await axios.get(`${API_URL}/api/chats/admin?limit=${limit}&offset=${offsetVal}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (isLoadMore) {
                setChats(prev => {
                    const existingIds = new Set(prev.map(c => c.id));
                    const newChats = res.data.filter(c => !existingIds.has(c.id));
                    return [...prev, ...newChats];
                });
            } else {
                setChats(res.data);
            }

            if (list && !isLoadMore) {
                requestAnimationFrame(() => {
                    if (chatListRef.current) {
                        chatListRef.current.scrollTop = currentScroll;
                    }
                });
            }
        } catch (err) {
            console.error('Error fetching chats:', err);
        } finally {
            isFetchingChatsRef.current = false;
            setLoadingMoreChats(false);
        }
    };

    const fetchMessages = async (chat, isLoadMore = false) => {
        if (!isLoadMore) {
            console.log('[Admin] Switching to chat:', chat.id);
            setSelectedChat(chat);
            selectedChatIdRef.current = chat.id;
            setMessages([]); // Clear previous messages
            setIsTyping(false); // Reset typing status on switch
            if (socketRef.current) {
                console.log('[Admin] Joining room:', chat.id);
                socketRef.current.emit('join_room', chat.id.toString());
            }
        }

        try {
            const limit = 50;
            const offset = isLoadMore ? messages.length : 0;

            const res = await axios.get(`${API_URL}/api/messages/${chat.id}?limit=${limit}&offset=${offset}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (isLoadMore) {
                setMessages(prev => [...res.data, ...prev]);
            } else {
                setMessages(res.data);
                await axios.put(`${API_URL}/api/chats/${chat.id}/read`, {
                    userId: chat.operator_id
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setChats(prev => prev.map(c => c.id === chat.id ? { ...c, unread_count: 0 } : c));
            }
        } catch (err) {
            console.error('Error fetching messages:', err);
        }
    };

    const handleLoadMore = () => {
        if (selectedChat) {
            fetchMessages(selectedChat, true);
        }
    };

    const sendTextMessage = (content) => {
        if (!content.trim() || !selectedChat) return;

        // Stop typing immediately
        socketRef.current.emit('typing_end', { chatId: selectedChat.id });
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

        const tempId = Date.now().toString();

        const msgData = {
            chatId: selectedChat.id,
            senderId: selectedChat.operator_id,
            content: content.trim(),
            type: 'text',
            tempId: tempId
        };

        socketRef.current.emit('send_message', msgData);

        const optimisticMsg = {
            id: tempId,
            sender_id: selectedChat.operator_id,
            content: content.trim(),
            chat_id: selectedChat.id,
            created_at: new Date().toISOString(),
            is_optimistic: true,
            tempId: tempId
        };

        setMessages((prev) => [...prev, optimisticMsg]);
        setInput('');
    };

    const sendMessage = (e) => {
        e.preventDefault();
        sendTextMessage(input);
    };

    const sendLocationMessage = () => {
        if (!selectedChat) return;
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((position) => {
                const { latitude, longitude } = position.coords;
                const content = `${latitude},${longitude}`;
                const tempId = Date.now().toString();
                const msgData = {
                    chatId: selectedChat.id,
                    senderId: selectedChat.operator_id,
                    content: content,
                    type: 'location',
                    tempId: tempId
                };
                socketRef.current.emit('send_message', msgData);

                const optimisticMsg = {
                    id: tempId,
                    sender_id: selectedChat.operator_id,
                    content: content,
                    content_type: 'location',
                    chat_id: selectedChat.id,
                    created_at: new Date().toISOString(),
                    is_optimistic: true,
                    tempId: tempId
                };
                setMessages((prev) => [...prev, optimisticMsg]);
            }, (err) => {
                alert('Konum alınamadı: ' + err.message);
return <div />; }; export default Chats;