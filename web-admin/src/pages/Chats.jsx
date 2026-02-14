import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import io from 'socket.io-client';

import { useAuth } from '../context/AuthContext';

const API_URL = 'https://backend-kj17.onrender.com';

const Chats = () => {
    const { token } = useAuth(); // Get token from Context (Source of Truth)
    const [chats, setChats] = useState([]);
    const [selectedChat, setSelectedChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [isTyping, setIsTyping] = useState(false);
    const [input, setInput] = useState('');
    const [uploading, setUploading] = useState(false);
    const socketRef = useRef(null);
    const messagesEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const fileInputRef = useRef(null);
    const selectedChatIdRef = useRef(null);

    const handleTyping = (e) => {
        const text = e.target.value;
        setInput(text);

        if (!socketRef.current || !selectedChatIdRef.current) {
            console.log('[Admin] Cannot emit typing: Socket or ChatId missing', !!socketRef.current, selectedChatIdRef.current);
            return;
        }

        if (text.length > 0) {
            console.log('[Admin] Emitting typing_start for:', selectedChatIdRef.current);
            socketRef.current.emit('typing_start', { chatId: selectedChatIdRef.current });

            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

            typingTimeoutRef.current = setTimeout(() => {
                console.log('[Admin] Emitting typing_end (timeout) for:', selectedChatIdRef.current);
                socketRef.current.emit('typing_end', { chatId: selectedChatIdRef.current });
            }, 2000);
        } else {
            console.log('[Admin] Emitting typing_end (empty) for:', selectedChatIdRef.current);
            socketRef.current.emit('typing_end', { chatId: selectedChatIdRef.current });
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        }
    };



    useEffect(() => {
        selectedChatIdRef.current = selectedChat?.id;
    }, [selectedChat]);

    useEffect(() => {
        if (!token) return; // Wait for token

        fetchChats();

        console.log('[SOCKET] Connecting to:', API_URL);

        socketRef.current = io(API_URL, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            auth: {
                token: token
            },
            // Fallbacks for different socket.io versions/proxies
            query: {
                token: token
            },
            extraHeaders: {
                Authorization: `Bearer ${token}`
            }
        });

        socketRef.current.on('connect', () => {
            console.log('[SOCKET] Connected with ID:', socketRef.current.id);
            if (selectedChatIdRef.current) {
                console.log('[SOCKET] Re-joining room after reconnect:', selectedChatIdRef.current);
                socketRef.current.emit('join_room', selectedChatIdRef.current);
            }
        });

        socketRef.current.on('disconnect', (reason) => {
            console.warn('[SOCKET] Disconnected! Reason:', reason);
        });

        socketRef.current.on('connect_error', (err) => {
            console.error('[SOCKET] Connection Error:', err);
        });

        socketRef.current.on('receive_message', (msg) => {
            if (selectedChatIdRef.current === msg.chat_id) {
                setMessages((prev) => {
                    if (prev.some(m => m.id === msg.id)) return prev;

                    // Deduplicate using tempId
                    if (msg.tempId) {
                        const optimisticIndex = prev.findIndex(m => m.id === msg.tempId);
                        if (optimisticIndex !== -1) {
                            const newMessages = [...prev];
                            newMessages[optimisticIndex] = msg;
                            return newMessages;
                        }
                    }

                    // Fallback Deduplication (Content + Time)
                    const optimisticMatchIndex = prev.findIndex(m =>
                        m.is_optimistic &&
                        m.content === msg.content &&
                        m.sender_id === msg.sender_id &&
                        Date.now() - new Date(m.created_at).getTime() < 10000
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
            console.log('[SOCKET] Admin Notification Received:', msg);
            fetchChats();
            if (msg.chat_id != selectedChatIdRef.current) {
                // notification logic
            }
        });

        socketRef.current.on('display_typing', (data) => {
            console.log('[SOCKET] display_typing received in Admin:', data, 'Current Selected:', selectedChatIdRef.current);
            if (selectedChatIdRef.current == data.chatId) {
                setIsTyping(true);

                // Safety timeout to clear typing if hide_typing is missed
                if (window.adminTypingTimeout) clearTimeout(window.adminTypingTimeout);
                window.adminTypingTimeout = setTimeout(() => setIsTyping(false), 5000);
            }
        });

        socketRef.current.on('hide_typing', (data) => {
            console.log('[SOCKET] hide_typing received in Admin:', data, 'Current Selected:', selectedChatIdRef.current);
            if (selectedChatIdRef.current == data.chatId) {
                setIsTyping(false);
                if (window.adminTypingTimeout) clearTimeout(window.adminTypingTimeout);
            }
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

    const fetchChats = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/chats/admin`);
            setChats(res.data);
        } catch (err) {
            console.error('Error fetching chats:', err);
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
                socketRef.current.emit('join_room', chat.id);
            }
        }

        try {
            const limit = 50;
            const offset = isLoadMore ? messages.length : 0;

            const res = await axios.get(`${API_URL}/api/messages/${chat.id}?limit=${limit}&offset=${offset}`);

            if (isLoadMore) {
                setMessages(prev => [...res.data, ...prev]);
            } else {
                setMessages(res.data);
                await axios.put(`${API_URL}/api/chats/${chat.id}/read`, {
                    userId: chat.operator_id
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

    const sendMessage = (e) => {
        e.preventDefault();
        if (!input.trim() || !selectedChat) return;

        // Stop typing immediately
        socketRef.current.emit('typing_end', { chatId: selectedChat.id });
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

        const msgData = {
            chatId: selectedChat.id,
            senderId: selectedChat.operator_id,
            content: input,
            type: 'text'
        };

        socketRef.current.emit('send_message', msgData);

        const optimisticMsg = {
            id: Date.now(),
            sender_id: selectedChat.operator_id,
            content: input,
            chat_id: selectedChat.id,
            created_at: new Date().toISOString(),
            is_optimistic: true
        };

        setMessages((prev) => [...prev, optimisticMsg]);
        setInput('');
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !selectedChat) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await axios.post(`${API_URL}/api/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            const imageUrl = res.data.url;

            const msgData = {
                chatId: selectedChat.id,
                senderId: selectedChat.operator_id,
                content: imageUrl,
                type: 'image'
            };

            socketRef.current.emit('send_message', msgData);

            // Optimistic update
            const optimisticMsg = {
                id: Date.now(),
                sender_id: selectedChat.operator_id,
                content: imageUrl,
                content_type: 'image',
                chat_id: selectedChat.id,
                created_at: new Date().toISOString(),
                is_optimistic: true
            };

            setMessages((prev) => [...prev, optimisticMsg]);
        } catch (err) {
            console.error('Image Upload Error:', err);
            alert('Resim yüklenemedi.');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="flex h-[calc(100vh-160px)] bg-slate-950/50 rounded-3xl overflow-hidden border border-white/5 m-8">
            <div className="w-80 border-r border-white/5 flex flex-col bg-slate-900/50">
                <div className="p-6 border-b border-white/5">
                    <h2 className="text-xl font-black text-white">Sohbetler</h2>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {chats.map((chat) => (
                        <button
                            key={chat.id}
                            onClick={() => fetchMessages(chat)}
                            className={`w-full p-5 flex items-center gap-4 hover:bg-white/5 transition-all text-left border-b border-white/5 relative group ${selectedChat?.id === chat.id ? 'bg-fuchsia-600/10 border-r-4 border-r-fuchsia-600' : ''} ${chat.unread_count > 0 ? 'bg-fuchsia-500/20 shadow-[inset_0_0_30px_rgba(217,70,239,0.4)] border-l-4 border-l-fuchsia-500' : ''}`}
                        >
                            <div className="relative">
                                <div className={`w-14 h-14 rounded-2xl overflow-hidden border-2 shadow-2xl transition-all ${chat.unread_count > 0 ? 'border-fuchsia-500 shadow-fuchsia-500/20' : 'border-white/5'}`}>
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
                                        <h3 className={`font-black text-base truncate transition-colors uppercase tracking-tight ${chat.unread_count > 0 ? 'text-fuchsia-400' : 'text-white group-hover:text-fuchsia-400'}`}>
                                            {chat.user_name}
                                        </h3>
                                        <p className={`text-xs truncate font-medium mt-1 ${chat.unread_count > 0 ? 'text-white opacity-90' : 'text-slate-400 opacity-60'}`}>
                                            {chat.last_message || 'Sohbeti başlattı ✨'}
                                        </p>
                                    </div>

                                    <div className="flex flex-col items-end gap-2 ml-2">
                                        <span className="text-[10px] text-slate-500 font-black shrink-0">
                                            {chat.last_message_at ? new Date(chat.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
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
                    ))}
                </div>
            </div>

            <div className="flex-1 flex flex-col bg-slate-950/20">
                {selectedChat ? (
                    <>
                        <div className="p-4 border-b border-white/5 bg-slate-900/40 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/10">
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
                                        <span className="text-white font-bold text-sm">
                                            {selectedChat.user_name?.charAt(0)?.toUpperCase() || '?'}
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <h3 className="font-black text-white">
                                        {selectedChat.user_name} - <span className="text-fuchsia-400 uppercase">{selectedChat.operator_name}</span>
                                    </h3>
                                    <p className="text-[10px] text-green-500 font-black uppercase tracking-widest">Çevrimiçi</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4 relative scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                            {/* Load More Button */}
                            <div className="flex justify-center mb-4">
                                <button
                                    onClick={handleLoadMore}
                                    className="text-xs font-bold text-slate-500 hover:text-white bg-slate-800/50 hover:bg-slate-700 px-4 py-2 rounded-full transition-colors"
                                >
                                    Daha Eski Mesajları Yükle
                                </button>
                            </div>

                            {messages.map((msg, idx) => (
                                <div
                                    key={idx}
                                    className={`flex ${msg.sender_id === selectedChat.operator_id ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div className={`max-w-[70%] space-y-1`}>
                                        {/* Gift Message Styling */}
                                        {(msg.content_type === 'gift' || msg.type === 'gift' || msg.gift_id) ? (
                                            <div className="bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-200 text-amber-900 p-0.5 rounded-2xl shadow-lg shadow-amber-500/20 transform hover:scale-[1.02] transition-transform duration-300">
                                                <div className="bg-gradient-to-br from-amber-50 to-white px-4 py-3 rounded-[14px] flex items-center gap-4 relative overflow-hidden">
                                                    {/* Shiny Effect */}
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
                                                className={`p-4 rounded-2xl text-sm font-medium shadow-sm ${msg.sender_id === selectedChat.operator_id
                                                    ? 'bg-purple-600 text-white rounded-br-none'
                                                    : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'
                                                    }`}
                                            >
                                                {msg.content_type === 'image' || msg.type === 'image' ? (
                                                    <div className="relative group/img">
                                                        <img
                                                            src={msg.content}
                                                            className="max-w-full rounded-lg shadow-2xl border border-white/10 cursor-zoom-in"
                                                            alt="Resim"
                                                            onClick={() => window.open(msg.content, '_blank')}
                                                        />
                                                        <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-all rounded-lg flex items-center justify-center pointer-events-none group-hover/img:pointer-events-auto">
                                                            <svg className="w-8 h-8 text-white opacity-0 group-hover/img:opacity-100 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                                            </svg>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    msg.content
                                                )}
                                            </div>
                                        )}
                                        <p className={`text-[10px] opacity-50 ${msg.sender_id === selectedChat.operator_id ? 'text-right' : 'text-left'}`}>
                                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                            ))}

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

                        <form onSubmit={sendMessage} className="p-6 bg-slate-900/40 border-t border-white/5 flex gap-4 relative">
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleImageUpload}
                            />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className={`p-3 rounded-xl border border-white/10 transition-all hover:bg-white/5 active:scale-95 ${uploading ? 'animate-pulse opacity-50' : ''}`}
                            >
                                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </button>
                            <input
                                type="text"
                                value={input}
                                onChange={handleTyping}
                                placeholder={uploading ? "Resim yükleniyor..." : "Mesajınızı yazın..."}
                                disabled={uploading}
                                className="flex-1 bg-slate-800/50 border border-white/10 rounded-xl px-4 text-sm text-white focus:outline-none focus:border-fuchsia-500 transition-all font-medium disabled:opacity-50"
                            />
                            <button
                                type="submit"
                                disabled={uploading || !input.trim()}
                                className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-fuchsia-600/20 active:scale-95 disabled:opacity-50 disabled:hover:bg-fuchsia-600"
                            >
                                Gönder
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
            </div >
        </div >
    );
};

export default Chats;
