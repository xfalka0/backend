import React, { useState, useEffect, useRef } from 'react';
import { 
    StyleSheet, View, Text, TouchableOpacity, Image, Dimensions, 
    Platform, PermissionsAndroid, ActivityIndicator, Alert 
} from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withRepeat,
    withSpring,
    interpolate,
    withSequence,
    Easing
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_URL } from '../config';
import { useChat } from '../contexts/ChatContext';
import { useAppStore } from '../store/useAppStore';
import { resolveImageUrl } from '../utils/imageUtils';

const { width, height } = Dimensions.get('window');

// ─── Crash-safe Agora Dynamic Import ─────────────────────────────────────────
let AgoraRTC = null;
try {
    AgoraRTC = require('react-native-agora');
} catch (e) {
    console.warn('[Agora] Native module not linked. Using mock mode.');
}

const WaveformBar = ({ index }) => {
    const heightVal = useSharedValue(10);

    useEffect(() => {
        const delay = index * 80;
        const timeoutId = setTimeout(() => {
            heightVal.value = withRepeat(
                withSequence(
                    withTiming(30 + Math.random() * 50, { duration: 350, easing: Easing.inOut(Easing.ease) }),
                    withTiming(10 + Math.random() * 15, { duration: 350, easing: Easing.inOut(Easing.ease) })
                ),
                -1,
                true
            );
        }, delay);
        return () => clearTimeout(timeoutId);
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        height: heightVal.value,
    }));

    return <Animated.View style={[styles.bar, animatedStyle]} />;
};

export default function VoiceCallScreen({ route, navigation }) {
    const { receiver, isIncoming: initialIsIncoming, chatId: routeChatId, rtcToken: initialRtcToken, channelName: initialChannelName, callId: initialCallId } = route.params || {};
    const otherUser = receiver || {};
    const otherUserName = otherUser.name || otherUser.display_name || otherUser.username || 'Fiva Kullanıcısı';
    const otherUserImage = resolveImageUrl(otherUser.avatar_url || otherUser.avatar);

    const { socket } = useChat();
    const role = useAppStore(state => state.role);
    const isOperator = role === 'operator';
    const activeCallChatId = useAppStore(state => state.activeCallChatId);

    // Call ID tracking to prevent collisions
    const callIdRef = useRef(initialCallId || `call_${Date.now()}_${Math.random().toString(36).substring(7)}`);

    // Call States: 'outgoing' | 'incoming' | 'active' | 'ended'
    const [callState, setCallState] = useState(initialIsIncoming ? 'incoming' : 'outgoing');
    const [duration, setDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [isSpeaker, setIsSpeaker] = useState(true);
    const [statusText, setStatusText] = useState(initialIsIncoming ? 'Gelen Arama...' : 'Aranıyor...');

    // Refs
    const agoraEngineRef = useRef(null);
    const soundRef = useRef(null);
    const timerIntervalRef = useRef(null);
    const isJoinedRef = useRef(false);
    
    // We reuse routeChatId or fall back to activeCallChatId
    const chatId = routeChatId || activeCallChatId;

    // Animations
    const overlayOpacity = useSharedValue(0);
    const scale = useSharedValue(0.9);
    const ringScale = useSharedValue(1);

    // Intercept back navigation / Android back button to ensure proper cleanup
    useEffect(() => {
        const unsubscribeBeforeRemove = navigation.addListener('beforeRemove', (e) => {
            // Allow navigation to proceed if call is already ended
            if (callState === 'ended') {
                return;
            }

            // Prevent default behavior
            e.preventDefault();

            // Run appropriate hangup sequence
            if (callState === 'incoming') {
                handleDecline();
            } else if (callState === 'outgoing') {
                handleCancel();
            } else if (callState === 'active') {
                handleHangup();
            }
        });

        return unsubscribeBeforeRemove;
    }, [navigation, callState]);

    const handleSocketDisconnect = () => {
        console.log('[SOCKET] Connection lost. Ending call.');
        handleHangupTransition('Bağlantı Kesildi');
    };

    const handleSocketCallConnected = () => {
        console.log('[SOCKET] Both users connected. Call active.');
        setStatusText('Bağlandı');
        startTimer();
    };

    useEffect(() => {
        overlayOpacity.value = withTiming(1, { duration: 500 });
        scale.value = withSpring(1, { damping: 15 });
        ringScale.value = withRepeat(withTiming(1.6, { duration: 1800 }), -1, false);

        // Keep track of call state in AppStore
        if (chatId) {
            useAppStore.getState().setActiveCallChatId(chatId);
        }

        // Initialize Call Lifecycle
        handleCallInit();

        // Register Call Socket Listeners
        if (socket) {
            socket.on('disconnect', handleSocketDisconnect);
            socket.on('call_connected', handleSocketCallConnected);
            socket.on('call_started', handleSocketCallStarted);
            socket.on('call_ended', handleSocketCallEnded);
            socket.on('call_rejected', handleSocketCallRejected);
            socket.on('call_cancelled', handleSocketCallCancelled);
            socket.on('call_busy', handleSocketCallBusy);
            socket.on('call_error', handleSocketCallError);
        }

        return () => {
            // Clean up socket listeners
            if (socket) {
                socket.off('disconnect', handleSocketDisconnect);
                socket.off('call_connected', handleSocketCallConnected);
                socket.off('call_started', handleSocketCallStarted);
                socket.off('call_ended', handleSocketCallEnded);
                socket.off('call_rejected', handleSocketCallRejected);
                socket.off('call_cancelled', handleSocketCallCancelled);
                socket.off('call_busy', handleSocketCallBusy);
                socket.off('call_error', handleSocketCallError);
            }
            cleanupAudio();
            cleanupAgora();
            stopTimer();
            useAppStore.getState().setActiveCallChatId(null);
        };
    }, []);

    // ─── Call Timer ──────────────────────────────────────────────────────────
    const startTimer = () => {
        stopTimer();
        timerIntervalRef.current = setInterval(() => {
            setDuration(prev => prev + 1);
        }, 1000);
    };

    const stopTimer = () => {
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }
    };

    const formatDuration = (sec) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    // ─── Audio Ringtone Player ────────────────────────────────────────────────
    const playSound = async (type) => {
        try {
            await cleanupAudio();

            const url = type === 'ringtone' 
                ? 'https://www.soundjay.com/phone/telephone-ring-03a.mp3'
                : 'https://www.soundjay.com/phone/phone-calling-1.mp3';

            await Audio.setAudioModeAsync({
                playsInSilentModeIOS: true,
                allowsRecordingIOS: true,
                staysActiveInBackground: true,
            });

            const { sound } = await Audio.Sound.createAsync(
                { uri: url },
                { shouldPlay: true, isLooping: true, volume: 0.8 }
            );
            soundRef.current = sound;
        } catch (err) {
            console.warn('[VoiceCall] Error playing sound:', err.message);
        }
    };

    const cleanupAudio = async () => {
        if (soundRef.current) {
            try {
                await soundRef.current.stopAsync();
                await soundRef.current.unloadAsync();
            } catch (e) {}
            soundRef.current = null;
        }
    };

    // ─── Agora Engine Lifecycle ──────────────────────────────────────────────
    const requestMicPermission = async () => {
        if (Platform.OS === 'android') {
            try {
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
                    {
                        title: 'Mikrofon İzni',
                        message: 'Sesli arama için mikrofon izni gereklidir.',
                        buttonPositive: 'İzin Ver',
                        buttonNegative: 'İptal',
                    }
                );
                return granted === PermissionsAndroid.RESULTS.GRANTED;
            } catch (err) {
                console.warn('[Mic Permission] error:', err);
                return false;
            }
        }
        return true;
    };

    const initAgora = async (token, channelName) => {
        if (!AgoraRTC) {
            console.log('[Agora] Mock Mode: Joining simulated channel.');
            isJoinedRef.current = true;
            if (socket) {
                socket.emit('call_connected', { chatId });
            }
            return;
        }

        try {
            const hasPermission = await requestMicPermission();
            if (!hasPermission) {
                Alert.alert('Hata', 'Mikrofon izni verilmediği için arama gerçekleştirilemiyor.');
                handleDecline();
                return;
            }

            const engine = await AgoraRTC.createAgoraRtcEngine();
            agoraEngineRef.current = engine;

            // Initialize App
            const appId = 'f80faf42fd0845a9816658ea7e16a755';
            await engine.initialize({ appId });

            // Set Communication Profile for 1-to-1 Calls
            await engine.setChannelProfile(AgoraRTC.ChannelProfileType.ChannelProfileCommunication);

            // Register Event Handlers
            engine.registerEventHandler({
                onJoinChannelSuccess: (connection, elapsed) => {
                    console.log('[Agora] Joined channel success:', connection.channelId);
                    isJoinedRef.current = true;
                    if (socket) {
                        socket.emit('call_connected', { chatId });
                    }
                },
                onUserOffline: (connection, remoteUid, reason) => {
                    console.log('[Agora] Remote user went offline:', remoteUid);
                    handleHangup();
                },
                onError: (err, msg) => {
                    console.warn('[Agora] Engine error:', err, msg);
                }
            });

            await engine.enableAudio();
            await engine.setEnableSpeakerphone(isSpeaker);

            // Join Channel
            const myUid = Number(useAppStore.getState().user?.id) || 0;
            console.log(`[Agora] Joining channel ${channelName} with UID ${myUid}`);
            await engine.joinChannel(token, channelName, myUid, {
                channelProfile: AgoraRTC.ChannelProfileType.ChannelProfileCommunication,
                clientRoleType: AgoraRTC.ClientRoleType.ClientRoleBroadcaster,
                publishMicrophoneTrack: !isMuted,
                autoSubscribeAudio: true,
            });

        } catch (err) {
            console.error('[Agora Init Error]:', err.message);
        }
    };

    const cleanupAgora = async () => {
        if (agoraEngineRef.current) {
            try {
                if (isJoinedRef.current) {
                    await agoraEngineRef.current.leaveChannel();
                }
                await agoraEngineRef.current.release();
            } catch (err) {
                console.warn('[Agora Cleanup Error]:', err.message);
            }
            agoraEngineRef.current = null;
            isJoinedRef.current = false;
        }
    };

    // Toggle Mic Muted
    const handleToggleMute = async () => {
        if (!agoraEngineRef.current) {
            setIsMuted(prev => !prev);
            return;
        }
        try {
            const nextMuteState = !isMuted;
            await agoraEngineRef.current.muteLocalAudioStream(nextMuteState);
            setIsMuted(nextMuteState);
        } catch (err) {
            console.warn('[Agora Mute] Error:', err.message);
        }
    };

    // Toggle Speakerphone
    const handleToggleSpeaker = async () => {
        if (!agoraEngineRef.current) {
            setIsSpeaker(prev => !prev);
            return;
        }
        try {
            const nextSpeakerState = !isSpeaker;
            await agoraEngineRef.current.setEnableSpeakerphone(nextSpeakerState);
            setIsSpeaker(nextSpeakerState);
        } catch (err) {
            console.warn('[Agora Speaker] Error:', err.message);
        }
    };

    // ─── Call Signaling Flows ───────────────────────────────────────────────
    const handleCallInit = async () => {
        if (callState === 'incoming') {
            // Incoming Call: play ringtone, wait for accept
            await playSound('ringtone');
        } else {
            // Outgoing Call: check balance, request token, emit call_request, play dialback tone
            await playSound('dialtone');
            try {
                const token = await AsyncStorage.getItem('token');
                const callId = callIdRef.current;
                const res = await axios.post(`${API_URL}/chats/${chatId}/rtc-token`, { callId }, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                const { token: rtcToken, channelName } = res.data;

                if (socket) {
                    socket.emit('call_request', {
                        chatId,
                        receiverId: otherUser.id,
                        callerName: useAppStore.getState().user?.display_name || 'Bir Kullanıcı',
                        callerAvatar: useAppStore.getState().user?.avatar_url,
                        rtcToken,
                        channelName,
                        callId
                    });
                }
            } catch (err) {
                console.error('[VoiceCall Init] Error:', err.message);
                setStatusText('Arama başarısız.');
                setTimeout(() => navigation.goBack(), 2000);
            }
        }
    };

    // Socket Event: Call Request Ringing
    const handleSocketCallStarted = async () => {
        console.log('[SOCKET] Call Started Event Received');
        await cleanupAudio();
        setCallState('active');
        setStatusText('Bağlanıyor...');

        // Fetch token and join channel
        try {
            const token = await AsyncStorage.getItem('token');
            const callId = callIdRef.current;
            const res = await axios.post(`${API_URL}/chats/${chatId}/rtc-token`, { callId }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const { token: rtcToken, channelName } = res.data;
            await initAgora(rtcToken, channelName);
        } catch (err) {
            console.error('[Agora Start Call] Error:', err.message);
        }
    };

    const handleSocketCallEnded = (data) => {
        console.log('[SOCKET] Call Ended Event Received:', data);
        handleHangupTransition(data.reason === 'insufficient_funds' ? 'Yetersiz Bakiye. Arama Sonlandı.' : 'Arama Sonlandı.');
    };

    const handleSocketCallRejected = () => {
        console.log('[SOCKET] Call Rejected Event Received');
        handleHangupTransition('Arama Reddedildi');
    };

    const handleSocketCallCancelled = () => {
        console.log('[SOCKET] Call Cancelled Event Received');
        handleHangupTransition('Arama İptal Edildi');
    };

    const handleSocketCallBusy = () => {
        console.log('[SOCKET] Call Busy Event Received');
        handleHangupTransition('Meşgul');
    };

    const handleSocketCallError = (data) => {
        console.log('[SOCKET] Call Error Event Received:', data);
        handleHangupTransition(data.message || 'Hata Oluştu');
    };

    // ─── Button Press Actions ────────────────────────────────────────────────
    
    // Caller cancels outgoing call before answer
    const handleCancel = () => {
        if (socket) {
            socket.emit('call_cancel', { chatId, receiverId: otherUser.id });
        }
        handleHangupTransition('Çağrı İptal Edildi');
    };

    // Receiver declines incoming call
    const handleDecline = () => {
        if (socket) {
            socket.emit('call_reject', { chatId, callerId: otherUser.id });
        }
        handleHangupTransition('Çağrı Reddedildi');
    };

    // Receiver accepts incoming call
    const handleAccept = async () => {
        await cleanupAudio();
        setCallState('active');
        setStatusText('Bağlanıyor...');
        
        try {
            const token = await AsyncStorage.getItem('token');
            const callId = callIdRef.current;
            const res = await axios.post(`${API_URL}/chats/${chatId}/rtc-token`, { callId }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            const { token: rtcToken, channelName } = res.data;
            
            if (socket) {
                socket.emit('call_accept', { chatId, callerId: otherUser.id });
            }

            await initAgora(rtcToken, channelName);
        } catch (err) {
            console.error('[Accept Call API] Error:', err.message);
            handleDecline();
        }
    };

    // Either party hangs up ongoing active call
    const handleHangup = () => {
        if (socket) {
            socket.emit('call_end', { chatId });
        }
        handleHangupTransition('Kapatılıyor...');
    };

    const handleHangupTransition = async (statusLabel) => {
        stopTimer();
        await cleanupAudio();
        await cleanupAgora();
        setCallState('ended');
        setStatusText(statusLabel);
        setTimeout(() => {
            navigation.goBack();
        }, 1800);
    };

    // Animated Ringing Styles
    const ringStyle = useAnimatedStyle(() => ({
        transform: [{ scale: ringScale.value }],
        opacity: interpolate(ringScale.value, [1, 1.6], [0.5, 0]),
    }));

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: overlayOpacity.value,
        transform: [{ scale: scale.value }],
    }));

    // ─── Rendering Helper ─────────────────────────────────────────────────────
    const renderControls = () => {
        if (callState === 'incoming') {
            return (
                <View style={styles.controlsRow}>
                    <TouchableOpacity onPress={handleDecline} style={styles.controlBtnWrapper} activeOpacity={0.8}>
                        <View style={[styles.circleBtn, styles.declineBg]}>
                            <Ionicons name="call" size={28} color="white" style={{ transform: [{ rotate: '135deg' }] }} />
                        </View>
                        <Text style={styles.controlBtnText}>Reddet</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleAccept} style={styles.controlBtnWrapper} activeOpacity={0.8}>
                        <View style={[styles.circleBtn, styles.acceptBg]}>
                            <Ionicons name="call" size={28} color="white" />
                        </View>
                        <Text style={styles.controlBtnText}>Kabul Et</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        if (callState === 'outgoing') {
            return (
                <View style={styles.controlsRow}>
                    <TouchableOpacity onPress={handleCancel} style={styles.controlBtnWrapper} activeOpacity={0.8}>
                        <View style={[styles.circleBtn, styles.declineBg]}>
                            <Ionicons name="call" size={28} color="white" style={{ transform: [{ rotate: '135deg' }] }} />
                        </View>
                        <Text style={styles.controlBtnText}>İptal</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        if (callState === 'active') {
            return (
                <View style={styles.controlsRowActive}>
                    {/* Mute Button */}
                    <TouchableOpacity onPress={handleToggleMute} style={styles.controlBtnWrapper} activeOpacity={0.8}>
                        <View style={[styles.circleBtnSmall, isMuted && styles.activeIndicator]}>
                            <Ionicons name={isMuted ? "mic-off" : "mic"} size={22} color="white" />
                        </View>
                        <Text style={styles.controlBtnTextSmall}>Sessiz</Text>
                    </TouchableOpacity>

                    {/* End Call Button */}
                    <TouchableOpacity onPress={handleHangup} style={styles.controlBtnWrapper} activeOpacity={0.8}>
                        <View style={[styles.circleBtn, styles.declineBg]}>
                            <Ionicons name="call" size={28} color="white" style={{ transform: [{ rotate: '135deg' }] }} />
                        </View>
                        <Text style={styles.controlBtnText}>Kapat</Text>
                    </TouchableOpacity>

                    {/* Speakerphone Button */}
                    <TouchableOpacity onPress={handleToggleSpeaker} style={styles.controlBtnWrapper} activeOpacity={0.8}>
                        <View style={[styles.circleBtnSmall, isSpeaker && styles.activeIndicator]}>
                            <Ionicons name="volume-high" size={22} color="white" />
                        </View>
                        <Text style={styles.controlBtnTextSmall}>Hoparlör</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return <ActivityIndicator size="large" color="#EC4899" />;
    };

    return (
        <View style={styles.container}>
            {/* Blurred Background with other user avatar */}
            <Image source={{ uri: otherUserImage }} style={StyleSheet.absoluteFill} blurRadius={22} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(9, 2, 26, 0.88)' }]} />

            <Animated.View style={[styles.content, animatedStyle]}>
                
                {/* Caller Information */}
                <View style={styles.callerInfoContainer}>
                    <View style={styles.avatarWrapper}>
                        {callState !== 'active' && callState !== 'ended' && (
                            <Animated.View style={[styles.ring, ringStyle]} />
                        )}
                        <View style={styles.avatarBorder}>
                            <Image source={{ uri: otherUserImage }} style={styles.avatar} />
                        </View>
                    </View>
                    <Text style={styles.callerName}>{otherUserName}</Text>
                    <Text style={styles.statusLabel}>{statusText}</Text>
                    {callState === 'active' && (
                        <Text style={styles.durationLabel}>{formatDuration(duration)}</Text>
                    )}
                </View>

                {/* Waveform/Visual Section */}
                <View style={styles.waveformContainer}>
                    {callState === 'active' && (
                        <View style={styles.waveform}>
                            {[...Array(15)].map((_, i) => (
                                <WaveformBar key={i} index={i} />
                            ))}
                        </View>
                    )}
                    {callState === 'outgoing' && !isOperator && (
                        <View style={styles.priceTipCard}>
                            <Ionicons name="cash-outline" size={16} color="#fbbf24" style={{ marginRight: 6 }} />
                            <Text style={styles.priceTipText}>Arama Ücreti: 50 Coin/Dk</Text>
                        </View>
                    )}
                </View>

                {/* Control Action Buttons */}
                <View style={styles.controlsContainer}>
                    {renderControls()}
                </View>

            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#09021a',
    },
    content: {
        flex: 1,
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: height * 0.1,
    },
    callerInfoContainer: {
        alignItems: 'center',
        marginTop: 40,
    },
    avatarWrapper: {
        width: 140,
        height: 140,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    avatarBorder: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 4,
        borderColor: 'rgba(236, 72, 153, 0.45)',
        overflow: 'hidden',
        zIndex: 2,
    },
    avatar: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    ring: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 2,
        borderColor: '#EC4899',
        zIndex: 1,
    },
    callerName: {
        fontSize: 28,
        fontWeight: '900',
        color: 'white',
        letterSpacing: 0.5,
        textShadowColor: 'rgba(0, 0, 0, 0.35)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    statusLabel: {
        fontSize: 15,
        color: 'rgba(255, 255, 255, 0.65)',
        marginTop: 10,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    durationLabel: {
        fontSize: 20,
        fontWeight: '900',
        color: '#EC4899',
        marginTop: 15,
        letterSpacing: 1,
    },
    waveformContainer: {
        height: 120,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
    },
    waveform: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 80,
        gap: 5,
    },
    bar: {
        width: 4,
        backgroundColor: '#8B5CF6',
        borderRadius: 2,
    },
    priceTipCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(251, 191, 36, 0.15)',
        borderColor: 'rgba(251, 191, 36, 0.3)',
        borderWidth: 1,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
    },
    priceTipText: {
        color: '#fbbf24',
        fontSize: 13,
        fontWeight: '700',
    },
    controlsContainer: {
        width: '100%',
        paddingHorizontal: 40,
        marginBottom: 20,
    },
    controlsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        width: '100%',
    },
    controlsRowActive: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
    },
    controlBtnWrapper: {
        alignItems: 'center',
    },
    circleBtn: {
        width: 70,
        height: 70,
        borderRadius: 35,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 8,
    },
    circleBtnSmall: {
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        borderColor: 'rgba(255, 255, 255, 0.15)',
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    declineBg: {
        backgroundColor: '#EF4444',
    },
    acceptBg: {
        backgroundColor: '#10B981',
    },
    activeIndicator: {
        backgroundColor: '#EC4899',
        borderColor: '#EC4899',
    },
    controlBtnText: {
        color: 'white',
        marginTop: 10,
        fontSize: 13,
        fontWeight: '700',
    },
    controlBtnTextSmall: {
        color: 'rgba(255, 255, 255, 0.65)',
        marginTop: 8,
        fontSize: 12,
        fontWeight: '600',
    }
});
