const fs = require('fs');
const filepath = 'd:/dating/backend/web-admin/src/pages/Chats.jsx';
const txt = fs.readFileSync(filepath, 'utf8');
const lines = txt.split('\n');

const toInject = `    useEffect(() => {
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
            extraHeaders: { Authorization: \`Bearer \${token}\` }
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
            alert(\`Mesaj gönderilemedi: \${err.message}\`);
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
`;

// Replace lines 70 to 71 with toInject
lines.splice(70, 2, ...toInject.split('\n'));
fs.writeFileSync(filepath, lines.join('\n'));
console.log('Fixed Chats.jsx');
