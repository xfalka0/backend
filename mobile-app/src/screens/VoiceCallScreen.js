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
import { useKeepAwake } from 'expo-keep-awake';

import { API_URL } from '../config';
import { useChat } from '../contexts/ChatContext';
import { useAppStore } from '../store/useAppStore';
import { resolveImageUrl } from '../utils/imageUtils';
import VipBadge from '../components/ui/VipBadge';

const { width, height } = Dimensions.get('window');

// ─── Crash-safe Agora Dynamic Import ─────────────────────────────────────────
let AgoraRTC = null;
try {
    AgoraRTC = require('react-native-agora');
} catch (e) {
    console.warn('[Agora] Native module not linked. Using mock mode.');
}

// ─── Real Speech-Driven Neon Waveform ─────────────────────────────────────────
const TOTAL_BARS = 16;
const WaveformBar = ({ index, isActive, volume = 0 }) => {
    const heightVal = useSharedValue(12);

    useEffect(() => {
        if (!isActive) {
            heightVal.value = withTiming(8, { duration: 250 });
            return;
        }

        // Gaussian bell-curve factor centered at middle bars (7.5)
        const center = (TOTAL_BARS - 1) / 2;
        const bellCurve = Math.exp(-Math.pow(index - center, 2) / 14);

        // Effective voice height
        const minHeight = 12;
        const maxGain = 48;
        
        // If speaking volume is low or muted, keep slight organic baseline, otherwise expand with voice amplitude
        const voiceGain = volume > 0.05 ? volume : 0.08 + Math.sin(index * 1.2) * 0.04;
        const targetH = minHeight + maxGain * voiceGain * bellCurve;

        heightVal.value = withSpring(targetH, { damping: 12, stiffness: 180 });
    }, [isActive, volume, index]);

    const animatedStyle = useAnimatedStyle(() => ({
        height: heightVal.value,
    }));

    return (
        <Animated.View style={[styles.neonBarWrapper, animatedStyle, { shadowColor: '#FF007F' }]}>
            <LinearGradient
                colors={['#FF007F', '#FF4D94']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.neonBarGradient}
            />
        </Animated.View>
    );
};

export default function VoiceCallScreen({ route, navigation }) {
    useKeepAwake();
    const { receiver, isIncoming: initialIsIncoming, chatId: routeChatId, rtcToken: initialRtcToken, channelName: initialChannelName, callId: initialCallId } = route.params || {};
    const otherUser = receiver || {};
    const otherUserName = otherUser.name || otherUser.display_name || otherUser.username || 'Fiva Kullanıcısı';
    const otherUserImage = resolveImageUrl(otherUser.avatar_url || otherUser.avatar);
    const vipLevel = otherUser.vip_level || 0;
    const agencyName = otherUser.agency_name || 'FİVA VIP';

    const { socket } = useChat();
    const role = useAppStore(state => state.role);
    const currentUser = useAppStore(state => state.user);
    const myGender = (currentUser?.gender || '').toLowerCase();
    const isFemale = myGender === 'kadin' || role === 'operator';
    const isOperator = role === 'operator';
    const activeCallChatId = useAppStore(state => state.activeCallChatId);

    // Call ID tracking to prevent collisions
    const callIdRef = useRef(initialCallId || `call_${Date.now()}_${Math.random().toString(36).substring(7)}`);

    // Call States: 'outgoing' | 'incoming' | 'active' | 'ended'
    const [callState, setCallState] = useState(initialIsIncoming ? 'incoming' : 'outgoing');
    const [duration, setDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [isSpeaker, setIsSpeaker] = useState(true);
    const [statusText, setStatusText] = useState(initialIsIncoming ? 'Gelen Sesli Arama...' : 'Aranıyor...');
    const [speechVolume, setSpeechVolume] = useState(0);

    // Refs
    const agoraEngineRef = useRef(null);
    const soundRef = useRef(null);
    const timerIntervalRef = useRef(null);
    const isJoinedRef = useRef(false);
    
    // We reuse routeChatId or fall back to activeCallChatId
    const chatId = routeChatId || activeCallChatId;

    // Animations
    const overlayOpacity = useSharedValue(0);
    const scale = useSharedValue(0.92);
    const avatarBreathing = useSharedValue(1);
    const ringPulse = useSharedValue(1);
    const particlePulse = useSharedValue(0.4);

    // Intercept back navigation / Android back button
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
        setCallState('active');
        startTimer();
    };

    const handleSocketCallStarted = async () => {
        console.log('[SOCKET] Call Started Event Received');
        await cleanupAudio();
        setCallState('active');
        setStatusText('Bağlandı');
        startTimer();
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
        handleHangupTransition(data?.message || 'Hata Oluştu');
    };

    useEffect(() => {
        overlayOpacity.value = withTiming(1, { duration: 600 });
        scale.value = withSpring(1, { damping: 14 });

        // Breathing avatar animation
        avatarBreathing.value = withRepeat(
            withSequence(
                withTiming(1.04, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
                withTiming(1.0, { duration: 1800, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            true
        );

        // Ringing pulse for avatar
        ringPulse.value = withRepeat(
            withTiming(1.5, { duration: 1600, easing: Easing.out(Easing.ease) }),
            -1,
            false
        );

        // Particle pulse
        particlePulse.value = withRepeat(
            withSequence(
                withTiming(0.8, { duration: 2500 }),
                withTiming(0.3, { duration: 2500 })
            ),
            -1,
            true
        );

        if (chatId) {
            useAppStore.getState().setActiveCallChatId(chatId);
        }

        handleCallInit();

        if (socket && chatId) {
            socket.emit('join_room', chatId.toString());
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
        return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    };

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

    const requestMicPermission = async () => {
        if (Platform.OS === 'android') {
            try {
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
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
            setStatusText('Bağlandı');
            setCallState('active');
            startTimer();
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

            const appId = 'f80faf42fd0845a9816658ea7e16a755';
            await engine.initialize({ appId });
            await engine.setChannelProfile(AgoraRTC.ChannelProfileType.ChannelProfileCommunication);

            engine.registerEventHandler({
                onJoinChannelSuccess: (connection, elapsed) => {
                    console.log('[Agora] Joined channel success:', connection.channelId);
                    isJoinedRef.current = true;
                    setStatusText('Bağlandı');
                    setCallState('active');
                    startTimer();
                    if (socket) {
                        socket.emit('call_connected', { chatId });
                    }
                },
                onAudioVolumeIndication: (connection, speakers, speakerNumber, totalVolume) => {
                    const volRatio = Math.min(Math.max(totalVolume / 140, 0), 1);
                    setSpeechVolume(volRatio);
                },
                onUserOffline: (connection, remoteUid, reason) => {
                    console.log('[Agora] Remote user went offline:', remoteUid, 'reason:', reason);
                    if (reason === 0) {
                        handleHangup();
                    }
                },
                onError: (err, msg) => {
                    console.warn('[Agora] Engine error:', err, msg);
                }
            });

            await engine.enableAudio();
            await engine.enableAudioVolumeIndication(200, 3, true);
            await engine.setEnableSpeakerphone(isSpeaker);

            const currentUserId = useAppStore.getState().user?.id;
            const myUid = (Number(currentUserId) && !isNaN(Number(currentUserId)))
                ? Number(currentUserId)
                : (Math.floor(Math.random() * 899999) + 100000);

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

                // Caller immediately initializes Agora channel
                await initAgora(rtcToken, channelName);

                if (socket) {
                    socket.emit('call_request', {
                        chatId,
                        receiverId: otherUser.id,
                        callerName: useAppStore.getState().user?.display_name || 'Bir Kullanıcı',
                        callerAvatar: useAppStore.getState().user?.avatar_url,
                        rtcToken,
                        channelName,
                        callId,
                        callType: 'audio'
                    });
                }
            } catch (err) {
                console.error('[VoiceCall Init] Error:', err.message);
                setStatusText('Arama başarısız.');
                setTimeout(() => navigation.goBack(), 2000);
            }
        }
    };

    const handleCancel = () => {
        if (socket) socket.emit('call_cancel', { chatId, receiverId: otherUser.id });
        handleHangupTransition('Çağrı İptal Edildi');
    };

    const handleDecline = () => {
        if (socket) socket.emit('call_reject', { chatId, callerId: otherUser.id });
        handleHangupTransition('Çağrı Reddedildi');
    };

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
            if (socket) socket.emit('call_accept', { chatId, callerId: otherUser.id });
            await initAgora(rtcToken, channelName);
        } catch (err) {
            handleDecline();
        }
    };

    const handleHangup = () => {
        if (socket) socket.emit('call_end', { chatId });
        handleHangupTransition('Kapatılıyor...');
    };

    const handleHangupTransition = async (statusLabel) => {
        stopTimer();
        await cleanupAudio();
        await cleanupAgora();
        setCallState('ended');
        setStatusText(statusLabel);
        setTimeout(() => { navigation.goBack(); }, 1800);
    };

    const avatarBreathingStyle = useAnimatedStyle(() => ({ transform: [{ scale: avatarBreathing.value }] }));
    const ringPulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: ringPulse.value }],
        opacity: interpolate(ringPulse.value, [1, 1.5], [0.6, 0])
    }));
    const particleStyle = useAnimatedStyle(() => ({ opacity: particlePulse.value }));
    const animatedStyle = useAnimatedStyle(() => ({
        opacity: overlayOpacity.value,
        transform: [{ scale: scale.value }],
    }));

    const renderControls = () => {
        if (callState === 'incoming') {
            return (
                <View style={styles.controlsRow}>
                    <TouchableOpacity onPress={handleDecline} style={styles.controlBtnWrapper} activeOpacity={0.8}>
                        <LinearGradient colors={['#EF4444', '#B91C1C']} style={styles.actionCircleBtn}>
                            <Ionicons name="call" size={32} color="white" style={{ transform: [{ rotate: '135deg' }] }} />
                        </LinearGradient>
                        <Text style={styles.controlBtnText}>Reddet</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleAccept} style={styles.controlBtnWrapper} activeOpacity={0.8}>
                        <LinearGradient colors={['#10B981', '#047857']} style={styles.actionCircleBtn}>
                            <Ionicons name="call" size={32} color="white" />
                        </LinearGradient>
                        <Text style={styles.controlBtnText}>Kabul Et</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        if (callState === 'outgoing') {
            return (
                <View style={styles.controlsRow}>
                    <TouchableOpacity onPress={handleCancel} style={styles.controlBtnWrapper} activeOpacity={0.8}>
                        <LinearGradient colors={['#EF4444', '#B91C1C']} style={styles.actionCircleBtn}>
                            <Ionicons name="call" size={32} color="white" style={{ transform: [{ rotate: '135deg' }] }} />
                        </LinearGradient>
                        <Text style={styles.controlBtnText}>İptal</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        if (callState === 'active') {
            return (
                <BlurView intensity={35} tint="dark" style={styles.floatingGlassDock}>
                    <TouchableOpacity onPress={handleToggleMute} style={styles.dockBtnWrapper} activeOpacity={0.75}>
                        <View style={[styles.dockIconBtn, isMuted && styles.dockIconBtnMuted]}>
                            <Ionicons name={isMuted ? "mic-off" : "mic"} size={24} color={isMuted ? "#FF4D94" : "white"} />
                        </View>
                        <Text style={styles.dockBtnText}>{isMuted ? 'Sessiz' : 'Mikrofon'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleHangup} style={styles.dockBtnWrapper} activeOpacity={0.85}>
                        <LinearGradient colors={['#FF007F', '#DC2626']} style={styles.dockEndCallBtn}>
                            <Ionicons name="call" size={32} color="white" style={{ transform: [{ rotate: '135deg' }] }} />
                        </LinearGradient>
                        <Text style={styles.dockBtnTextEnd}>Kapat</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleToggleSpeaker} style={styles.dockBtnWrapper} activeOpacity={0.75}>
                        <View style={[styles.dockIconBtn, isSpeaker && styles.dockIconBtnSpeaker]}>
                            <Ionicons name={isSpeaker ? "volume-high" : "volume-mute"} size={24} color={isSpeaker ? "#FFD700" : "white"} />
                        </View>
                        <Text style={styles.dockBtnText}>{isSpeaker ? 'Hoparlör' : 'Ahize'}</Text>
                    </TouchableOpacity>
                </BlurView>
            );
        }

        return <ActivityIndicator size="large" color="#FF007F" />;
    };

    return (
        <View style={styles.container}>
            {/* Rich Cyberpunk Nobility Radial Gradient Background */}
            <LinearGradient
                colors={['#0C0219', '#240748', '#460C6E', '#1D0538', '#080112']}
                locations={[0, 0.3, 0.65, 0.85, 1]}
                start={{ x: 0.2, y: 0 }}
                end={{ x: 0.8, y: 1 }}
                style={StyleSheet.absoluteFill}
            />
            
            {/* Soft Blurred User Avatar Overlay */}
            <Image source={{ uri: otherUserImage }} style={StyleSheet.absoluteFill} blurRadius={50} opacity={0.22} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10, 2, 22, 0.45)' }]} />

            <Animated.View style={[styles.content, animatedStyle]}>
                <View style={styles.headerSection}>
                    {isFemale ? (
                        <BlurView intensity={25} tint="dark" style={styles.diamondPill}>
                            <Ionicons name="diamond" size={14} color="#00F0FF" style={{ marginRight: 6 }} />
                            <Text style={styles.diamondPillText}>+217.5 Elmas / Dk</Text>
                        </BlurView>
                    ) : (
                        <BlurView intensity={25} tint="dark" style={styles.pricePill}>
                            <Ionicons name="sparkles" size={14} color="#FFD700" style={{ marginRight: 6 }} />
                            <Text style={styles.pricePillText}>50 Coin / Dk</Text>
                        </BlurView>
                    )}
                </View>

                <View style={styles.avatarContainer}>
                    {callState !== 'active' && callState !== 'ended' && <Animated.View style={[styles.ringingRing, ringPulseStyle]} />}
                    <Animated.View style={[styles.avatarBreathingBox, avatarBreathingStyle]}>
                        <LinearGradient colors={callState === 'active' ? ['#FF007F', '#9D4EDD', '#FFD700'] : ['#9D4EDD', '#7B2CBF', '#FF007F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatarGradientBorder}>
                            <View style={styles.avatarInnerFrame}>
                                <Image source={{ uri: otherUserImage }} style={styles.avatarImage} />
                            </View>
                        </LinearGradient>
                    </Animated.View>
                </View>

                <View style={styles.userInfoSection}>
                    <View style={styles.userNameRow}>
                        <Text style={styles.userNameText}>{otherUserName}</Text>
                        <Ionicons name="shield-checkmark-sharp" size={20} color="#3B82F6" style={{ marginLeft: 6 }} />
                    </View>

                    {vipLevel > 0 && (
                        <View style={styles.badgesRow}>
                            <VipBadge level={vipLevel} size={42} />
                        </View>
                    )}

                    <View style={styles.statusRow}>
                        <View style={[styles.statusDot, callState === 'active' ? styles.statusDotActive : styles.statusDotRinging]} />
                        <Text style={styles.statusText}>{statusText}</Text>
                    </View>
                    {callState === 'active' && <Text style={styles.timerText}>{formatDuration(duration)}</Text>}
                </View>

                <View style={styles.waveformContainer}>
                    {callState === 'active' && (
                        <View style={styles.waveformRow}>
                            {[...Array(16)].map((_, i) => <WaveformBar key={i} index={i} isActive={!isMuted} volume={speechVolume} />)}
                        </View>
                    )}
                </View>

                <View style={styles.controlsDockContainer}>{renderControls()}</View>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0A0314',
    },
    ambientOrbTop: {
        position: 'absolute',
        top: height * 0.12,
        left: width * 0.15,
        width: 220,
        height: 220,
        borderRadius: 110,
        backgroundColor: 'rgba(157, 78, 221, 0.18)',
    },
    ambientOrbBottom: {
        position: 'absolute',
        bottom: height * 0.2,
        right: width * 0.1,
        width: 260,
        height: 260,
        borderRadius: 130,
        backgroundColor: 'rgba(255, 0, 127, 0.14)',
    },
    content: {
        flex: 1,
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: Platform.OS === 'ios' ? 60 : 40,
        paddingHorizontal: 20,
    },
    headerSection: {
        alignItems: 'center',
        width: '100%',
        marginTop: 10,
    },
    pricePill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 215, 0, 0.35)',
        backgroundColor: 'rgba(255, 215, 0, 0.08)',
        overflow: 'hidden',
    },
    pricePillText: {
        color: '#FFD700',
        fontSize: 13,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    diamondPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(0, 240, 255, 0.4)',
        backgroundColor: 'rgba(0, 240, 255, 0.1)',
        overflow: 'hidden',
    },
    diamondPillText: {
        color: '#00F0FF',
        fontSize: 13,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    avatarContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        marginVertical: 10,
    },
    radialBackglow: {
        position: 'absolute',
        width: 190,
        height: 190,
        borderRadius: 95,
        backgroundColor: 'rgba(255, 0, 127, 0.22)',
    },
    ringingRing: {
        position: 'absolute',
        width: 140,
        height: 140,
        borderRadius: 70,
        borderWidth: 2,
        borderColor: '#FF007F',
    },
    avatarBreathingBox: {
        width: 136,
        height: 136,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarGradientBorder: {
        width: 134,
        height: 134,
        borderRadius: 67,
        padding: 3.5,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 12,
        shadowColor: '#FF007F',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.5,
        shadowRadius: 14,
    },
    avatarInnerFrame: {
        width: '100%',
        height: '100%',
        borderRadius: 63,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.4)',
        backgroundColor: '#1E0A38',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    userInfoSection: {
        alignItems: 'center',
        width: '100%',
    },
    userNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    userNameText: {
        fontSize: 26,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 0.5,
        textShadowColor: 'rgba(0, 0, 0, 0.6)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 6,
    },
    badgesRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
    },
    agencyBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 3.5,
        paddingHorizontal: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 215, 0, 0.35)',
        backgroundColor: 'rgba(255, 215, 0, 0.1)',
        overflow: 'hidden',
    },
    agencyBadgeText: {
        color: '#FFD700',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 0.6,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 8,
    },
    statusDotActive: {
        backgroundColor: '#10B981',
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 6,
    },
    statusDotRinging: {
        backgroundColor: '#FFD700',
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 6,
    },
    statusText: {
        color: 'rgba(255, 255, 255, 0.75)',
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 0.4,
    },
    timerText: {
        fontSize: 34,
        fontWeight: '900',
        color: '#FF007F',
        marginTop: 10,
        letterSpacing: 2,
        textShadowColor: 'rgba(255, 0, 127, 0.4)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 8,
    },
    waveformContainer: {
        height: 60,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
    },
    waveformRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        height: 55,
    },
    neonBarWrapper: {
        width: 6,
        borderRadius: 3,
        overflow: 'hidden',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.95,
        shadowRadius: 10,
        elevation: 10,
    },
    neonBarGradient: {
        width: '100%',
        height: '100%',
        borderRadius: 3,
    },
    controlsDockContainer: {
        width: '100%',
        paddingHorizontal: 10,
        marginBottom: 10,
    },
    controlsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        width: '100%',
    },
    controlBtnWrapper: {
        alignItems: 'center',
    },
    actionCircleBtn: {
        width: 72,
        height: 72,
        borderRadius: 36,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
    },
    controlBtnText: {
        color: '#FFFFFF',
        marginTop: 8,
        fontSize: 13,
        fontWeight: '800',
    },
    floatingGlassDock: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 40,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.14)',
        backgroundColor: 'rgba(21, 8, 42, 0.65)',
        overflow: 'hidden',
        elevation: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
    },
    dockBtnWrapper: {
        alignItems: 'center',
    },
    dockIconBtn: {
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderColor: 'rgba(255, 255, 255, 0.18)',
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dockIconBtnMuted: {
        backgroundColor: 'rgba(255, 0, 127, 0.25)',
        borderColor: '#FF007F',
    },
    dockIconBtnSpeaker: {
        backgroundColor: 'rgba(255, 215, 0, 0.2)',
        borderColor: '#FFD700',
    },
    dockEndCallBtn: {
        width: 72,
        height: 72,
        borderRadius: 36,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 12,
        shadowColor: '#DC2626',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.6,
        shadowRadius: 12,
    },
    dockBtnText: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: 12,
        fontWeight: '700',
        marginTop: 6,
    },
    dockBtnTextEnd: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '900',
        marginTop: 6,
    }
});
