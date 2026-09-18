import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5000'
    : '';
const SOCKET_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5000'
    : window.location.origin;

const formatTime = (dateStr) => {
    if (!dateStr) return '';
    try {
        let str = dateStr.toString().trim();
        // Normalize PostgreSQL timestamp strings (space separator, no timezone = UTC)
        // e.g. "2026-09-16 20:18:00.123" -> "2026-09-16T20:18:00.123Z"
        if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(str)) {
            str = str.replace(' ', 'T') + 'Z';
        }
        const d = new Date(str);
        if (isNaN(d.getTime())) return '';
        // Add 3 hours manually for UTC+3 Turkey
        const localMs = d.getTime() + (3 * 60 * 60 * 1000);
        const local = new Date(localMs);
        const hh = local.getUTCHours().toString().padStart(2, '0');
        const mm = local.getUTCMinutes().toString().padStart(2, '0');
        return `${hh}:${mm}`;
    } catch (e) {
        return '';
    }
};

const getWaitingTime = (chat) => {
    if (!chat) return null;
    const msgTime = chat.last_message_time || chat.last_message_at;
    if (!msgTime) return null;

    const isUserSender = (chat.last_message_sender_id && chat.user_id && chat.last_message_sender_id.toString() === chat.user_id.toString()) || (chat.unread_count > 0);
    
    if (!isUserSender) {
        return null;
    }

    const diffMs = Date.now() - new Date(msgTime).getTime();
    if (isNaN(diffMs) || diffMs < 0) return null;
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return 'Az önce mesaj attı ⚡';
    if (minutes < 60) return `${minutes} dk'dır yanıt bekliyor ⏳`;
    const hours = Math.floor(minutes / 60);
    const remMinutes = minutes % 60;
    if (hours < 24) return `${hours}sa ${remMinutes}dk'dır bekliyor ⏳`;
    const days = Math.floor(hours / 24);
    return `${days} gündür bekliyor ⏳`;
};

const getSmartHints = (chat) => {
    if (!chat) return [];
    const hints = [];

    if (chat.job) {
        hints.push(`mesleğin ${chat.job} yoğunluğu nasıl gidiyor bu aralar`);
    }
    if (chat.age) {
        hints.push(`${chat.age} yaş enerjisi harika görünüyor günün nasıl geçti`);
    }

    const interestsStr = (chat.user_interests || chat.interests || '').toString().toLowerCase();
    if (interestsStr.includes('spor') || interestsStr.includes('fitness')) {
        hints.push(`düzenli spor yapıyor musun en çok hangi sporu seversin`);
    }
    if (interestsStr.includes('müzik') || interestsStr.includes('konser')) {
        hints.push(`en son hangi konsere gittin ya da ne tarz müzikler dinlersin`);
    }
    if (interestsStr.includes('seyahat') || interestsStr.includes('gezi')) {
        hints.push(`gezmeyi seviyorsun sanırım en beğendiğin şehir neresi oldu`);
    }

    const notesStr = (chat.user_notes || '').toLowerCase();
    if (notesStr.includes('ankara')) {
        hints.push(`ankaranın havası nasıl oralarda`);
    } else if (notesStr.includes('istanbul')) {
        hints.push(`istanbul trafiğine takılmadan günü bitirebildin mi`);
    } else if (notesStr.includes('izmir')) {
        hints.push(`izmir havası yine harikadır şimdi`);
    }

    if (hints.length < 3) {
        hints.push(`bugün seni en çok gülümseten şey ne oldu`);
        hints.push(`hafta sonu için eğlenceli bir planın var mı`);
        hints.push(`seni yakından tanımak isterim kendinden biraz bahsetmek ister misin`);
    }

    return hints.slice(0, 3);
};

const Chats = () => {
    const { token, user } = useAuth();
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
    const [userNotes, setUserNotes] = useState('');
    const [savingNotes, setSavingNotes] = useState(false);
    const [notesSavedStatus, setNotesSavedStatus] = useState('');
    const socketRef = useRef(null);
    const messagesEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const fileInputRef = useRef(null);
    const selectedChatIdRef = useRef(null);
    const chatListRef = useRef(null);
    const popupsContainerRef = useRef(null);
    const isSendingTypingRef = useRef(false);
    const isFetchingChatsRef = useRef(false);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (popupsContainerRef.current && !popupsContainerRef.current.contains(event.target)) {
                setShowQuickMessages(false);
                setShowVoiceMessages(false);
                setShowAttachmentMenu(false);
            }
        };

        if (showQuickMessages || showVoiceMessages || showAttachmentMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showQuickMessages, showVoiceMessages, showAttachmentMenu]);

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

    const fetchVoiceMessages = async () => {
        try {
            const localToken = localStorage.getItem('token') || token;
            const res = await axios.get(`${API_URL}/api/admin/voice-messages`, {
                headers: { Authorization: `Bearer ${localToken}` }
            });
            setVoiceMessages(res.data);
        } catch (err) {
            console.error('Error fetching voice messages:', err);
        }
    };

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
            setUserNotes(chat.user_notes || '');
            setNotesSavedStatus('');
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

    const handleSaveNotes = async (userId, notesText) => {
        if (!userId) return;
        setSavingNotes(true);
        setNotesSavedStatus('');
        try {
            const localToken = localStorage.getItem('token') || token;
            await axios.post(`${API_URL}/api/admin/users/${userId}/notes`, { notes: notesText }, {
                headers: { Authorization: `Bearer ${localToken}` }
            });
            setNotesSavedStatus('Kaydedildi ✓');
            setSelectedChat(prev => prev ? { ...prev, user_notes: notesText } : prev);
            setChats(prev => prev.map(c => c.user_id === userId ? { ...c, user_notes: notesText } : c));
            setTimeout(() => setNotesSavedStatus(''), 3000);
        } catch (err) {
            console.error('Error saving notes:', err);
            setNotesSavedStatus('Hata ❌');
        } finally {
            setSavingNotes(false);
        }
    };

    const handleLoadMore = () => {
        if (selectedChat) {
            fetchMessages(selectedChat, true);
        }
    };

    const navigateToNextUnreadChat = (currentChatId) => {
        // Find next chat that has unread count > 0 or where last message was from user
        const nextChat = chats.find(c => {
            if (c.id === currentChatId) return false;
            const isUserSender = (c.last_message_sender_id && c.user_id && c.last_message_sender_id.toString() === c.user_id.toString()) || (c.unread_count > 0);
            return c.unread_count > 0 || isUserSender;
        });

        if (nextChat) {
            fetchMessages(nextChat);
        }
    };

    const sendTextMessage = (content, autoJump = false) => {
        const trimmed = content.trim();
        if (!trimmed || trimmed.length < 10 || !selectedChat) {
            if (trimmed && trimmed.length < 10) {
                alert('Mesaj en az 10 karakter olmalıdır.');
            }
            return;
        }

        const currentChatId = selectedChat.id;

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

        if (autoJump) {
            setTimeout(() => {
                navigateToNextUnreadChat(currentChatId);
            }, 100);
        }
    };

    const sendMessage = (e, autoJump = true) => {
        if (e) e.preventDefault();
        sendTextMessage(input, autoJump);
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
            });
        } else {
            alert('Tarayıcınız konum servisini desteklemiyor.');
        }
    };

    const sendVoiceCallMessage = () => {
        if (!selectedChat) return;
        const tempId = Date.now().toString();
        const content = '📞 Sesli Arama';
        const msgData = {
            chatId: selectedChat.id,
            senderId: selectedChat.operator_id,
            content: content,
            type: 'call_audio',
            tempId: tempId
        };
        socketRef.current.emit('send_message', msgData);

        const optimisticMsg = {
            id: tempId,
            sender_id: selectedChat.operator_id,
            content: content,
            content_type: 'call_audio',
            chat_id: selectedChat.id,
            created_at: new Date().toISOString(),
            is_optimistic: true,
            tempId: tempId
        };
        setMessages((prev) => [...prev, optimisticMsg]);
    };

    const sendVideoCallMessage = () => {
        if (!selectedChat) return;
        const tempId = Date.now().toString();
        const content = '📹 Görüntülü Arama';
        const msgData = {
            chatId: selectedChat.id,
            senderId: selectedChat.operator_id,
            content: content,
            type: 'call_video',
            tempId: tempId
        };
        socketRef.current.emit('send_message', msgData);

        const optimisticMsg = {
            id: tempId,
            sender_id: selectedChat.operator_id,
            content: content,
            content_type: 'call_video',
            chat_id: selectedChat.id,
            created_at: new Date().toISOString(),
            is_optimistic: true,
            tempId: tempId
        };
        setMessages((prev) => [...prev, optimisticMsg]);
    };

    const sendQuickMessage = (message) => {
        sendTextMessage(message);
        setShowQuickMessages(false);
    };

    const sendVoiceMessage = (audioUrl, rawSecs = 0) => {
        if (!selectedChat) return;
        const tempId = Date.now().toString();

        let formattedDuration = '0:00';
        if (typeof rawSecs === 'number' && !isNaN(rawSecs) && rawSecs > 0) {
            const m = Math.floor(rawSecs / 60);
            const s = Math.floor(rawSecs % 60).toString().padStart(2, '0');
            formattedDuration = `${m}:${s}`;
        } else if (typeof rawSecs === 'string' && rawSecs) {
            formattedDuration = rawSecs;
        }

        const msgData = {
            chatId: selectedChat.id,
            senderId: selectedChat.operator_id,
            content: audioUrl,
            type: 'audio',
            tempId: tempId,
            duration: formattedDuration
        };

        socketRef.current.emit('send_message', msgData);

        const optimisticMsg = {
            id: tempId,
            sender_id: selectedChat.operator_id,
            content: audioUrl,
            content_type: 'audio',
            duration: formattedDuration,
            chat_id: selectedChat.id,
            created_at: new Date().toISOString(),
            is_optimistic: true,
            tempId: tempId
        };

        setMessages((prev) => [...prev, optimisticMsg]);
        setShowVoiceMessages(false);
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !selectedChat) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await axios.post(`${API_URL}/api/media-upload`, formData, {
                headers: { 
                    'Content-Type': 'multipart/form-data',
                    Authorization: `Bearer ${token}`
                }
            });

            const fileUrl = res.data.url;
            const tempId = Date.now().toString();

            const isVideo = file.type.startsWith('video/');
            const msgType = isVideo 
                ? (isLockedImage ? 'locked_video' : 'video') 
                : (isLockedImage ? 'locked_image' : 'image');

            const msgData = {
                chatId: selectedChat.id,
                senderId: selectedChat.operator_id,
                content: fileUrl,
                type: msgType,
                unlockCost: isLockedImage ? Number(lockedImageCost) : 0,
                tempId: tempId
            };

            socketRef.current.emit('send_message', msgData);

            // Optimistic update
            const optimisticMsg = {
                id: tempId,
                sender_id: selectedChat.operator_id,
                content: fileUrl,
                content_type: msgType,
                unlock_cost: isLockedImage ? Number(lockedImageCost) : 0,
                is_unlocked: true,
                chat_id: selectedChat.id,
                created_at: new Date().toISOString(),
                is_optimistic: true,
                tempId: tempId
            };

            setMessages((prev) => [...prev, optimisticMsg]);
        } catch (err) {
            console.error('Upload Error:', err);
            alert('Dosya yüklenemedi.');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // Performance Optimization: Memoize the chat list to prevent re-rendering on every keystroke
    const memoizedChatList = React.useMemo(() => {
        return chats.map((chat) => (
            <button
                key={chat.id}
                onClick={() => fetchMessages(chat)}
                className={`w-full p-5 flex items-center gap-4 hover:bg-white/5 transition-all text-left border-b border-white/5 relative group ${selectedChat?.id === chat.id ? 'bg-fuchsia-600/10 border-r-4 border-r-fuchsia-600' : ''} ${chat.unread_count > 0 ? 'bg-fuchsia-500/20 shadow-[inset_0_0_30px_rgba(217,70,239,0.4)] border-l-4 border-l-fuchsia-500' : ''}`}
            >
                <div className="relative">
                    <div className={`w-16 h-16 rounded-2xl overflow-hidden border-2 shadow-2xl transition-all ${chat.unread_count > 0 ? 'border-fuchsia-500 shadow-fuchsia-500/20' : 'border-white/5'}`}>
                        {chat.user_avatar ? (
                            <img
                                src={chat.user_avatar}
                                alt={chat.user_name}
                                className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
                                onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.nextSibling.style.display = 'flex';
                                }}
                            />
                        ) : null}
                        <div
                            className="w-full h-full bg-gradient-to-br from-fuchsia-600 to-purple-600 flex items-center justify-center"
                            style={{ display: chat.user_avatar ? 'none' : 'flex' }}
                        >
                            <span className="text-white font-black text-xl">
                                {chat.user_name?.charAt(0)?.toUpperCase() || '?'}
                            </span>
                        </div>
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-slate-900 shadow-lg"></div>
                </div>

                <div className="flex-1 overflow-hidden">
                    <div className="flex justify-between items-start">
                        <div className="flex flex-col flex-1 min-w-0">
                            <h3 className={`font-black text-lg truncate transition-colors uppercase tracking-tight ${chat.unread_count > 0 ? 'text-fuchsia-400' : 'text-white group-hover:text-fuchsia-400'}`}>
                                {chat.user_name}
                            </h3>
                            <p className={`text-sm truncate font-medium mt-1 ${chat.unread_count > 0 ? 'text-white opacity-90' : 'text-slate-400 opacity-60'}`}>
                                {chat.last_message || 'Sohbeti başlattı ✨'}
                            </p>
                            {getWaitingTime(chat) && (
                                <span className="text-[10px] font-bold text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/30 mt-1 inline-block truncate">
                                    {getWaitingTime(chat)}
                                </span>
                            )}
                        </div>

                        <div className="flex flex-col items-end gap-2 ml-2">
                            <span className="text-[10px] text-slate-500 font-black shrink-0">
                                {formatTime(chat.last_message_at)}
                            </span>
                            {chat.unread_count > 0 && (
                                <div className="bg-fuchsia-600 text-white text-[10px] font-black min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full shadow-lg shadow-fuchsia-600/40">
                                    {chat.unread_count}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </button>
        ));
    }, [chats, selectedChat]);

    // Performance Optimization: Memoize message elements to prevent re-rendering when typing
    const memoizedMessageList = React.useMemo(() => {
        if (!selectedChat) return null;
        return messages.map((msg, idx) => (
            <div
                key={idx}
                className={`flex ${msg.sender_id == selectedChat.operator_id || msg.sender_id == user?.id ? 'justify-end' : 'justify-start'}`}
            >
                <div className={`max-w-[82%] space-y-1`}>
                    {/* Gift Message Styling */}
                    {(msg.content_type === 'gift' || msg.type === 'gift' || msg.gift_id) ? (
                        <div className="bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-200 text-amber-900 p-0.5 rounded-2xl shadow-lg shadow-amber-500/20 transform hover:scale-[1.02] transition-transform duration-300">
                            <div className="bg-gradient-to-br from-amber-50 to-white px-4 py-3 rounded-[14px] flex items-center gap-4 relative overflow-hidden">
                                <div className="absolute top-0 right-0 -mr-4 -mt-4 w-20 h-20 bg-yellow-400/20 blur-2xl rounded-full"></div>
                                <div className="text-4xl filter drop-shadow-md">
                                    {msg.gift_icon ? <img src={msg.gift_icon} className="w-12 h-12 object-contain" alt="Gift" /> : '🎁'}
                                </div>
                                <div>
                                    <p className="min-w-[100px] font-black text-amber-900 text-sm uppercase tracking-wider">{msg.gift_name || msg.content}</p>
                                    <div className="flex items-center gap-1 mt-1">
                                        <span className="bg-amber-100/80 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200/50 shadow-sm">
                                            {msg.gift_cost ? `${msg.gift_cost} COINS` : 'HEDİYE'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="absolute -bottom-1 -right-1">
                                <span className="flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div
                            className={`p-5 rounded-2xl text-[15px] font-medium shadow-sm ${msg.sender_id == selectedChat.operator_id || msg.sender_id == user?.id
                                ? 'bg-purple-600 text-white rounded-br-none'
                                : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'
                                }`}
                        >
                            {msg.content_type === 'location' || msg.type === 'location' ? (
                                <div className="relative group/loc flex flex-col items-center p-2 bg-blue-500/10 rounded-lg border border-blue-500/30 cursor-pointer" onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${msg.content}`, '_blank')}>
                                    <span className="text-3xl mb-1 drop-shadow-md">📍</span>
                                    <span className="text-xs font-bold text-blue-400 underline">Konum Görüntüle</span>
                                </div>
                            ) : msg.content_type === 'audio' || msg.type === 'audio' ? (
                                <div className="flex items-center gap-3 p-1">
                                    <audio src={msg.content} controls className="h-10 max-w-[220px]" />
                                </div>
                            ) : msg.content_type === 'call_audio' || msg.type === 'call_audio' || msg.content?.includes('Sesli Arama') ? (
                                <div className="flex items-center gap-3 p-1 text-emerald-300">
                                    <div className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-emerald-400">Sesli Arama</p>
                                        <p className="text-[11px] opacity-70">Arama başlatıldı</p>
                                    </div>
                                </div>
                            ) : msg.content_type === 'call_video' || msg.type === 'call_video' || msg.content?.includes('Görüntülü Arama') ? (
                                <div className="flex items-center gap-3 p-1 text-indigo-300">
                                    <div className="w-9 h-9 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-indigo-400">Görüntülü Arama</p>
                                        <p className="text-[11px] opacity-70">Arama başlatıldı</p>
                                    </div>
                                </div>
                            ) : msg.content_type === 'image' || msg.content_type === 'locked_image' || msg.type === 'image' || msg.type === 'locked_image' ? (
                                <div className="relative group/img">
                                    <img
                                        src={msg.content}
                                        className={`max-w-full rounded-lg shadow-2xl border border-white/10 cursor-zoom-in ${msg.content_type === 'locked_image' && !msg.is_unlocked && msg.sender_id !== selectedChat.operator_id ? 'blur-md' : ''}`}
                                        alt="Resim"
                                        onClick={() => window.open(msg.content, '_blank')}
                                    />
                                    {msg.content_type === 'locked_image' && (
                                        <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded-full flex items-center gap-1 font-bold">
                                            <span className="text-yellow-400">🔒</span> {msg.unlock_cost || 50} Coin
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-all rounded-lg flex items-center justify-center pointer-events-none group-hover/img:pointer-events-auto">
                                        <svg className="w-8 h-8 text-white opacity-0 group-hover/img:opacity-100 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                        </svg>
                                    </div>
                                </div>
                            ) : msg.content_type === 'video' || msg.content_type === 'locked_video' || msg.type === 'video' || msg.type === 'locked_video' ? (
                                <div className="relative group/vid">
                                    <video
                                        src={msg.content}
                                        controls
                                        className={`max-w-full rounded-lg shadow-2xl border border-white/10 ${msg.content_type === 'locked_video' && !msg.is_unlocked && msg.sender_id != selectedChat.operator_id ? 'blur-md pointer-events-none' : ''}`}
                                    />
                                    {(msg.content_type === 'locked_video' || msg.type === 'locked_video') && (
                                        <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded-full flex items-center gap-1 font-bold">
                                            <span className="text-yellow-400">🔒</span> {msg.unlock_cost || 50} Coin
                                        </div>
                                    )}
                                </div>
                            ) : (
                                msg.content
                            )}
                        </div>
                    )}
                    <p className={`text-[10px] opacity-50 ${msg.sender_id == selectedChat.operator_id || msg.sender_id == user?.id ? 'text-right' : 'text-left'}`}>
                        {formatTime(msg.created_at)}
                    </p>
                </div>
            </div>
        ));
    }, [messages, selectedChat, user?.id]);

    return (
        <div className="flex h-screen bg-slate-950/50 overflow-hidden">
            <div className="w-96 border-r border-white/5 flex flex-col bg-slate-900/50">
                <div className="p-7 border-b border-white/5">
                    <h2 className="text-2xl font-black text-white">Sohbetler</h2>
                </div>
                <div 
                    ref={chatListRef}
                    onScroll={handleChatListScroll}
                    className="flex-1 overflow-y-auto" 
                    style={{ overflowAnchor: 'none' }}
                >
                    {memoizedChatList}
                    {loadingMoreChats && (
                        <div className="p-4 text-center text-xs font-bold text-slate-500 animate-pulse uppercase tracking-widest">
                            Daha fazla sohbet yükleniyor...
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 flex flex-col bg-slate-950/20">
                {selectedChat ? (
                    <>
                        <div className="p-6 border-b border-white/5 bg-slate-900/40 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-white/10">
                                    {selectedChat.user_avatar ? (
                                        <img
                                            src={selectedChat.user_avatar}
                                            className="w-full h-full object-cover"
                                            alt={selectedChat.user_name}
                                            onError={(e) => {
                                                e.target.style.display = 'none';
                                                e.target.nextSibling.style.display = 'flex';
                                            }}
                                        />
                                    ) : null}
                                    <div
                                        className="w-full h-full bg-gradient-to-br from-fuchsia-600 to-purple-600 flex items-center justify-center"
                                        style={{ display: selectedChat.user_avatar ? 'none' : 'flex' }}
                                    >
                                        <span className="text-white font-bold text-lg">
                                            {selectedChat.user_name?.charAt(0)?.toUpperCase() || '?'}
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-lg font-black text-white">
                                            {selectedChat.user_name} - <span className="text-fuchsia-400 uppercase">{selectedChat.operator_name}</span>
                                        </h3>
                                        {/* User Coin Balance Badge */}
                                        <div className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-amber-500/20 to-orange-500/10 border border-amber-500/30 rounded-full">
                                            <span className="text-sm">🪙</span>
                                            <span className="text-amber-400 font-black text-xs">
                                                {selectedChat.user_balance !== undefined && selectedChat.user_balance !== null
                                                    ? Number(selectedChat.user_balance).toLocaleString()
                                                    : '0'}
                                            </span>
                                            <span className="text-amber-600 text-[9px] font-black uppercase">coin</span>
                                        </div>
                                        {/* Wait Time Badge */}
                                        {getWaitingTime(selectedChat) && (
                                            <div className={`flex items-center gap-1.5 px-3 py-1 border rounded-md text-xs font-bold ${
                                                getWaitingTime(selectedChat).includes('sa') || getWaitingTime(selectedChat).includes('gün')
                                                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/30 animate-pulse'
                                                    : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                            }`}>
                                                <span>{getWaitingTime(selectedChat)}</span>
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-green-500 font-black uppercase tracking-widest">Çevrimiçi</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-5 relative scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                            {/* Load More Button */}
                            <div className="flex justify-center mb-4">
                                <button
                                    onClick={handleLoadMore}
                                    className="text-xs font-bold text-slate-500 hover:text-white bg-slate-800/50 hover:bg-slate-700 px-4 py-2 rounded-full transition-colors"
                                >
                                    Daha Eski Mesajları Yükle
                                </button>
                            </div>

                            {memoizedMessageList}

                            {/* Typing Indicator Bubble */}
                            {isTyping && (
                                <div className="flex justify-start">
                                    <div className="bg-slate-800 p-4 rounded-2xl rounded-bl-none border border-slate-700 flex items-center gap-1 w-16 h-10">
                                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
                                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-75"></span>
                                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-150"></span>
                                    </div>
                                </div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>



                        <form ref={popupsContainerRef} onSubmit={sendMessage} className="p-6 bg-slate-900/80 border-t border-white/10 flex items-center gap-4 relative">
                            {/* Quick Messages */}
                            <div className="relative shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setShowQuickMessages((open) => !open)}
                                    disabled={uploading}
                                    title="Hazır Mesajlar"
                                    className="p-4 rounded-2xl border border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-300 hover:bg-fuchsia-500/30 active:scale-95 transition disabled:opacity-50 flex items-center justify-center shadow-lg shadow-fuchsia-500/10"
                                >
                                    <span className="text-xl font-bold">⚡</span>
                                </button>
                                {showQuickMessages && (
                                    <div className="absolute bottom-[calc(100%+14px)] left-0 z-30 w-84 rounded-2xl border border-fuchsia-400/30 bg-slate-900 p-3 shadow-2xl shadow-fuchsia-950/50">
                                        <p className="px-3 py-2 text-xs font-black uppercase tracking-widest text-fuchsia-300 border-b border-white/5 mb-1">Hazır mesajlar</p>
                                        {quickReplies.length > 0 ? quickReplies.map((qr) => (
                                            <button key={qr.id} type="button" onClick={() => { setShowQuickMessages(false); sendQuickMessage(qr.content); }} className="block w-full rounded-xl px-4 py-3 text-left text-sm font-medium text-slate-200 transition hover:bg-fuchsia-500/20 hover:text-white">
                                                {qr.content}
                                            </button>
                                        )) : (
                                            <p className="px-3 py-2 text-xs text-slate-400">Henüz hazır mesaj yok.</p>
                                        )}
                                        
                                        {(user?.role === 'admin' || user?.role === 'super_admin') && (
                                            <div className="border-t border-white/10 mt-1 pt-1">
                                                <Link to="/quick-replies" onClick={() => setShowQuickMessages(false)} className="block w-full rounded-xl px-4 py-3 text-center text-sm font-bold text-fuchsia-400 transition hover:bg-fuchsia-500/10">
                                                    Mesajları Düzenle
                                                </Link>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Voice Messages */}
                            <div className="relative shrink-0">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!showVoiceMessages) {
                                            fetchVoiceMessages();
                                        }
                                        setShowVoiceMessages(!showVoiceMessages);
                                    }}
                                    disabled={uploading}
                                    title="Sesli Mesajlar"
                                    className="p-4 rounded-2xl border border-indigo-400/40 bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/30 active:scale-95 transition disabled:opacity-50 flex items-center justify-center shadow-lg shadow-indigo-500/10"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                    </svg>
                                </button>
                                {showVoiceMessages && (
                                    <div className="absolute bottom-[calc(100%+14px)] left-0 z-30 w-84 rounded-2xl border border-indigo-400/30 bg-slate-900 p-3 shadow-2xl shadow-indigo-950/50">
                                        <p className="px-3 py-2 text-xs font-black uppercase tracking-widest text-indigo-300 border-b border-white/5 mb-1">Sesli mesajlar</p>
                                        {voiceMessages.length > 0 ? voiceMessages.map((vm) => (
                                            <div key={vm.id} className="flex flex-col gap-2 rounded-xl p-3 border border-white/5 mb-2 hover:bg-indigo-500/10 transition">
                                                <p className="text-sm font-medium text-slate-200">{vm.title}</p>
                                                <div className="flex items-center gap-3">
                                                    <audio id={`voice-audio-${vm.id}`} src={vm.audio_url} controls className="h-8 max-w-[180px]" />
                                                    <button 
                                                        onClick={() => {
                                                            const audioEl = document.getElementById(`voice-audio-${vm.id}`);
                                                            const sec = audioEl ? audioEl.duration : 0;
                                                            sendVoiceMessage(vm.audio_url, sec);
                                                        }} 
                                                        className="flex-1 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white py-1.5 text-xs font-bold transition"
                                                    >
                                                        Gönder
                                                    </button>
                                                </div>
                                            </div>
                                        )) : (
                                            <p className="px-3 py-2 text-xs text-slate-400">Henüz sesli mesaj yok.</p>
                                        )}
                                        
                                        {(user?.role === 'admin' || user?.role === 'super_admin') && (
                                            <div className="border-t border-white/10 mt-1 pt-1">
                                                <Link to="/voice-messages" onClick={() => setShowVoiceMessages(false)} className="block w-full rounded-xl px-4 py-3 text-center text-sm font-bold text-indigo-400 transition hover:bg-indigo-500/10">
                                                    Sesleri Yönet
                                                </Link>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Attachment Menu Button */}
                            <div className="relative shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setShowAttachmentMenu((open) => !open)}
                                    disabled={uploading}
                                    title="Eklentiler"
                                    className={`p-4 rounded-2xl border transition-all active:scale-95 flex items-center justify-center shadow-md ${showAttachmentMenu ? 'bg-slate-700 text-white border-slate-600' : 'bg-slate-800/50 border-white/10 text-slate-300 hover:text-white hover:bg-white/10'} ${uploading ? 'animate-pulse opacity-50' : ''}`}
                                >
                                    <svg className={`w-6 h-6 transition-transform ${showAttachmentMenu ? 'rotate-45' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                    </svg>
                                </button>
                                
                                {/* Hidden Image Input */}
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*,video/*"
                                    onChange={handleImageUpload}
                                />

                                {showAttachmentMenu && (
                                    <div className="absolute bottom-[calc(100%+14px)] left-0 z-30 w-60 rounded-2xl border border-white/10 bg-slate-900 p-2 shadow-2xl flex flex-col gap-1">
                                        <button
                                            type="button"
                                            onClick={() => { setShowAttachmentMenu(false); sendLocationMessage(); }}
                                            className="flex items-center gap-3 w-full rounded-xl px-4 py-3 text-left text-sm font-medium text-slate-200 transition hover:bg-slate-800"
                                        >
                                            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                            Konum Gönder
                                        </button>
                                        
                                        <button
                                            type="button"
                                            onClick={() => { setShowAttachmentMenu(false); sendVoiceCallMessage(); }}
                                            className="flex items-center gap-3 w-full rounded-xl px-4 py-3 text-left text-sm font-medium text-slate-200 transition hover:bg-emerald-500/10 hover:text-emerald-400"
                                        >
                                            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                            </svg>
                                            Sesli Arama
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => { setShowAttachmentMenu(false); sendVideoCallMessage(); }}
                                            className="flex items-center gap-3 w-full rounded-xl px-4 py-3 text-left text-sm font-medium text-slate-200 transition hover:bg-indigo-500/10 hover:text-indigo-400"
                                        >
                                            <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                            </svg>
                                            Görüntülü Arama
                                        </button>

                                        <div className="h-px bg-white/10 my-1"></div>

                                        <button
                                            type="button"
                                            onClick={() => { setShowAttachmentMenu(false); fileInputRef.current?.click(); }}
                                            className="flex items-center gap-3 w-full rounded-xl px-4 py-3 text-left text-sm font-medium text-slate-200 transition hover:bg-slate-800"
                                        >
                                            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            Medya Gönder
                                        </button>

                                        <label className="flex items-center gap-3 w-full rounded-xl px-4 py-3 text-left text-sm font-medium text-slate-200 transition hover:bg-amber-500/10 cursor-pointer select-none">
                                            <input 
                                                type="checkbox" 
                                                checked={isLockedImage}
                                                onChange={(e) => setIsLockedImage(e.target.checked)}
                                                className="w-4 h-4 rounded bg-slate-900 border-white/30 text-amber-500 focus:ring-amber-500/50 cursor-pointer"
                                            />
                                            <span className={`${isLockedImage ? 'text-amber-400 font-bold' : ''}`}>
                                                🔒 Medyayı Ücretli Yap
                                            </span>
                                        </label>
                                    </div>
                                )}
                            </div>

                            {/* Text Input */}
                            <input
                                type="text"
                                value={input}
                                onChange={handleTyping}
                                placeholder={uploading ? "Resim yükleniyor..." : "Mesajınızı yazın..."}
                                disabled={uploading}
                                className="flex-1 bg-slate-800/70 border border-white/15 rounded-2xl px-6 py-4 text-base text-white placeholder:text-slate-400 focus:outline-none focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500/20 transition-all font-medium disabled:opacity-50 shadow-inner"
                            />

                            {/* Send Button */}
                            <button
                                type="submit"
                                disabled={uploading || input.trim().length < 10}
                                className="bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-xl shadow-fuchsia-600/30 active:scale-95 disabled:opacity-50 flex items-center gap-2 shrink-0 cursor-pointer"
                            >
                                <span>Gönder & Sonraki Mesaja Geç</span>
                                <span>➔</span>
                            </button>
                        </form>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-4">
                        <div className="w-20 h-20 rounded-full bg-slate-900 flex items-center justify-center">
                            <svg className="w-10 h-10 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                        </div>
                        <p className="font-black uppercase tracking-widest text-xs">Sohbet seçilmedi</p>
                    </div>
                )}
            </div>

            {/* Right Sidebar - User Notes */}
            {selectedChat && (
                <div className="w-96 border-l border-white/5 bg-slate-900/60 p-5 flex flex-col shrink-0">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
                        <div className="flex items-center gap-2">
                            <span className="text-2xl">📝</span>
                            <h4 className="text-lg font-black text-white">Notlar</h4>
                        </div>
                        {notesSavedStatus && (
                            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 rounded-md animate-pulse">
                                {notesSavedStatus}
                            </span>
                        )}
                    </div>

                    {/* User Info Card */}
                    <div className="mb-4 p-3.5 bg-slate-950/60 border border-white/10 rounded-md flex items-center gap-3">
                        <div className="w-11 h-11 rounded-md bg-gradient-to-br from-fuchsia-600 to-purple-600 flex items-center justify-center text-white font-bold text-base shrink-0">
                            {selectedChat.user_name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-base font-bold text-white truncate">{selectedChat.user_name}</p>
                            <p className="text-xs text-slate-400 truncate">
                                {selectedChat.age ? `${selectedChat.age} Yaş` : ''} {selectedChat.job ? `• ${selectedChat.job}` : ''}
                            </p>
                        </div>
                    </div>

                    {/* Notes Textarea */}
                    <div className="flex-1 flex flex-col gap-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                            Kullanıcıya Özel Notlar
                        </label>
                        <textarea
                            value={userNotes}
                            onChange={(e) => setUserNotes(e.target.value)}
                            placeholder="Örn: Bu kişi Ankara'da yaşıyor, yazılım mühendisi..."
                            className="w-full flex-1 bg-slate-950 border border-white/15 rounded-md p-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500/30 transition-all resize-none font-medium leading-relaxed"
                        />
                    </div>

                    {/* Save Button */}
                    <button
                        onClick={() => handleSaveNotes(selectedChat.user_id, userNotes)}
                        disabled={savingNotes}
                        className="mt-4 w-full py-4 bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 active:scale-95 text-white font-bold text-sm uppercase tracking-wider rounded-md shadow-lg shadow-fuchsia-600/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                    >
                        {savingNotes ? 'Kaydediliyor...' : '💾 Notu Kaydet'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default Chats;
