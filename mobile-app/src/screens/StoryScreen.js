import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { API_URL } from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

export default function StoryScreen({ route, navigation }) {
    const { story, user } = route.params;
    const [progress, setProgress] = useState(0);
    const [liked, setLiked] = useState(story.liked || false);
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 1) return 1;
                return prev + 0.01;
            });
        }, 30); // Approx 3 seconds for a story

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (progress >= 1) {
            navigation.goBack();
        }
    }, [progress]);

    const toggleLike = async () => {
        try {
            const token = user?.token || await AsyncStorage.getItem('token');
            const currentUserId = user?.id || (await AsyncStorage.getItem('user') ? JSON.parse(await AsyncStorage.getItem('user')).id : null);

            if (!currentUserId) return;

            setLiked(!liked);
            await axios.post(`${API_URL}/social/story/like/${story.id}`, {
                user_id: currentUserId
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
        } catch (error) {
            console.error('[Story] Like error:', error);
            setLiked(liked); // Revert
        }
    };

    const handleSendMessage = async () => {
        if (!message.trim() || sending) return;
        setSending(true);

        try {
            const token = user?.token || await AsyncStorage.getItem('token');
            const currentUserId = user?.id || (await AsyncStorage.getItem('user') ? JSON.parse(await AsyncStorage.getItem('user')).id : null);

            if (!currentUserId) return;

            // 1. Create or get chat
            const chatRes = await axios.post(`${API_URL}/chats`, {
                userId: currentUserId,
                operatorId: story.operator_id
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const chatId = chatRes.data?.id;

            if (chatId) {
                // 2. Send the message (story reply)
                // We'll send it via the API for simplicity here, or just via the standard message endpoint
                await axios.post(`${API_URL}/messages`, {
                    chatId: chatId,
                    senderId: currentUserId,
                    content: `Hikayene mesaj gönderdi: ${message}`,
                    type: 'text'
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                setMessage('');
                // Navigate to the chat
                navigation.replace('Chat', {
                    operatorId: story.operator_id,
                    name: story.name,
                    avatar_url: story.avatar,
                    user: user
                });
            }
        } catch (error) {
            console.error('[Story] Message error:', error);
        } finally {
            setSending(false);
        }
    };

    return (
        <View style={styles.container}>
            {/* Story Image */}
            <Image
                source={{ uri: story.image_url || story.avatar }}
                style={styles.storyImage}
            />

            <LinearGradient
                colors={['rgba(0,0,0,0.6)', 'transparent', 'rgba(0,0,0,0.6)']}
                style={styles.gradient}
            />

            {/* Top Bar - Progress and User Info */}
            <View style={styles.topContainer}>
                <View style={styles.progressContainer}>
                    <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
                </View>

                <View style={styles.userHeader}>
                    <Image source={{ uri: story.avatar }} style={styles.avatar} />
                    <Text style={styles.userName}>{story.name}</Text>
                    <Text style={styles.timeAgo}>3s</Text>
                    <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
                        <Ionicons name="close" size={28} color="white" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Bottom Input Area */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.bottomContainer}
            >
                <View style={styles.inputRow}>
                    <TextInput
                        placeholder="Mesaj gönder..."
                        placeholderTextColor="rgba(255,255,255,0.7)"
                        style={styles.input}
                        value={message}
                        onChangeText={setMessage}
                        returnKeyType="send"
                        onSubmitEditing={handleSendMessage}
                    />
                    <TouchableOpacity style={styles.actionIcon} onPress={toggleLike}>
                        <Ionicons name={liked ? "heart" : "heart-outline"} size={28} color={liked ? "#ff4d6d" : "white"} />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
    },
    storyImage: {
        width: width,
        height: height,
        resizeMode: 'cover',
    },
    gradient: {
        ...StyleSheet.absoluteFillObject,
    },
    topContainer: {
        position: 'absolute',
        top: 50,
        left: 0,
        right: 0,
        paddingHorizontal: 15,
    },
    progressContainer: {
        height: 3,
        backgroundColor: 'rgba(255,255,255,0.3)',
        borderRadius: 2,
        overflow: 'hidden',
        marginBottom: 15,
    },
    progressBar: {
        height: '100%',
        backgroundColor: 'white',
    },
    userHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 38,
        height: 38,
        borderRadius: 19,
        marginRight: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    userName: {
        color: 'white',
        fontWeight: '700',
        fontSize: 15,
    },
    timeAgo: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 13,
        marginLeft: 8,
    },
    closeButton: {
        marginLeft: 'auto',
    },
    bottomContainer: {
        position: 'absolute',
        bottom: 40,
        left: 0,
        right: 0,
        paddingHorizontal: 15,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
    },
    input: {
        flex: 1,
        height: 48,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.4)',
        paddingHorizontal: 20,
        color: 'white',
    },
    actionIcon: {
        padding: 5,
    }
});
