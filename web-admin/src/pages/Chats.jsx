import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import io from 'socket.io-client';

const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'https://backend-kj17.onrender.com'
    : '';

const Chats = () => {
    const [chats, setChats] = useState([]);
    const [selectedChat, setSelectedChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const socketRef = useRef(null);
    const messagesEndRef = useRef(null);
    const selectedChatIdRef = useRef(null);

    useEffect(() => {
        fetchChats();

        // Connect Socket ONCE
        socketRef.current = io(API_URL);

        socketRef.current.on('receive_message', (msg) => {
            // Only update messages if it belongs to the active chat
            if (selectedChatIdRef.current === msg.chat_id) {
                setMessages((prev) => {
                    // 1. Check if exact ID already exists (deduplication)
                    if (prev.some(m => m.id === msg.id)) return prev;

                    // 2. Check if we have a matching optimistic message (same content, sender, and recent)
                    // If we find one, REPLACE it with the real message
                    const optimisticMatchIndex = prev.findIndex(m =>
                        m.is_optimistic &&
                        m.content === msg.content &&
                        m.sender_id === msg.sender_id &&
                        Date.now() - new Date(m.created_at).getTime() < 10000 // generated within last 10s
                    );

                    if (optimisticMatchIndex !== -1) {
                        const newMessages = [...prev];
                        newMessages[optimisticMatchIndex] = msg;
                        return newMessages;
                    }

                    // 3. Otherwise add new message
                    return [...prev, msg];
                });
            }
            fetchChats();
        });

        return () => {
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const fetchChats = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/chats/admin`);
            console.log('[DEBUG] Admin Chats Data:', res.data);
            setChats(res.data);
        } catch (err) {
            console.error('Error fetching chats:', err);
        }
    };

    const fetchMessages = async (chat) => {
        setSelectedChat(chat);
        selectedChatIdRef.current = chat.id;

        if (socketRef.current) {
            socketRef.current.emit('join_room', chat.id);
        }

        try {
            const res = await axios.get(`${API_URL}/api/messages/${chat.id}`);
            setMessages(res.data);

            // Mark as read for the admin (sender_id = user_id should be read)
            await axios.put(`${API_URL}/api/chats/${chat.id}/read`, {
                userId: chat.operator_id
            });

            // Local update to clear badge
            setChats(prev => prev.map(c => c.id === chat.id ? { ...c, unread_count: 0 } : c));
        } catch (err) {
            console.error('Error fetching messages:', err);
        }
    };

    const sendMessage = (e) => {
        e.preventDefault();
        if (!input.trim() || !selectedChat) return;

        const msgData = {
            chatId: selectedChat.id,
            senderId: selectedChat.operator_id,
            content: input,
            type: 'text'
        };

        socketRef.current.emit('send_message', msgData);

        // Optimistic update
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

    return (
        <div className="flex h-[calc(100vh-160px)] bg-slate-950/50 rounded-3xl overflow-hidden border border-white/5 m-8">
            {/* Chat List */}
            <div className="w-80 border-r border-white/5 flex flex-col bg-slate-900/50">
                <div className="p-6 border-b border-white/5">
                    <h2 className="text-xl font-black text-white">Sohbetler</h2>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {chats.map((chat) => (
                        <button
                            key={chat.id}
                            onClick={() => fetchMessages(chat)}
                            className={`w-full p-5 flex items-center gap-4 hover:bg-white/5 transition-all text-left border-b border-white/5 relative group 
                                ${selectedChat?.id === chat.id ? 'bg-fuchsia-600/10 border-r-4 border-r-fuchsia-600' : ''}
                                ${chat.unread_count > 0 ? 'bg-fuchsia-500/10 shadow-[inset_0_0_20px_rgba(217,70,239,0.1)]' : ''}`}
                        >
                            <div className="relative">
                                <div className={`w-14 h-14 rounded-2xl overflow-hidden border-2 shadow-2xl transition-all
                                    ${chat.unread_count > 0 ? 'border-fuchsia-500 shadow-fuchsia-500/20' : 'border-white/5'}`}>
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
                                        <h3 className={`font-black text-base truncate transition-colors uppercase tracking-tight
                                            ${chat.unread_count > 0 ? 'text-fuchsia-400' : 'text-white group-hover:text-fuchsia-400'}`}>
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

            {/* Conversation Area */}
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

                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {messages.map((msg, idx) => (
                                <div
                                    key={idx}
                                    className={`flex ${msg.sender_id === selectedChat.operator_id ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-[70%] p-4 rounded-2xl ${msg.sender_id === selectedChat.operator_id
                                            ? 'bg-fuchsia-600 text-white rounded-tr-none'
                                            : 'bg-slate-800 text-slate-200 rounded-tl-none'
                                            }`}
                                    >
                                        <p className="text-sm leading-relaxed">{msg.content}</p>
                                        <span className="text-[9px] opacity-50 mt-2 block font-bold">
                                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        <form onSubmit={sendMessage} className="p-6 bg-slate-900/40 border-t border-white/5 flex gap-4">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Mesajınızı yazın..."
                                className="flex-1 bg-slate-800/50 border border-white/10 rounded-xl px-4 text-sm text-white focus:outline-none focus:border-fuchsia-500 transition-all font-medium"
                            />
                            <button
                                type="submit"
                                className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-fuchsia-600/20 active:scale-95"
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
            </div>
        </div>
    );
};

export default Chats;
