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
let RtcSurfaceView = null;
let ChannelProfileType = {};
let ClientRoleType = {};
try {
    AgoraRTC = require('react-native-agora');
    RtcSurfaceView = AgoraRTC.RtcSurfaceView;
    ChannelProfileType = AgoraRTC.ChannelProfileType;
    ClientRoleType = AgoraRTC.ClientRoleType;
} catch (e) {
    console.warn('[Agora Video] Native module not loaded. Mock mode active.');
}

export default function VideoCallScreen({ route, navigation }) {
    const { receiver, isIncoming: initialIsIncoming, chatId: routeChatId, rtcToken: initialRtcToken, channelName: initialChannelName, callId: initialCallId } = route.params || {};
    const otherUser = receiver || {};
    const otherUserName = otherUser.name || otherUser.display_name || otherUser.username || 'Fiva Kullanıcısı';
    const otherUserImage = resolveImageUrl(otherUser.avatar_url || otherUser.avatar);

    const { socket } = useChat();
    const role = useAppStore(state => state.role);
    const activeCallChatId = useAppStore(state => state.activeCallChatId);

    // Call ID tracking to prevent collisions
    const callIdRef = useRef(initialCallId || `call_${Date.now()}_${Math.random().toString(36).substring(7)}`);

    // States: 'outgoing' | 'incoming' | 'active' | 'ended'
    const [callState, setCallState] = useState(initialIsIncoming ? 'incoming' : 'outgoing');
    const [duration, setDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOn, setIsCameraOn] = useState(true);
    const [isSpeaker, setIsSpeaker] = useState(true);
    const [statusText, setStatusText] = useState(initialIsIncoming ? 'Gelen Görüntülü Arama...' : 'Aranıyor...');
    const [remoteUid, setRemoteUid] = useState(null);
    const [isRemoteVideoOn, setIsRemoteVideoOn] = useState(true);

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

    // Intercept back navigation / Android back button to ensure proper cleanup
    useEffect(() => {
        const unsubscribeBeforeRemove = navigation.addListener('beforeRemove', (e) => {
            if (callState === 'ended') return;

            e.preventDefault();

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
        const mins = Math.floor(sec / 60);
        const secs = sec % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    // ─── Sound Playback Helpers ──────────────────────────────────────────────
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
            console.warn('[VideoCall] Error playing sound:', err.message);
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
    const requestPermissions = async () => {
        if (Platform.OS === 'android') {
            try {
                const permissions = [
                    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
                    PermissionsAndroid.PERMISSIONS.CAMERA
                ];
                const granted = await PermissionsAndroid.requestMultiple(permissions);
                
                const micGranted = granted[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
                const camGranted = granted[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED;
                
                return micGranted && camGranted;
            } catch (err) {
                console.warn('[Mic/Cam Permission] error:', err);
                return false;
            }
        }
        return true;
    };

    const initAgora = async (token, channelName) => {
        if (!AgoraRTC) {
            console.log('[Agora Video] Mock Mode: Joining simulated video channel.');
            isJoinedRef.current = true;
            if (socket) {
                socket.emit('call_connected', { chatId });
            }
            return;
        }

        try {
            const hasPermission = await requestPermissions();
            if (!hasPermission) {
                Alert.alert('Hata', 'Mikrofon ve kamera izinleri verilmediği için görüntülü arama gerçekleştirilemiyor.');
                handleDecline();
                return;
            }

            console.log("VIDEO_AGORA_INIT");
            const engine = await AgoraRTC.createAgoraRtcEngine();
            agoraEngineRef.current = engine;

            // Initialize App
            const appId = 'f80faf42fd0845a9816658ea7e16a755';
            await engine.initialize({ appId });

            // Set Communication Profile for 1-to-1 Calls
            await engine.setChannelProfile(ChannelProfileType.ChannelProfileCommunication);

            // Enable Audio & Video
            await engine.enableAudio();
            await engine.enableVideo();
            await engine.startPreview();
            await engine.setEnableSpeakerphone(isSpeaker);

            // Register Event Handlers
            engine.registerEventHandler({
                onJoinChannelSuccess: (connection, elapsed) => {
                    console.log("VIDEO_AGORA_JOIN_SUCCESS", { channelName: connection.channelId, uid: connection.localUid });
                    isJoinedRef.current = true;
                    if (socket) {
                        socket.emit('call_connected', { chatId });
                    }
                },
                onUserJoined: (connection, remoteUid, elapsed) => {
                    console.log("REMOTE_USER_JOINED", remoteUid);
                    setRemoteUid(remoteUid);
                },
                onUserOffline: (connection, remoteUid, reason) => {
                    console.log('[Agora] Remote user went offline:', remoteUid);
                    handleHangup();
                },
                onRemoteVideoStateChanged: (connection, uid, state, reason, elapsed) => {
                    console.log("REMOTE_VIDEO_STATE_CHANGED", { uid, state, reason });
                    // state 0 = REMOTE_VIDEO_STATE_STOPPED, 2 = REMOTE_VIDEO_STATE_DECODING (active)
                    if (state === 0) {
                        setIsRemoteVideoOn(false);
                    } else if (state === 2) {
                        setIsRemoteVideoOn(true);
                    }
                },
                onError: (err, msg) => {
                    console.warn('[Agora] Engine error:', err, msg);
                }
            });

            // Join Channel
            const myUid = Number(useAppStore.getState().user?.id) || 0;
            console.log("VIDEO_JOIN_CHANNEL_CALLED", { channelName, uid: myUid });
            await engine.joinChannel(token, channelName, myUid, {
                channelProfile: ChannelProfileType.ChannelProfileCommunication,
                clientRoleType: ClientRoleType.ClientRoleBroadcaster,
                publishMicrophoneTrack: !isMuted,
                publishCameraTrack: isCameraOn,
                autoSubscribeAudio: true,
                autoSubscribeVideo: true,
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

    // Toggle Camera On/Off
    const handleToggleCamera = async () => {
        try {
            const nextCameraState = !isCameraOn;
            setIsCameraOn(nextCameraState);
            
            if (agoraEngineRef.current) {
                await agoraEngineRef.current.muteLocalVideoStream(!nextCameraState);
                await agoraEngineRef.current.updateChannelMediaOptions({
                    publishCameraTrack: nextCameraState,
                    publishMicrophoneTrack: !isMuted,
                });
            }
        } catch (err) {
            console.warn('[Agora Camera Toggle] Error:', err.message);
        }
    };

    // Switch Front/Rear Camera
    const handleSwitchCamera = async () => {
        if (agoraEngineRef.current) {
            try {
                await agoraEngineRef.current.switchCamera();
            } catch (err) {
                console.warn('[Agora Switch Camera] Error:', err.message);
            }
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
            await playSound('ringtone');
        } else {
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
                        callId,
                        callType: 'video' // Video Call Request flag
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
        setStatusText(statusLabel);
        setCallState('ended');
        
        // Wait 1.5 seconds to show ended status before exiting screen
        setTimeout(async () => {
            await cleanupAgora();
            navigation.goBack();
        }, 15000 / 10); // 1.5 seconds
    };

    // ─── Render UI Helper styles ─────────────────────────────────────────────
    const animatedContentStyle = useAnimatedStyle(() => ({
        opacity: overlayOpacity.value,
        transform: [{ scale: scale.value }],
    }));

    return (
        <View style={styles.container}>
            {/* Background Stream View */}
            {callState === 'active' && remoteUid && isRemoteVideoOn && RtcSurfaceView ? (
                <RtcSurfaceView 
                    canvas={{ uid: remoteUid }}
                    style={StyleSheet.absoluteFill}
                />
            ) : (
                // Falling back to avatar representation if not connected or remote video is off
                <View style={styles.fallbackRemoteContainer}>
                    <Image source={{ uri: otherUserImage }} style={StyleSheet.absoluteFill} blurRadius={10} />
                    <BlurView intensity={40} style={StyleSheet.absoluteFill} tint="dark" />
                    
                    <View style={styles.avatarWrap}>
                        <Image source={{ uri: otherUserImage }} style={styles.fallbackAvatar} />
                        <ActivityIndicator color="#10B981" size="large" style={styles.avatarLoader} />
                    </View>
                    
                    {!isRemoteVideoOn && callState === 'active' && (
                        <Text style={styles.cameraOffLabel}>Kamera Kapalı</Text>
                    )}
                </View>
            )}

            {/* Local Preview Sub-Window */}
            {callState === 'active' && isCameraOn && RtcSurfaceView && (
                <View style={styles.localVideoContainer}>
                    <RtcSurfaceView 
                        canvas={{ uid: 0 }}
                        style={styles.localVideo}
                    />
                </View>
            )}

            {/* Foreground Controls Layer */}
            <Animated.View style={[styles.overlay, animatedContentStyle]} pointerEvents="box-none">
                
                {/* Upper caller details panel */}
                <View style={styles.headerPanel}>
                    <Text style={styles.nameLabel}>{otherUserName}</Text>
                    <Text style={styles.statusLabel}>
                        {callState === 'active' ? formatDuration(duration) : statusText}
                    </Text>
                    <Text style={styles.priceLabel}>120 Coin / Dakika</Text>
                </View>

                {/* Incoming Ringing Controls */}
                {callState === 'incoming' && (
                    <View style={styles.incomingControlsWrap}>
                        <TouchableOpacity onPress={handleDecline} style={[styles.controlBtn, styles.declineBtn]}>
                            <Ionicons name="close" size={32} color="white" />
                        </TouchableOpacity>
                        
                        <TouchableOpacity onPress={handleAccept} style={[styles.controlBtn, styles.acceptBtn]}>
                            <Ionicons name="videocam" size={32} color="white" />
                        </TouchableOpacity>
                    </View>
                )}

                {/* Outgoing Calling Controls */}
                {callState === 'outgoing' && (
                    <View style={styles.incomingControlsWrap}>
                        <TouchableOpacity onPress={handleCancel} style={[styles.controlBtn, styles.declineBtn]}>
                            <Ionicons name="close" size={32} color="white" />
                        </TouchableOpacity>
                    </View>
                )}

                {/* Active Video Call Controls */}
                {callState === 'active' && (
                    <BlurView intensity={25} tint="dark" style={styles.activeControlsContainer}>
                        {/* Mic toggler */}
                        <TouchableOpacity onPress={handleToggleMute} style={[styles.activeBtn, isMuted && styles.activeBtnToggled]}>
                            <Ionicons 
                                name={isMuted ? "mic-off-outline" : "mic-outline"} 
                                size={26} 
                                color={isMuted ? "#EF4444" : "white"} 
                            />
                        </TouchableOpacity>

                        {/* Speaker toggler */}
                        <TouchableOpacity onPress={handleToggleSpeaker} style={[styles.activeBtn, !isSpeaker && styles.activeBtnToggled]}>
                            <Ionicons 
                                name={isSpeaker ? "volume-high-outline" : "volume-mute-outline"} 
                                size={26} 
                                color="white" 
                            />
                        </TouchableOpacity>

                        {/* Camera toggler */}
                        <TouchableOpacity onPress={handleToggleCamera} style={[styles.activeBtn, !isCameraOn && styles.activeBtnToggled]}>
                            <Ionicons 
                                name={isCameraOn ? "videocam-outline" : "videocam-off-outline"} 
                                size={26} 
                                color={!isCameraOn ? "#EF4444" : "white"} 
                            />
                        </TouchableOpacity>

                        {/* Switch camera */}
                        <TouchableOpacity onPress={handleSwitchCamera} style={styles.activeBtn}>
                            <Ionicons name="camera-reverse-outline" size={26} color="white" />
                        </TouchableOpacity>

                        {/* Red hangup button */}
                        <TouchableOpacity onPress={handleHangup} style={[styles.activeBtn, styles.hangupBtn]}>
                            <Ionicons name="call" size={26} color="white" />
                        </TouchableOpacity>
                    </BlurView>
                )}
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F172A',
    },
    fallbackRemoteContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarWrap: {
        width: 130,
        height: 130,
        borderRadius: 65,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 5,
    },
    fallbackAvatar: {
        width: '100%',
        height: '100%',
        borderRadius: 60,
    },
    avatarLoader: {
        position: 'absolute',
        width: 140,
        height: 140,
    },
    cameraOffLabel: {
        color: '#E2E8F0',
        fontSize: 16,
        fontWeight: 'bold',
        marginTop: 20,
        letterSpacing: 0.5,
    },
    localVideoContainer: {
        position: 'absolute',
        top: 60,
        right: 20,
        width: 100,
        height: 150,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        backgroundColor: '#1E293B',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
    },
    localVideo: {
        flex: 1,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'space-between',
        paddingVertical: 70,
        paddingHorizontal: 25,
    },
    headerPanel: {
        alignItems: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        paddingVertical: 15,
        paddingHorizontal: 25,
        borderRadius: 20,
        alignSelf: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    nameLabel: {
        fontSize: 24,
        fontWeight: 'bold',
        color: 'white',
        letterSpacing: 0.5,
    },
    statusLabel: {
        fontSize: 15,
        color: '#10B981',
        fontWeight: '600',
        marginTop: 4,
    },
    priceLabel: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.6)',
        marginTop: 4,
    },
    incomingControlsWrap: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
        paddingBottom: 20,
    },
    controlBtn: {
        width: 70,
        height: 70,
        borderRadius: 35,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
    },
    declineBtn: {
        backgroundColor: '#EF4444',
    },
    acceptBtn: {
        backgroundColor: '#10B981',
    },
    activeControlsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        width: '100%',
        paddingVertical: 18,
        paddingHorizontal: 15,
        borderRadius: 28,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        alignSelf: 'center',
    },
    activeBtn: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    activeBtnToggled: {
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
    },
    hangupBtn: {
        backgroundColor: '#EF4444',
        transform: [{ rotate: '135deg' }],
    },
});
