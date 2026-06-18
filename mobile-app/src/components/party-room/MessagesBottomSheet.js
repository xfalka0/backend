import React, { useState, useEffect } from 'react';
import {
    Modal, View, Text, StyleSheet, TouchableOpacity,
    FlatList, Image, TextInput, Dimensions, ActivityIndicator,
    KeyboardAvoidingView, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../../config';
import { useChat } from '../../contexts/ChatContext';

const { width, height } = Dimensions.get('window');

export default function MessagesBottomSheet({ 
    visible, 
    currentUser, 
    onClose, 
    navigation,
    initialActiveChatUser,
    clearInitialActiveChatUser
}) {
    const { socket } = useChat();
    const [chats, setChats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState('');

    // Chat Conversation States
    const [activeChat, setActiveChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [msgLoading, setMsgLoading] = useState(false);
    const [messageText, setMessageText] = useState('');

    // Fetch Chat List
    useEffect(() => {
        if (visible && currentUser?.id && !activeChat && !initialActiveChatUser) {
            fetchChats();
        }
    }, [visible, currentUser?.id, activeChat, initialActiveChatUser]);

    // Handle initial active chat user navigation directly inside the bottom sheet
    useEffect(() => {
        if (visible && initialActiveChatUser && currentUser?.id) {
            const checkOrCreateChat = async () => {
                try {
                    setLoading(true);
                    const token = await AsyncStorage.getItem('token');
                    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
                    
                    const targetUserId = initialActiveChatUser.user_id || initialActiveChatUser.id;
                    const chatRes = await axios.post(`${API_URL}/chats`, {
                        userId: currentUser.id,
                        operatorId: targetUserId
                    }, authHeader);
                    
                    const chatObj = {
                        id: chatRes.data.id,
                        name: initialActiveChatUser.display_name || initialActiveChatUser.username,
                        avatar_url: initialActiveChatUser.avatar_url,
                        operator_id: targetUserId,
                        user_id: currentUser.id
                    };
                    setActiveChat(chatObj);
                    clearInitialActiveChatUser();
                } catch (err) {
                    console.error('[MessagesBottomSheet] checkOrCreateChat error:', err);
                } finally {
                    setLoading(false);
                }
            };
            checkOrCreateChat();
        }
    }, [visible, initialActiveChatUser, currentUser?.id]);

    // Clear active chat when closed
    useEffect(() => {
        if (!visible) {
            setActiveChat(null);
        }
    }, [visible]);

    const fetchChats = async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('token');
            const res = await axios.get(`${API_URL}/users/${currentUser.id}/chats?limit=30&offset=0`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setChats(res.data || []);
        } catch (error) {
            console.error('[MessagesBottomSheet] Error fetching chats:', error.message);
        } finally {
            setLoading(false);
        }
    };

    // Load messages and bind sockets for active chat
    useEffect(() => {
        if (!activeChat || !visible) return;

        let active = true;

        const loadMessages = async () => {
            try {
                setMsgLoading(true);
                const token = await AsyncStorage.getItem('token');
                const authHeader = { headers: { Authorization: `Bearer ${token}` } };
                
                // Fetch messages
                const res = await axios.get(`${API_URL}/messages/${activeChat.id}`, authHeader);
                if (active) {
                    setMessages(res.data.reverse()); // FlatList is inverted, so newest messages go to the bottom
                }
                
                // Mark as read
                await axios.put(`${API_URL}/chats/${activeChat.id}/read`, { userId: currentUser.id }, authHeader);
            } catch (err) {
                console.error('[MessagesBottomSheet] Load messages error:', err);
            } finally {
                if (active) setMsgLoading(false);
            }
        };

        loadMessages();

        // Bind socket room joining and listening
        if (socket) {
            socket.emit('join_room', activeChat.id.toString());

            const handleReceiveMessage = (msg) => {
                if (msg.chat_id && msg.chat_id.toString() === activeChat.id.toString()) {
                    setMessages(prev => {
                        const exists = prev.some(m => m.id === msg.id);
                        if (exists) return prev;
                        return [msg, ...prev];
                    });
                }
            };

            socket.on('receive_message', handleReceiveMessage);

            return () => {
                active = false;
                socket.emit('leave_room', activeChat.id.toString());
                socket.off('receive_message', handleReceiveMessage);
            };
        }

        return () => {
            active = false;
        };
    }, [activeChat, visible, socket]);

    const handleSendMessage = () => {
        if (!messageText.trim() || !activeChat || !socket) return;

        const textToSend = messageText.trim();
        const tempId = Date.now().toString();

        const optimisticMsg = {
            id: tempId,
            chat_id: activeChat.id,
            sender_id: currentUser.id,
            content: textToSend,
            type: 'text',
            created_at: new Date().toISOString(),
            is_optimistic: true
        };

        setMessages(prev => [optimisticMsg, ...prev]);
        setMessageText('');

        const msgData = {
            chatId: activeChat.id,
            senderId: currentUser.id,
            content: textToSend,
            type: 'text',
            tempId: tempId
        };

        socket.emit('send_message', msgData);
    };

    const filteredChats = React.useMemo(() => {
        if (!searchText) return chats;
        return chats.filter(chat => 
            chat.name?.toLowerCase().includes(searchText.toLowerCase())
        );
    }, [chats, searchText]);

    const formatLastMessage = (msg, type) => {
        if (!msg) return 'Sohbet Başladı 💬';
        if (msg.startsWith('http')) {
            if (msg.includes('image') || msg.includes('cloudinary') || msg.match(/\.(jpg|jpeg|png|webp|gif)/i)) {
                return '📷 Fotoğraf';
            }
            if (msg.includes('audio') || msg.match(/\.(m4a|mp3|wav|ogg)/i)) {
                return '🎤 Ses Mesajı';
            }
        }
        if (type === 'image') return '📷 Fotoğraf';
        if (type === 'audio') return '🎤 Ses Mesajı';
        if (type === 'gift') return '🎁 Hediye';
        return msg;
    };

    const renderChatItem = ({ item }) => {
        const hasUnread = item.unread_count > 0;
        const initials = (item.name || 'S').charAt(0).toUpperCase();

        return (
            <TouchableOpacity
                style={styles.chatRow}
                onPress={() => {
                    setActiveChat(item);
                }}
            >
                {item.avatar_url ? (
                    <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
                ) : (
                    <LinearGradient
                        colors={['#7B2CFF', '#FF4D8D']}
                        style={styles.avatarPlaceholder}
                    >
                        <Text style={styles.avatarInitials}>{initials}</Text>
                    </LinearGradient>
                )}

                <View style={styles.chatInfo}>
                    <View style={styles.nameRow}>
                        <Text style={styles.nameText} numberOfLines={1}>
                            {item.name}
                        </Text>
                        {item.last_message_at && (
                            <Text style={styles.timeText}>
                                {new Date(item.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                        )}
                    </View>
                    <View style={styles.messageRow}>
                        <Text style={[styles.lastMsgText, hasUnread && styles.lastMsgUnread]} numberOfLines={1}>
                            {formatLastMessage(item.last_message, item.last_message_type)}
                        </Text>
                        {hasUnread && (
                            <View style={styles.unreadBadge}>
                                <Text style={styles.unreadText}>{item.unread_count}</Text>
                            </View>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const renderMessageItem = ({ item }) => {
        const isMe = item.sender_id === currentUser?.id;
        return (
            <View style={[styles.msgWrapper, isMe ? styles.msgWrapperMe : styles.msgWrapperOther]}>
                <View style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleOther]}>
                    <Text style={styles.msgText}>{item.content}</Text>
                </View>
                <Text style={styles.msgTime}>
                    {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
            </View>
        );
    };

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
            <View style={styles.backdrop}>
                <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
                <KeyboardAvoidingView 
                    style={styles.sheet} 
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <View style={styles.handle} />
                    
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            {activeChat && (
                                <TouchableOpacity style={styles.backBtn} onPress={() => setActiveChat(null)}>
                                    <Ionicons name="chevron-back" size={24} color="#FFF" />
                                </TouchableOpacity>
                            )}
                            <Text style={styles.title}>{activeChat ? activeChat.name : 'Mesajlar'}</Text>
                        </View>
                        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                            <Ionicons name="close" size={20} color="#FFF" />
                        </TouchableOpacity>
                    </View>

                    {activeChat ? (
                        /* Chat Conversation Detail View */
                        <View style={{ flex: 1 }}>
                            {msgLoading ? (
                                <View style={styles.loaderContainer}>
                                    <ActivityIndicator size="small" color="#FF4D8D" />
                                </View>
                            ) : (
                                <FlatList
                                    inverted
                                    data={messages}
                                    keyExtractor={item => item.id?.toString() || Math.random().toString()}
                                    renderItem={renderMessageItem}
                                    contentContainerStyle={styles.messagesListContent}
                                    showsVerticalScrollIndicator={false}
                                />
                            )}
                            
                            {/* Input Bar */}
                            <View style={styles.inputBar}>
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="Bir şeyler yaz..."
                                    placeholderTextColor="rgba(255,255,255,0.4)"
                                    value={messageText}
                                    onChangeText={setMessageText}
                                    onSubmitEditing={handleSendMessage}
                                />
                                <TouchableOpacity 
                                    style={styles.sendIconBtn} 
                                    onPress={handleSendMessage}
                                    disabled={!messageText.trim()}
                                >
                                    <Ionicons 
                                        name="send" 
                                        size={18} 
                                        color={messageText.trim() ? '#FF4D8D' : 'rgba(255,255,255,0.2)'} 
                                    />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        /* Conversation List View */
                        <View style={{ flex: 1 }}>
                            {/* Search */}
                            <View style={styles.searchBar}>
                                <Ionicons name="search" size={16} color="rgba(255, 255, 255, 0.4)" style={styles.searchIcon} />
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Sohbetlerde ara..."
                                    placeholderTextColor="rgba(255, 255, 255, 0.4)"
                                    value={searchText}
                                    onChangeText={setSearchText}
                                />
                            </View>

                            {loading ? (
                                <View style={styles.loaderContainer}>
                                    <ActivityIndicator size="small" color="#FF4D8D" />
                                </View>
                            ) : (
                                <FlatList
                                    data={filteredChats}
                                    keyExtractor={item => item.id?.toString() || Math.random().toString()}
                                    renderItem={renderChatItem}
                                    contentContainerStyle={styles.listContent}
                                    ListEmptyComponent={
                                        <View style={styles.emptyState}>
                                            <Ionicons name="chatbubbles-outline" size={40} color="rgba(255,255,255,0.15)" />
                                            <Text style={styles.emptyStateText}>
                                                {searchText ? 'Aramayla eşleşen sohbet yok.' : 'Henüz mesajınız bulunmuyor.'}
                                            </Text>
                                        </View>
                                    }
                                />
                            )}
                        </View>
                    )}
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(7, 4, 18, 0.65)',
        justifyContent: 'flex-end',
    },
    sheet: {
        width: '100%',
        height: height * 0.65,
        backgroundColor: '#100720',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        paddingTop: 8,
    },
    handle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignSelf: 'center',
        marginBottom: 12,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 12,
    },
    backBtn: {
        marginRight: 8,
    },
    title: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    closeBtn: {
        padding: 4,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderRadius: 12,
        marginHorizontal: 20,
        marginBottom: 12,
        paddingHorizontal: 10,
        borderWidth: 0.5,
        borderColor: 'rgba(255, 255, 255, 0.06)',
    },
    searchIcon: {
        marginRight: 6,
    },
    searchInput: {
        flex: 1,
        color: '#FFF',
        fontSize: 12,
        paddingVertical: 8,
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 34,
    },
    chatRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 0.5,
        borderBottomColor: 'rgba(255,255,255,0.05)',
        gap: 12,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    avatarPlaceholder: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarInitials: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    chatInfo: {
        flex: 1,
        justifyContent: 'center',
        gap: 2.5,
    },
    nameRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    nameText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
        flex: 1,
        marginRight: 8,
    },
    timeText: {
        color: 'rgba(255,255,255,0.35)',
        fontSize: 9.5,
    },
    messageRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    lastMsgText: {
        color: 'rgba(255,255,255,0.45)',
        fontSize: 11.5,
        flex: 1,
        marginRight: 8,
    },
    lastMsgUnread: {
        color: '#FFF',
        fontWeight: '600',
    },
    unreadBadge: {
        backgroundColor: '#FF4D8D',
        borderRadius: 9,
        minWidth: 16,
        height: 16,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    unreadText: {
        color: '#FFF',
        fontSize: 8.5,
        fontWeight: '900',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 50,
        gap: 10,
    },
    emptyStateText: {
        color: 'rgba(255,255,255,0.3)',
        fontSize: 12,
    },

    // Conversation Detail Styles
    messagesListContent: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    msgWrapper: {
        marginBottom: 12,
        alignItems: 'flex-start',
        maxWidth: '80%',
    },
    msgWrapperMe: {
        alignSelf: 'flex-end',
        alignItems: 'flex-end',
    },
    msgWrapperOther: {
        alignSelf: 'flex-start',
        alignItems: 'flex-start',
    },
    msgBubble: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 16,
    },
    msgBubbleMe: {
        backgroundColor: '#FF4D8D',
        borderTopRightRadius: 4,
    },
    msgBubbleOther: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderTopLeftRadius: 4,
        borderWidth: 0.5,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    msgText: {
        color: '#FFF',
        fontSize: 13,
        lineHeight: 18,
    },
    msgTime: {
        color: 'rgba(255,255,255,0.35)',
        fontSize: 9,
        marginTop: 4,
    },
    inputBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderTopWidth: 0.5,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        backgroundColor: 'rgba(255,255,255,0.02)',
    },
    textInput: {
        flex: 1,
        height: 38,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 19,
        paddingHorizontal: 16,
        color: '#FFF',
        fontSize: 13,
        marginRight: 10,
        borderWidth: 0.5,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    sendIconBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
