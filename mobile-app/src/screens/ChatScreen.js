import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity, Image, RefreshControl, Animated, ScrollView, Keyboard, PanResponder, Alert, Linking, BackHandler, ActivityIndicator, UIManager, findNodeHandle } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import io from 'socket.io-client';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import { Audio, Video, ResizeMode } from 'expo-av';
import { Asset } from 'expo-asset'; // Import Audio and Video
import { API_URL, SOCKET_URL, AGENCY_SYSTEM_ENABLED } from '../config';
import MessageBubble from '../components/animated/MessageBubble';
import TypingIndicator from '../components/animated/TypingIndicator';
import ChatBackground from '../components/animated/ChatBackground';
import VipFrame from '../components/ui/VipFrame';
import VipBadge from '../components/ui/VipBadge';
import { useTheme } from '../contexts/ThemeContext';
import { useAlert } from '../contexts/AlertContext';
import { useStarterPack } from '../contexts/StarterPackContext';
import { GIFTS } from '../constants/gifts';
import GlassCard from '../components/ui/GlassCard';
import ModernAlert from '../components/ui/ModernAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '../store/useAppStore';
import { Modal } from 'react-native';
import { preventScreenshots } from '../utils/security';

import { resolveImageUrl } from '../utils/imageUtils';

import { SHADOWS, COLORS } from '../theme';
import ReportModal from '../components/ReportModal';
import InsufficientCoinsModal from '../components/InsufficientCoinsModal';
import GiftPickerModal from '../components/GiftPickerModal';
import GiftOverlay from '../components/animated/GiftOverlay';
import ImageLightbox from '../components/ui/ImageLightbox';

import { useChat } from '../contexts/ChatContext';
import QuickActionsModal from '../components/QuickActionsModal';

const ChatMessageRow = React.memo(({
    item,
    index,
    isTopItem,
    showDate,
    dateText,
    renderMessage,
    dateSeparatorStyle,
    dateSeparatorLineStyle,
    dateSeparatorTextStyle,
}) => (
    <View>
        {showDate && (
            <View style={dateSeparatorStyle}>
                <View style={dateSeparatorLineStyle} />
                <Text style={dateSeparatorTextStyle}>{dateText}</Text>
                <View style={dateSeparatorLineStyle} />
            </View>
        )}
        {renderMessage({ item, index })}
    </View>
), (prev, next) => (
    prev.item === next.item
    && prev.showDate === next.showDate
    && prev.dateText === next.dateText
    && prev.isTopItem === next.isTopItem
    && prev.renderMessage === next.renderMessage
));

export default function ChatScreen({ route, navigation }) {
    console.log("RENDER ChatScreen");
    const insets = useSafeAreaInsets();
    const { fetchUnreadCount, setActiveChatId, socket, user: contextUser, ensureSocketConnected } = useChat();
    useFocusEffect(
        React.useCallback(() => {
            ensureSocketConnected?.();
            const syncMe = async () => {
                try {
                    const token = await AsyncStorage.getItem('token');
                    if (!token) return;
                    const res = await axios.get(`${API_URL}/auth/me`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    if (res.data) {
                        useAppStore.getState().setUser(res.data);
                        setCurrentUser(prev => ({ ...prev, ...res.data }));
                        if (typeof res.data.balance === 'number') {
                            setCurrentBalance(res.data.balance);
                        }
                    }
                } catch (e) {
                    console.log('[ChatScreen] Refresh user error:', e.message);
                }
            };
            syncMe();
        }, [ensureSocketConnected])
    );
    const { showAlert } = useAlert();
    const role = useAppStore(state => state.role);
    const isOperator = role === 'operator';



    // Cihaz Güvenliği: Kadın operatörlerin ekran görüntüsü almasını/kaydetmesini engelle
    useEffect(() => {
        if (isOperator) {
            preventScreenshots(true);
        }
        return () => {
            if (isOperator) {
                preventScreenshots(false);
            }
        };
    }, [isOperator]);
    const { theme, themeMode } = useTheme();
    const { 
        operatorId, 
        chatId: existingChatId, 
        name, 
        job, 
        user: routeUser = {}, 
        avatar_url, 
        is_online, 
        vip_level = 0, 
        gender,
        nobility_key,
        nobility_name,
        nobility_name_color,
        chatType,
        familyId
    } = route.params;
    const isFamilyChat = chatType === 'family';

    // User Handling
    const globalUser = useAppStore(state => state.user) || {};
    const [currentUser, setCurrentUser] = useState({ ...(contextUser || {}), ...(globalUser || {}), ...(routeUser || {}) });
    const effectiveUser = { ...(currentUser || {}), ...(contextUser || {}), ...(globalUser || {}), ...(routeUser || {}) };
    const user = effectiveUser;
    const hasActiveExpire = Boolean(
        (effectiveUser?.premium_expire_date && new Date(effectiveUser.premium_expire_date) > new Date()) ||
        (effectiveUser?.vip_expire_date && new Date(effectiveUser.vip_expire_date) > new Date())
    );
    const isPremiumMember = Boolean(
        effectiveUser?.is_premium === true ||
        effectiveUser?.is_premium === 'true' ||
        effectiveUser?.is_premium === 1 ||
        hasActiveExpire ||
        effectiveUser?.is_vip === true ||
        effectiveUser?.is_vip === 'true' ||
        effectiveUser?.is_vip === 1 ||
        parseInt(effectiveUser?.vip_level || 0, 10) > 0 ||
        isOperator
    );
    const isVipMember = Boolean(
        parseInt(effectiveUser?.vip_level || 0, 10) > 0 || effectiveUser?.is_vip
    );

    const PAGE_SIZE = 50;
    const [messages, setMessages] = useState([]);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [hasMoreMessages, setHasMoreMessages] = useState(true);
    const [isTyping, setIsTyping] = useState(false);
    const lastInputEventCountRef = useRef(0);
    const inputTextRef = useRef('');
    const textInputRef = useRef(null);
    const tempSeqRef = useRef(0);
    const sendQueueRef = useRef(Promise.resolve());
    const pendingAckResolversRef = useRef(new Map());
    const liveAnimatedIdsRef = useRef(new Set());
    const loadingOlderRef = useRef(false);
    const hasMoreMessagesRef = useRef(true);
    const loadedHistoryOffsetRef = useRef(0);
    const newLiveServerCountRef = useRef(0);
    const messagesRef = useRef([]);
    const initialLoadedRef = useRef(false);
    const [isKeyboardVisible, setKeyboardVisible] = useState(false);

    useEffect(() => {
        const showSub = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            () => setKeyboardVisible(true)
        );
        const hideSub = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            () => setKeyboardVisible(false)
        );
        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    useEffect(() => {
        const onBackPress = () => {
            if (navigation.canGoBack()) {
                navigation.goBack();
            } else {
                navigation.navigate('Main');
            }
            return true;
        };
        const backSub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => backSub.remove();
    }, [navigation]);

    // Zustand Role & Locked Image Configuration States
    const [selectedImageUri, setSelectedImageUri] = useState(null);
    const [showImageLockModal, setShowImageLockModal] = useState(false);
    const [unlockCostSelection, setUnlockCostSelection] = useState(200);
    const [partnerName, setPartnerName] = useState(name);
    const [partnerAvatar, setPartnerAvatar] = useState(avatar_url);

    useEffect(() => {
        let active = true;
        const fetchPartner = async () => {
            if (!operatorId) return;
            if (name && avatar_url) {
                setPartnerName(name);
                setPartnerAvatar(avatar_url);
                return;
            }
            try {
                const token = await AsyncStorage.getItem('token');
                const res = await axios.get(`${API_URL}/users/${operatorId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (active && res.data) {
                    setPartnerName(res.data.display_name || res.data.username || name);
                    setPartnerAvatar(res.data.avatar_url || avatar_url);
                }
            } catch (err) {
                console.warn('[ChatScreen] Auto-fetch partner profile error:', err.message);
            }
        };
        fetchPartner();
        return () => { active = false; };
    }, [operatorId, name, avatar_url]);

    useEffect(() => {
        let active = true;
        const syncCurrentUser = async () => {
            try {
                const storedUserStr = await AsyncStorage.getItem('user');
                let targetId = null;
                if (storedUserStr) {
                    const parsed = JSON.parse(storedUserStr);
                    if (active) {
                        setCurrentUser(prev => ({ ...prev, ...parsed }));
                        if (parsed.balance !== undefined) setCurrentBalance(parsed.balance);
                    }
                    targetId = parsed.id;
                }
                const token = await AsyncStorage.getItem('token');
                const uid = targetId || routeUser?.id || globalUser?.id || contextUser?.id;
                if (uid && token) {
                    const res = await axios.get(`${API_URL}/users/${uid}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    if (res.data && active) {
                        setCurrentUser(res.data);
                        if (res.data.balance !== undefined) setCurrentBalance(res.data.balance);
                        await AsyncStorage.setItem('user', JSON.stringify(res.data));
                        if (useAppStore.getState().setUser) {
                            useAppStore.getState().setUser(res.data);
                        }
                    }
                }
            } catch (err) {
                console.warn('[ChatScreen] syncCurrentUser error:', err.message);
            }
        };
        syncCurrentUser();
        return () => { active = false; };
    }, []);

    const [chatId, setChatId] = useState(existingChatId || (isFamilyChat && familyId ? `family-${familyId}` : null));

    useEffect(() => {
        if (chatId) {
            setActiveChatId(chatId);
        }
        return () => {
            setActiveChatId(null);
        };
    }, [chatId]);

    const [isLoading, setIsLoading] = useState(true);
    const [selectedImage, setSelectedImage] = useState(null);
    const [selectedVideo, setSelectedVideo] = useState(null);
    const [pendingAgencyInvite, setPendingAgencyInvite] = useState(null);

    useEffect(() => {
        const checkPendingInvitations = async () => {
            if (!AGENCY_SYSTEM_ENABLED) return;
            try {
                const token = await AsyncStorage.getItem('token');
                if (!token) return;
                
                const inviteRes = await axios.get(`${API_URL}/agency/my-invitations`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                
                if (inviteRes.data && inviteRes.data.length > 0) {
                    const matchingInvite = inviteRes.data.find(inv => inv.owner_id?.toString() === operatorId?.toString());
                    if (matchingInvite) {
                        setPendingAgencyInvite(matchingInvite);
                    }
                }
            } catch (err) {
                console.log('[ChatScreen] Error checking pending invitations:', err.message);
            }
        };
        if (operatorId && AGENCY_SYSTEM_ENABLED) {
            checkPendingInvitations();
        }
    }, [operatorId]);

    const handleAcceptInvitation = async (inviteId) => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) return;

            const res = await axios.post(`${API_URL}/agency/invitations/${inviteId}/accept`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data && res.data.success) {
                Alert.alert('Başarılı', res.data.message || 'Ajans davetini başarıyla kabul ettiniz!');
                setPendingAgencyInvite(null);
            } else {
                Alert.alert('Hata', res.data?.error || 'Davet kabul edilemedi.');
            }
        } catch (error) {
            console.error('[ChatScreen] Accept invite error:', error);
            const errMsg = error.response?.data?.error || 'Davet kabul edilirken bir hata oluştu.';
            Alert.alert('Hata', errMsg);
        }
    };

    const handleRejectInvitation = async (inviteId) => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) return;

            const res = await axios.post(`${API_URL}/agency/invitations/${inviteId}/reject`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data && res.data.success) {
                Alert.alert('Başarılı', 'Ajans davetini reddettiniz.');
                setPendingAgencyInvite(null);
            } else {
                Alert.alert('Hata', res.data?.error || 'Davet reddedilemedi.');
            }
        } catch (error) {
            console.error('[ChatScreen] Reject invite error:', error);
            const errMsg = error.response?.data?.error || 'Davet reddedilirken bir hata oluştu.';
            Alert.alert('Hata', errMsg);
        }
    };

    // UI Toggles
    const [showOptions, setShowOptions] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [showGiftModal, setShowGiftModal] = useState(false);
    const { openStarterPack, handleInsufficientCoins } = useStarterPack();

    // Track Balance for Gift Modal (Initial from route, updated via socket)
    const [currentBalance, setCurrentBalance] = useState(user?.balance ?? user?.coins ?? user?.hearts ?? 0);
    const [recording, setRecording] = useState(null);
    const [sound, setSound] = useState(null);
    const [currentPlayingUri, setCurrentPlayingUri] = useState(null);
    const [audioDurations, setAudioDurations] = useState({});
    const [activeGift, setActiveGift] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordTime, setRecordTime] = useState('0:00');
    const [audioLevel, setAudioLevel] = useState(0);
    const timerRef = useRef(null);
    const socketRef = useRef(null);
    const flatListRef = useRef(null);
    const recordingRef = useRef(null);
    const isRecordingRef = useRef(false);
    const typingTimeoutRef = useRef(null);
    const waveAnim = useRef(new Animated.Value(0)).current;
    const blinkAnim = useRef(new Animated.Value(1)).current;
    const slideAnim = useRef(new Animated.Value(0)).current;
    const [isCancelling, setIsCancelling] = useState(false);
    const isCancellingRef = useRef(false);
    const startTimeRef = useRef(0);
    const startXRef = useRef(0);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                startRecording();
            },
            onPanResponderMove: (evt, gestureState) => {
                handleRecordingMove(evt);
            },
            onPanResponderRelease: () => {
                stopRecording();
            },
            onPanResponderTerminate: () => {
                stopRecording();
            }
        })
    ).current;

    const [showQuickActions, setShowQuickActions] = useState(false);
    const [fakeCall, setFakeCall] = useState(null);
    const [fakeCallEndStatus, setFakeCallEndStatus] = useState(null);
    const fakeCallPulse = useRef(new Animated.Value(1)).current;
    const ringtoneRef = useRef(null);
    const callTimerRef = useRef(null);
    const callDismissTimerRef = useRef(null);

    useEffect(() => {
        if (!fakeCall) return undefined;

        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(fakeCallPulse, { toValue: 1.18, duration: 800, useNativeDriver: true }),
                Animated.timing(fakeCallPulse, { toValue: 1, duration: 800, useNativeDriver: true }),
            ])
        );
        pulse.start();
        return () => pulse.stop();
    }, [fakeCall, fakeCallPulse]);

    const startRingtone = async () => {
        try {
            if (ringtoneRef.current) {
                await ringtoneRef.current.stopAsync().catch(() => {});
                await ringtoneRef.current.unloadAsync().catch(() => {});
                ringtoneRef.current = null;
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true,
                shouldDuckAndroid: false,
                playThroughEarpieceAndroid: false,
                staysActiveInBackground: false,
            });

            const assetModule = require('../../assets/sounds/calling.mp3');
            let source = assetModule;
            try {
                const asset = Asset.fromModule(assetModule);
                if (!asset.localUri) {
                    await asset.downloadAsync();
                }
                if (asset.localUri || asset.uri) {
                    source = { uri: asset.localUri || asset.uri };
                    console.log('[Ringtone] Using resolved asset URI:', source.uri);
                }
            } catch (assetErr) {
                console.log('[Ringtone] Asset resolve note:', assetErr.message);
            }

            const sound = new Audio.Sound();
            await sound.loadAsync(
                source,
                { shouldPlay: true, isLooping: true, volume: 1.0 }
            );

            ringtoneRef.current = sound;
            await sound.setVolumeAsync(1.0);
            await sound.playAsync();
            const status = await sound.getStatusAsync();
            console.log('[Ringtone] Sound status after play:', status?.isLoaded, status?.isPlaying, status?.durationMillis);
        } catch (err) {
            console.warn('[Ringtone] Play error:', err?.message || err);
        }
    };

    const stopRingtone = async () => {
        try {
            if (ringtoneRef.current) {
                const s = ringtoneRef.current;
                ringtoneRef.current = null;
                await s.stopAsync().catch(() => {});
                await s.unloadAsync().catch(() => {});
                console.log('[Ringtone] Calling sound stopped.');
            }
        } catch (err) {
            console.warn('[Ringtone] Stop error:', err?.message || err);
        }
    };

    const handleHangupCall = (cancelledByUser = true) => {
        try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch (_) {}
        if (callTimerRef.current) clearTimeout(callTimerRef.current);
        if (callDismissTimerRef.current) clearTimeout(callDismissTimerRef.current);
        stopRingtone();

        if (cancelledByUser && fakeCall) {
            const isVideo = fakeCall === 'video';
            const tempId = `call-stub-${Date.now()}`;
            const stubContent = JSON.stringify({
                status: 'cancelled',
                callType: fakeCall,
                duration: '0:00'
            });
            const stubType = isVideo ? 'call_video' : 'call_audio';

            const stubMsg = {
                id: tempId,
                tempId: tempId,
                chatId: chatId,
                chat_id: chatId,
                sender_id: user.id,
                content: stubContent,
                type: stubType,
                content_type: stubType,
                created_at: new Date().toISOString()
            };
            setMessages(prev => [stubMsg, ...prev]);

            if (socketRef.current) {
                socketRef.current.emit('send_message', {
                    chatId: chatId,
                    senderId: user.id,
                    content: stubContent,
                    type: stubType,
                    tempId: tempId
                });
            }
        }

        setFakeCall(null);
        setFakeCallEndStatus(null);
    };

    const triggerRandomCallOutcome = (callType) => {
        if (callTimerRef.current) clearTimeout(callTimerRef.current);
        if (callDismissTimerRef.current) clearTimeout(callDismissTimerRef.current);
        setFakeCallEndStatus(null);

        const rand = Math.random();
        let durationMs;
        let endStatus;
        let stubStatus;

        if (rand < 0.60) {
            // En yüksek ihtimal (%60): 14 - 16 saniye çalıp "Karşı tarafa ulaşılamadı"
            durationMs = 14000 + Math.floor(Math.random() * 2000);
            endStatus = {
                status: 'Ulaşılamıyor',
                note: 'Karşı tarafa ulaşılamadı',
                color: '#F59E0B'
            };
            stubStatus = 'missed';
        } else if (rand < 0.85) {
            // %25 ihtimal: 4 - 8 saniye (ortalama 5-6 sn) çalıp "Arama Reddedildi"
            durationMs = 4500 + Math.floor(Math.random() * 3500);
            endStatus = {
                status: 'Reddedildi',
                note: 'Karşı taraf aramayı reddetti',
                color: '#EF4444'
            };
            stubStatus = 'rejected';
        } else {
            // %15 ihtimal: 8 - 12 saniye çalıp "Kullanıcı Meşgul"
            durationMs = 8000 + Math.floor(Math.random() * 4000);
            endStatus = {
                status: 'Meşgul',
                note: 'Kullanıcı şu anda başka bir görüşmede',
                color: '#EF4444'
            };
            stubStatus = 'busy';
        }

        callTimerRef.current = setTimeout(() => {
            stopRingtone();
            setFakeCallEndStatus(endStatus);
            try {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            } catch (_) {}

            const isVideo = callType === 'video';
            const tempId = `call-stub-${Date.now()}`;
            const stubContent = JSON.stringify({
                status: stubStatus,
                callType: callType,
                duration: '0:00'
            });
            const stubType = isVideo ? 'call_video' : 'call_audio';

            const stubMsg = {
                id: tempId,
                tempId: tempId,
                chatId: chatId,
                chat_id: chatId,
                sender_id: user.id,
                content: stubContent,
                type: stubType,
                content_type: stubType,
                created_at: new Date().toISOString()
            };
            setMessages(prev => [stubMsg, ...prev]);

            if (socketRef.current) {
                socketRef.current.emit('send_message', {
                    chatId: chatId,
                    senderId: user.id,
                    content: stubContent,
                    type: stubType,
                    tempId: tempId
                });
            }

            // 2.5 saniye sonra arama modalını otomatik kapat
            callDismissTimerRef.current = setTimeout(() => {
                setFakeCall(null);
                setFakeCallEndStatus(null);
            }, 2500);
        }, durationMs);
    };

    // Arama Zil Sesi Efekti
    useEffect(() => {
        if (fakeCall) {
            startRingtone();
        } else {
            stopRingtone();
        }
        return () => {
            stopRingtone();
        };
    }, [fakeCall]);

    useEffect(() => {
        return () => {
            if (sound) {
                sound.unloadAsync().catch(() => {});
            }
        };
    }, [sound]);

    const handleFakeCall = async (type) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (!isPremiumMember && !isOperator) {
            showAlert({
                title: 'Premium Gerekli 👑',
                message: 'Sesli ve görüntülü arama yapmak için Premium üye olmanız gerekmektedir.',
                type: 'info',
                showCancel: true,
                cancelText: 'Vazgeç',
                confirmText: 'Premium Al',
                onConfirm: () => navigation.navigate('Store')
            });
            return;
        }

        const CALL_COST = 200;
        if (!isOperator) {
            if (currentBalance < CALL_COST) {
                showAlert({
                    title: 'Coin Yetersiz 🪙',
                    message: 'Sesli ve görüntülü arama yapmak için coin bakiyeniz yetersizdir.',
                    type: 'warning',
                    showCancel: true,
                    cancelText: 'Vazgeç',
                    confirmText: 'Coin Yükle',
                    onConfirm: () => navigation.navigate('Shop')
                });
                return;
            }

            // Bastığı an 200 coin düşülüyor
            try {
                const token = await AsyncStorage.getItem('token');
                const res = await axios.post(`${API_URL}/users/deduct-coins`, {
                    amount: CALL_COST,
                    reason: `${type === 'video' ? 'Görüntülü' : 'Sesli'} arama`
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (res.data && res.data.success && typeof res.data.balance === 'number') {
                    setCurrentBalance(res.data.balance);
                    const storedUser = await AsyncStorage.getItem('user');
                    if (storedUser) {
                        const parsed = JSON.parse(storedUser);
                        parsed.balance = res.data.balance;
                        await AsyncStorage.setItem('user', JSON.stringify(parsed));
                    }
                } else {
                    setCurrentBalance(prev => Math.max(0, prev - CALL_COST));
                }
            } catch (err) {
                const errMsg = typeof err?.response?.data === 'string' ? (err.response?.status === 404 ? 'Servis güncelleniyor' : err.message) : (err?.response?.data?.error || err.message);
                console.warn('[ChatScreen] Call coin deduction notice:', errMsg);
                if (err?.response?.data?.error === 'Yetersiz bakiye') {
                    showAlert({
                        title: 'Coin Yetersiz 🪙',
                        message: 'Sesli ve görüntülü arama yapmak için coin bakiyeniz yetersizdir.',
                        type: 'warning',
                        showCancel: true,
                        cancelText: 'Vazgeç',
                        confirmText: 'Coin Yükle',
                    onConfirm: () => navigation.navigate('Shop')
                    });
                    return;
                }
                setCurrentBalance(prev => Math.max(0, prev - CALL_COST));
            }
        }

        setFakeCall(type);
        triggerRandomCallOutcome(type);
    };

    const handleSendLocation = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        if (!isPremiumMember && !isOperator) {
            showAlert({
                title: 'Premium Gerekli 👑',
                message: 'Konum gönderebilmek için Premium üye olmanız gerekmektedir.',
                type: 'info',
                showCancel: true,
                cancelText: 'Kapat',
                confirmText: 'Premium Al',
                onConfirm: () => navigation.navigate('Main', { screen: 'Mağaza' })
            });
            return;
        }

        if (!isFamilyChat && !socketRef.current?.connected) {
            showAlert({ title: 'Bağlantı Hatası', message: 'Sunucu ile bağlantı kurulamadı.', type: 'error' });
            return;
        }

        const LOCATION_COST = 400;
        if (!isOperator && currentBalance < LOCATION_COST) {
            showAlert({
                title: 'Coin Yetersiz 🪙',
                message: 'Konum göndermek için coin bakiyeniz yetersizdir.',
                type: 'warning',
                showCancel: true,
                cancelText: 'Vazgeç',
                confirmText: 'Coin Yükle',
                    onConfirm: () => navigation.navigate('Shop')
            });
            return;
        }

        try {
            let coords = { latitude: 41.0082, longitude: 28.9784 };
            let address = 'İstanbul, Türkiye';

            try {
                const Location = require('expo-location');
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status === 'granted') {
                    let loc = await Location.getLastKnownPositionAsync({});
                    if (!loc) {
                        loc = await Promise.race([
                            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest }),
                            new Promise((resolve) => setTimeout(() => resolve(null), 2500))
                        ]);
                    }
                    if (loc && loc.coords) {
                        coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
                    }
                }
            } catch (locErr) {
                console.log('[Location] Location fetch fallback:', locErr.message);
            }

            const locationData = JSON.stringify({
                latitude: coords.latitude,
                longitude: coords.longitude,
                address: address
            });

            const tempId = `loc-${Date.now()}`;
            if (isFamilyChat) {
                const token = await AsyncStorage.getItem('token');
                await axios.post(`${API_URL}/families/${familyId}/chat`, { message: locationData }, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }

            // Optimistic Balance Update
            if (!isFamilyChat) {
                if (!isOperator) {
                    const nextBalance = Math.max(0, currentBalance - 400);
                    setCurrentBalance(nextBalance);

                    if (nextBalance <= 0) {
                        setTimeout(() => {
                            handleInsufficientCoins();
                        }, 1000); 
                    }
                }
            }

            const msgData = {
                chatId: chatId,
                senderId: user.id,
                content: locationData,
                type: 'location',
                tempId: tempId
            };

            if (socketRef.current) {
                socketRef.current.emit('send_message', msgData);
            }

            const optimisticMsg = {
                id: tempId,
                sender_id: user.id,
                content: locationData,
                type: 'location',
                content_type: 'location',
                created_at: new Date().toISOString(),
                is_optimistic: true,
                tempId: tempId
            };

            setTimeout(() => setMessages(prev => [optimisticMsg, ...prev]), 0);
        } catch (err) {
            console.error('[ChatScreen] Send location error:', err);
            showAlert({ title: 'Hata', message: 'Konum gönderilemedi.', type: 'error' });
        }
    };

    // Header Config
    React.useLayoutEffect(() => {
        navigation.setOptions({
            headerShown: true,
            headerTransparent: true,
            headerTitleAlign: 'center',
            headerTitle: () => (
                <TouchableOpacity 
                    onPress={() => !isFamilyChat && navigation.navigate('OperatorProfile', { operator: { id: operatorId, name: partnerName || name, avatar_url: partnerAvatar || avatar_url, is_online, vip_level }, user })}
                    activeOpacity={0.8}
                    style={{ alignItems: 'center' }}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 1, gap: 4 }}>
                        <Text style={{ color: nobility_name_color || theme.colors.text, fontSize: 15, fontWeight: '900', marginRight: 4 }}>
                            {partnerName ? partnerName.toUpperCase() : (name ? name.toUpperCase() : 'SOHBET')}
                        </Text>

                        {nobility_key && (
                            <View style={{
                                backgroundColor: `${nobility_name_color || '#FFD166'}20`,
                                borderColor: nobility_name_color || '#FFD166',
                                borderWidth: 1,
                                paddingHorizontal: 5,
                                paddingVertical: 1.5,
                                borderRadius: 6,
                                marginRight: 4,
                                flexDirection: 'row',
                                alignItems: 'center'
                            }}>
                                <Ionicons name="shield-checkmark" size={9} color={nobility_name_color || '#FFD166'} />
                                <Text style={{ color: nobility_name_color || '#FFD166', fontSize: 9, fontWeight: '900', marginLeft: 2 }}>
                                    {nobility_name}
                                </Text>
                            </View>
                        )}

                        {vip_level > 0 && (
                            <VipBadge level={gender === 'coin_bayisi' ? 'dealer' : vip_level} size={42} style={{ marginRight: 2 }} />
                        )}

                        <Ionicons name="checkmark-circle" size={14} color="#3b82f6" />
                    </View>
                    {isFamilyChat ? (
                        <View style={{ backgroundColor: '#ec4899', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginTop: 2 }}>
                            <Text style={{ color: '#fff', fontSize: 9, fontWeight: '900' }}>AİLE</Text>
                        </View>
                    ) : <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: isFamilyChat ? '#ec4899' : (is_online ? '#10b981' : theme.colors.textSecondary),
                            marginRight: 4
                        }} />
                        <Text style={{ color: is_online ? '#10b981' : theme.colors.textSecondary, fontSize: 11, fontWeight: '700' }}>
                            {is_online ? 'Çevrimiçi' : 'Çevrimdışı'}
                        </Text>
                    </View>}
                </TouchableOpacity>
            ),
            headerLeft: () => (
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginLeft: 10, padding: 5 }}>
                    <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
                </TouchableOpacity>
            ),
            headerRight: () => isFamilyChat ? null : (
                <TouchableOpacity 
                    onPress={() => navigation.navigate('OperatorProfile', { operator: { id: operatorId, name: partnerName || name, avatar_url: partnerAvatar || avatar_url, is_online, vip_level }, user })} 
                    style={{ marginRight: 10 }}
                >
                    <VipFrame
                        avatar={partnerAvatar || avatar_url}
                        level={vip_level}
                        size={40}
                        isStatic={true}
                    />
                </TouchableOpacity>
            ),
            headerStyle: {
                backgroundColor: 'transparent',
                elevation: 0,
                shadowOpacity: 0,
            },
            headerTintColor: theme.colors.text,
            headerBackVisible: false,
        });
    }, [navigation, showOptions, partnerName, partnerAvatar, name, is_online, avatar_url, operatorId, user, vip_level, nobility_key, nobility_name, nobility_name_color, isFamilyChat]);

    // Initialize Chat
    useEffect(() => {
        if (!socket && !isFamilyChat) return;

        let active = true;

        if (isFamilyChat && familyId) {
            const loadFamilyChat = async () => {
                try {
                    const token = await AsyncStorage.getItem('token');
                    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
                    const [balanceRes, historyRes] = await Promise.all([
                        axios.get(`${API_URL}/users/${user.id}`, authHeader).catch(() => ({ data: {} })),
                        axios.get(`${API_URL}/families/${familyId}/chat`, authHeader)
                    ]);

                    if (!active) return;

                    if (balanceRes.data && balanceRes.data.balance !== undefined) {
                        setCurrentBalance(balanceRes.data.balance);
                    }

                    const familyMessages = historyRes.data.map(msg => ({
                        id: `family-${msg.id}`,
                        family_message_id: msg.id,
                        chat_id: `family-${familyId}`,
                        sender_id: msg.sender_id,
                        content: msg.message,
                        type: 'text',
                        content_type: 'text',
                        created_at: msg.created_at,
                        avatar_url: msg.avatar_url,
                        sender_name: msg.display_name || msg.username
                    })).reverse();

                    setMessages(familyMessages);
                    setIsLoading(false);
                } catch (err) {
                    console.error('[ChatScreen] loadFamilyChat Error:', err);
                    if (active) setIsLoading(false);
                }
            };

            loadFamilyChat();
            return () => {
                active = false;
            };
        }

        if (!chatId) {
            // Case 1: chatId is missing. Fetch/create it first.
            const getOrCreateChat = async () => {
                try {
                    const token = await AsyncStorage.getItem('token');
                    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
                    let activeUserId = user?.id;
                    if (!activeUserId) {
                        const localUserStr = await AsyncStorage.getItem('user');
                        if (localUserStr) activeUserId = JSON.parse(localUserStr).id;
                    }
                    if (!activeUserId) {
                        if (active) setIsLoading(false);
                        return;
                    }
                    const chatRes = await axios.post(`${API_URL}/chats`, {
                        userId: activeUserId,
                        operatorId: operatorId
                    }, authHeader);
                    const realId = chatRes.data.id;
                    console.log('[ChatScreen] Fetched/Created chatId:', realId);
                    if (active) {
                        setChatId(realId);
                    }
                } catch (err) {
                    console.error('[ChatScreen] getOrCreateChat Error:', err);
                    if (active) {
                        setIsLoading(false);
                    }
                }
            };
            getOrCreateChat();
            return () => {
                active = false;
            };
        }

        // Case 2: chatId is available. Load latest page and bind scoped socket listeners.
        socketRef.current = socket;
        const roomStr = chatId.toString();

        const trackLiveAnimationId = (id) => {
            const key = String(id);
            liveAnimatedIdsRef.current.add(key);
            if (liveAnimatedIdsRef.current.size > 10) {
                const oldestKey = liveAnimatedIdsRef.current.values().next().value;
                liveAnimatedIdsRef.current.delete(oldestKey);
            }
        };

        const syncMissedMessagesAfterReconnect = async () => {
            if (!active || !initialLoadedRef.current) return;
            try {
                const token = await AsyncStorage.getItem('token');
                const authHeader = { headers: { Authorization: `Bearer ${token}` } };
                const latestRes = await axios.get(`${API_URL}/messages/${chatId}?limit=${PAGE_SIZE}&offset=0`, authHeader);
                if (!active || !Array.isArray(latestRes.data)) return;
                const latestDesc = [...latestRes.data].reverse();
                let addedCount = 0;
                setMessages(prev => {
                    const existingIds = new Set(prev.map(m => String(m.id)));
                    const missed = latestDesc.filter(m => !existingIds.has(String(m.id)));
                    if (missed.length === 0) return prev;
                    addedCount = missed.length;
                    missed.forEach(m => trackLiveAnimationId(m.id));
                    const cleanedPrev = prev.filter(m => !(
                        m.is_optimistic &&
                        missed.some(s =>
                            String(s.sender_id) === String(m.sender_id) &&
                            s.content === m.content &&
                            Math.abs(new Date(s.created_at) - new Date(m.created_at)) < 15000
                        )
                    ));
                    return [...missed, ...cleanedPrev].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                });
                if (addedCount > 0) {
                    newLiveServerCountRef.current += addedCount;
                }
            } catch (syncErr) {
                console.log('[SOCKET] Reconnect sync error:', syncErr.message);
            }
        };

        const handleSocketConnect = () => {
            console.log('[SOCKET] Connected/Reconnected. Joining room:', roomStr);
            socket.emit('join_room', roomStr);
            syncMissedMessagesAfterReconnect();
        };

        const handleReceiveMessage = (msg) => {
            console.log('[SOCKET] receive_message on Mobile:', msg.id, 'for chatId:', msg.chat_id, 'type:', msg.type || msg.content_type, 'content:', (msg.content || '').substring(0, 60), 'duration:', msg.duration, 'Current chatId:', chatId);

            if (msg.tempId && pendingAckResolversRef.current.has(msg.tempId)) {
                const resolveAck = pendingAckResolversRef.current.get(msg.tempId);
                resolveAck?.();
            }

            if (msg.chat_id && chatId && msg.chat_id.toString() !== chatId.toString()) {
                console.warn('[SOCKET] Received message for different chat! Ignoring.');
                return;
            }

            setMessages(prev => {
                const exists = prev.some(m => String(m.id) === String(msg.id));
                if (exists) return prev;

                let newMessages = [...prev];
                let updated = false;

                if (msg.tempId) {
                    const optimisticIndex = newMessages.findIndex(m => m.id === msg.tempId);
                    if (optimisticIndex !== -1) {
                        const stableKey = newMessages[optimisticIndex]._clientKey || newMessages[optimisticIndex].id;
                        newMessages[optimisticIndex] = { ...msg, _clientKey: stableKey };
                        updated = true;
                    }
                } else {
                    const optimisticIndex = newMessages.findIndex(m =>
                        m.is_optimistic &&
                        m.content === msg.content &&
                        m.type === msg.type &&
                        Math.abs(new Date(m.created_at) - new Date(msg.created_at)) < 5000
                    );
                    if (optimisticIndex !== -1) {
                        const stableKey = newMessages[optimisticIndex]._clientKey || newMessages[optimisticIndex].id;
                        newMessages[optimisticIndex] = { ...msg, _clientKey: stableKey };
                        updated = true;
                    }
                }

                if (!updated) {
                    trackLiveAnimationId(msg.id);
                    newMessages = [msg, ...newMessages];
                }
                newLiveServerCountRef.current += 1;

                // Optimistic Reply Update: If the operator sent a message, mark the customer's last message as replied
                const isFromMe = msg.sender_id == user.id;
                if (isFromMe && isOperator) {
                    const lastCustomerIndex = newMessages.findIndex(m => m.sender_id != user.id && m.content_type !== 'gift');
                    if (lastCustomerIndex !== -1 && !newMessages[lastCustomerIndex].is_replied) {
                        let potential = 43.5;
                        if (msg.type === 'image' || msg.content_type === 'image') potential = 217.5;
                        else if (msg.type === 'audio' || msg.content_type === 'audio') potential = 130.5;

                        newMessages[lastCustomerIndex] = {
                            ...newMessages[lastCustomerIndex],
                            is_replied: true,
                            earned_diamonds: potential
                        };
                    }
                }

                return newMessages;
            });
        };

        const handleMessageError = (data) => {
            console.log('[SOCKET] Message Error:', data);
            if (data.tempId && pendingAckResolversRef.current.has(data.tempId)) {
                const resolveAck = pendingAckResolversRef.current.get(data.tempId);
                resolveAck?.();
            }
            if (data.tempId) {
                setMessages(prev => prev.filter(m => m.id !== data.tempId));
            }
            if (data.code === 'INSUFFICIENT_FUNDS') {
                handleInsufficientCoins();
            } else {
                const errorMsg = data.debug ? `${data.message}\n(Hata: ${data.debug})` : (data.message || 'Mesaj gönderilemedi.');
                showAlert({ title: 'Hata', message: errorMsg, type: 'error' });
            }
        };

        const handleBalanceUpdate = (data) => {
            console.log('[SOCKET] Balance Update received:', data);
            if (data.userId === user.id || data.id === user.id) {
                setCurrentBalance(data.newBalance);
            }
        };

        const handleMessageReaction = (data) => {
            console.log('[SOCKET] Reaction received:', data);
            setMessages(prev => prev.map(m =>
                m.id === data.messageId ? { ...m, reaction: data.reaction } : m
            ));
        };

        const handleMessageUpdated = (data) => {
            console.log('[SOCKET] Message Update received:', data);
            if (data && data.id) {
                setMessages(prev => prev.map(m =>
                    (m.id && m.id.toString().toLowerCase() === data.id.toString().toLowerCase())
                        ? { ...m, is_replied: data.is_replied, earned_diamonds: data.earned_diamonds }
                        : m
                ));
            }
        };

        const handleDisplayTyping = (data) => {
            console.log('[SOCKET] display_typing received on Mobile:', data, 'Current chatId:', chatId);
            const incomingChatId = data.chatId ? data.chatId.toString() : '';
            const incomingUserId = data.userId ? data.userId.toString() : '';
            const myId = user?.id ? user.id.toString() : '';
            const myChatId = chatId ? chatId.toString() : '';

            if (incomingChatId === myChatId && incomingUserId !== myId) {
                console.log('[ChatScreen] Showing Typing Indicator');
                setIsTyping(true);
            }
        };

        const handleHideTyping = (data) => {
            console.log('[SOCKET] hide_typing received on Mobile:', data);
            const incomingChatId = data.chatId ? data.chatId.toString() : '';
            const myChatId = chatId ? chatId.toString() : '';
            if (incomingChatId === myChatId) {
                setIsTyping(false);
            }
        };

        socket.on('connect', handleSocketConnect);
        socket.on('receive_message', handleReceiveMessage);
        socket.on('message_error', handleMessageError);
        socket.on('balance_update', handleBalanceUpdate);
        socket.on('message_reaction', handleMessageReaction);
        socket.on('message_updated', handleMessageUpdated);
        socket.on('display_typing', handleDisplayTyping);
        socket.on('hide_typing', handleHideTyping);

        if (socket.connected) {
            console.log('[SOCKET] Reusing global persistent socket. Joining Room:', roomStr);
            socket.emit('join_room', roomStr);
        } else {
            socket.connect?.();
        }

        const loadChatData = async () => {
            initialLoadedRef.current = false;
            loadedHistoryOffsetRef.current = 0;
            newLiveServerCountRef.current = 0;
            loadingOlderRef.current = false;
            setLoadingOlder(false);
            hasMoreMessagesRef.current = true;
            setHasMoreMessages(true);
            liveAnimatedIdsRef.current.clear();

            try {
                const token = await AsyncStorage.getItem('token');
                const authHeader = { headers: { Authorization: `Bearer ${token}` } };

                let activeUserId = user?.id;
                if (!activeUserId) {
                    const localUserStr = await AsyncStorage.getItem('user');
                    if (localUserStr) activeUserId = JSON.parse(localUserStr).id;
                }

                const [balanceRes, historyRes, readRes, inviteRes] = await Promise.all([
                    activeUserId ? axios.get(`${API_URL}/users/${activeUserId}`, authHeader).catch(() => ({ data: {} })) : Promise.resolve({ data: {} }),
                    axios.get(`${API_URL}/messages/${chatId}?limit=${PAGE_SIZE}&offset=0`, authHeader),
                    activeUserId ? axios.put(`${API_URL}/chats/${chatId}/read`, { userId: activeUserId }, authHeader).catch(() => ({ data: {} })) : Promise.resolve({ data: {} }),
                    AGENCY_SYSTEM_ENABLED ? axios.get(`${API_URL}/agency/my-invitations`, authHeader).catch(() => ({ data: [] })) : Promise.resolve({ data: [] })
                ]);

                if (!active) return;

                if (activeUserId) {
                    fetchUnreadCount(activeUserId);
                }

                if (balanceRes.data && balanceRes.data.balance !== undefined) {
                    setCurrentBalance(balanceRes.data.balance);
                }

                const rawRows = Array.isArray(historyRes.data) ? historyRes.data : [];
                loadedHistoryOffsetRef.current = rawRows.length;
                const moreAvailable = rawRows.length >= PAGE_SIZE;
                hasMoreMessagesRef.current = moreAvailable;
                setHasMoreMessages(moreAvailable);

                let chatMessages = [...rawRows].reverse();

                // Check pending invitations
                if (inviteRes && inviteRes.data && inviteRes.data.length > 0) {
                    const matchingInvite = inviteRes.data.find(inv => inv.owner_id?.toString() === operatorId?.toString());
                    if (matchingInvite) {
                        setPendingAgencyInvite(matchingInvite);
                        const fakeMsg = {
                            id: `agency-invite-${matchingInvite.id}`,
                            chat_id: chatId,
                            sender_id: operatorId,
                            content: matchingInvite.agency_name,
                            agency_name: matchingInvite.agency_name,
                            invite_id: matchingInvite.id,
                            type: 'agency_invite',
                            is_agency_invite: true,
                            created_at: matchingInvite.created_at || new Date().toISOString()
                        };
                        chatMessages = [fakeMsg, ...chatMessages];
                        chatMessages.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                    }
                }

                setMessages(chatMessages);
                initialLoadedRef.current = true;
                setIsLoading(false);
            } catch (err) {
                console.error('[ChatScreen] Init Error:', err);
                if (active) setIsLoading(false);
            }
        };

        loadChatData();

        return () => {
            active = false;
            console.log('[SOCKET] Leaving room and clearing scoped listeners for chatId:', chatId);
            socket.emit('leave_room', roomStr);
            socket.off('connect', handleSocketConnect);
            socket.off('receive_message', handleReceiveMessage);
            socket.off('message_error', handleMessageError);
            socket.off('balance_update', handleBalanceUpdate);
            socket.off('message_reaction', handleMessageReaction);
            socket.off('message_updated', handleMessageUpdated);
            socket.off('display_typing', handleDisplayTyping);
            socket.off('hide_typing', handleHideTyping);
            pendingAckResolversRef.current.forEach(resolveAck => resolveAck?.());
            pendingAckResolversRef.current.clear();
        };
    }, [chatId, socket, isFamilyChat, familyId]);

    const loadOlderMessages = React.useCallback(async () => {
        if (isFamilyChat || !chatId || !initialLoadedRef.current || loadingOlderRef.current || !hasMoreMessagesRef.current) return;
        loadingOlderRef.current = true;
        setLoadingOlder(true);
        try {
            const token = await AsyncStorage.getItem('token');
            const authHeader = { headers: { Authorization: `Bearer ${token}` } };
            if (!initialLoadedRef.current || !hasMoreMessagesRef.current) return;
            const requestOffset = loadedHistoryOffsetRef.current + newLiveServerCountRef.current;
            const res = await axios.get(`${API_URL}/messages/${chatId}?limit=${PAGE_SIZE}&offset=${requestOffset}`, authHeader);
            const olderRows = Array.isArray(res.data) ? res.data : [];

            if (olderRows.length < PAGE_SIZE) {
                hasMoreMessagesRef.current = false;
                setHasMoreMessages(false);
            }
            loadedHistoryOffsetRef.current += olderRows.length;

            if (olderRows.length > 0) {
                const olderDesc = [...olderRows].reverse();
                setMessages(prev => {
                    const existingIds = new Set(prev.map(m => String(m.id)));
                    const deduped = olderDesc.filter(m => !existingIds.has(String(m.id)));
                    return deduped.length > 0 ? [...prev, ...deduped] : prev;
                });
            }
        } catch (err) {
            console.log('[ChatScreen] Pagination load error:', err.message);
        } finally {
            loadingOlderRef.current = false;
            setLoadingOlder(false);
        }
    }, [chatId, isFamilyChat]);

    const handleTyping = (text) => {
        inputTextRef.current = text;
        // Uncontrolled composer: avoid re-rendering 3k-line ChatScreen on every keystroke.

        if (isFamilyChat) return;

        if (!socketRef.current) {
            console.log('[ChatScreen] socketRef.current is null, cannot emit typing');
            return;
        }

        if (text.length > 0) {
            console.log(`[ChatScreen] Emitting typing_start for chatId: ${chatId}`);
            socketRef.current.emit('typing_start', { chatId });

            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

            typingTimeoutRef.current = setTimeout(() => {
                console.log(`[ChatScreen] Emitting typing_end (timeout) for chatId: ${chatId}`);
                socketRef.current.emit('typing_end', { chatId });
            }, 2000);
        } else {
            console.log(`[ChatScreen] Emitting typing_end (empty) for chatId: ${chatId}`);
            socketRef.current.emit('typing_end', { chatId });
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        }
    };

    const handleUnlockImage = async (msg) => {
        console.log('[ChatScreen] handleUnlockImage triggered for msg:', msg?.id);
        if (!msg || !msg.id) {
            showAlert({ title: 'Hata', message: 'Geçersiz fotoğraf mesajı.', type: 'error' });
            return;
        }

        const cost = Number(msg.unlock_cost) || 200;
        console.log(`[ChatScreen] Unlock image check - balance: ${currentBalance}, cost: ${cost}`);

        if (currentBalance < cost) {
            setTimeout(() => {
                handleInsufficientCoins();
            }, 300);
            return;
        }

        try {
            const token = await AsyncStorage.getItem('token');
            const res = await axios.post(`${API_URL}/messages/${msg.id}/unlock`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            console.log('[ChatScreen] Unlock API res:', res.data);

            if (res.data && res.data.success) {
                setMessages(prev => prev.map(m => 
                    (m.id?.toString() === msg.id?.toString() || String(m.id) === String(msg.id))
                        ? { ...m, is_unlocked: true }
                        : m
                ));
                setCurrentBalance(prev => Math.max(0, prev - cost));
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else {
                showAlert({ title: 'Hata', message: res.data?.error || 'Fotoğraf açılamadı.', type: 'error' });
            }
        } catch (error) {
            console.error('[ChatScreen] Unlock image error:', error.response?.data || error.message);
            if (error.response?.data?.code === 'INSUFFICIENT_FUNDS' || error.response?.data?.insufficientFunds) {
                setTimeout(() => {
                    handleInsufficientCoins();
                }, 300);
            } else {
                showAlert({ title: 'Hata', message: error.response?.data?.error || 'Fotoğraf açılamadı.', type: 'error' });
            }
        }
    };

    const confirmUnlock = (msg) => {
        const cost = Number(msg.unlock_cost) || 200;
        showAlert({
            title: "Kilitli Fotoğraf 🔒",
            message: `Bu fotoğrafı görmek için ${cost} Coin ödemek istiyor musunuz?`,
            type: 'info',
            showCancel: true,
            cancelText: "Vazgeç",
            confirmText: "Aç",
            onConfirm: () => {
                setTimeout(() => {
                    handleUnlockImage(msg);
                }, 200);
            }
        });
    };

    const clearComposerInput = () => {
        const inputView = textInputRef.current;
        if (!inputView) return;
        const nextClearEventCount = (lastInputEventCountRef.current || 0) + 1000;
        const node = findNodeHandle(inputView);
        if (node) {
            UIManager.dispatchViewManagerCommand(node, 'setTextAndSelection', [nextClearEventCount, '', 0, 0]);
        } else {
            inputView.clear?.();
        }
    };

    const sendMessage = (textOrEvent) => {
        const rawText = typeof textOrEvent === 'string' ? textOrEvent : inputTextRef.current;
        if (!rawText || typeof rawText !== 'string' || rawText.trim() === '' || !chatId) return;
        const textToSend = rawText;

        if (typeof textOrEvent !== 'string') {
            inputTextRef.current = '';
            clearComposerInput();
            // Native composer reset runs in clearComposerInput() above.
            // setNativeProps skipped: stale React eventCount would be dropped by ReactEditText.
        }
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
        }
        if (!isFamilyChat && socketRef.current?.connected) {
            socketRef.current.emit('typing_end', { chatId });
        }

        if (isFamilyChat) {
            const tempId = `family-temp-${Date.now()}-${++tempSeqRef.current}`;
            const optimisticMsg = {
                id: tempId,
                _clientKey: tempId,
                chat_id: `family-${familyId}`,
                sender_id: user.id,
                content: textToSend,
                type: 'text',
                content_type: 'text',
                created_at: new Date().toISOString(),
                is_optimistic: true
            };

            liveAnimatedIdsRef.current.add(tempId);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setTimeout(() => setMessages(prev => [optimisticMsg, ...prev]), 0);

            sendQueueRef.current = sendQueueRef.current
                .catch(() => {})
                .then(async () => {
                    try {
                        const token = await AsyncStorage.getItem('token');
                        const res = await axios.post(`${API_URL}/families/${familyId}/chat`, { message: textToSend }, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        const savedMsg = {
                            id: `family-${res.data.id}`,
                            _clientKey: tempId,
                            family_message_id: res.data.id,
                            chat_id: `family-${familyId}`,
                            sender_id: res.data.sender_id,
                            content: res.data.message,
                            type: 'text',
                            content_type: 'text',
                            created_at: res.data.created_at,
                            avatar_url: res.data.avatar_url,
                            sender_name: res.data.display_name || res.data.username
                        };
                        setMessages(prev => prev.map(m => m.id === tempId ? savedMsg : m));
                    } catch (err) {
                        setMessages(prev => prev.filter(m => m.id !== tempId));
                        showAlert({ title: 'Hata', message: err.response?.data?.error || 'Mesaj gönderilemedi.', type: 'error' });
                    }
                });

            return;
        }

        // SOCKET CHECK
        if (!socketRef.current) {
            showAlert({
                title: 'Bağlantı Hatası',
                message: 'Sunucu ile bağlantı kurulamadı. Lütfen internetinizi kontrol edin veya birazdan tekrar deneyin.',
                type: 'error'
            });
            console.error('[ChatScreen] Socket is not initialized!');
            return;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        // Balance check is server-side — message_error with INSUFFICIENT_FUNDS triggers handleInsufficientCoins

        const tempId = `tmp_${Date.now()}_${++tempSeqRef.current}`;
        liveAnimatedIdsRef.current.add(tempId);
        if (liveAnimatedIdsRef.current.size > 10) {
            const oldestKey = liveAnimatedIdsRef.current.values().next().value;
            liveAnimatedIdsRef.current.delete(oldestKey);
        }

        const optimisticMsg = {
            id: tempId,
            _clientKey: tempId,
            chat_id: chatId,
            sender_id: user.id,
            content: textToSend,
            type: 'text',
            created_at: new Date().toISOString(),
            is_optimistic: true
        };

        setTimeout(() => setMessages(prev => [optimisticMsg, ...prev]), 0);

        const msgData = {
            chatId: chatId,
            senderId: user.id,
            content: textToSend,
            type: 'text',
            tempId: tempId
        };

        sendQueueRef.current = sendQueueRef.current
            .catch(() => {})
            .then(() => new Promise((resolve) => {
                const activeSocket = socketRef.current;
                if (!activeSocket) {
                    resolve();
                    return;
                }
                if (!activeSocket.connected) {
                    activeSocket.connect?.();
                }
                let settled = false;
                const timer = setTimeout(() => {
                    if (!settled) {
                        settled = true;
                        pendingAckResolversRef.current.delete(tempId);
                        resolve();
                    }
                }, 3500);
                pendingAckResolversRef.current.set(tempId, () => {
                    if (!settled) {
                        settled = true;
                        clearTimeout(timer);
                        pendingAckResolversRef.current.delete(tempId);
                        resolve();
                    }
                });
                activeSocket.emit('send_message', msgData);
            }));
    };

    const handleSendGift = (gift, quantity = 1) => {
        if (!chatId) return;

        const totalCost = gift.price * quantity;

        if (currentBalance < totalCost) {
            setShowGiftModal(false);
            handleInsufficientCoins();
            return;
        }

        // Show Fullscreen Animation
        setActiveGift(gift);
        setShowGiftModal(false);

        const tempId = Date.now().toString();
        const optimisticMsg = {
            id: tempId,
            chat_id: chatId,
            sender_id: user.id,
            content: quantity > 1 ? `${gift.name} (x${quantity})` : gift.name,
            type: 'gift',
            gift_id: gift.id,
            quantity: quantity,
            created_at: new Date().toISOString(),
            is_optimistic: true
        };
        setTimeout(() => setMessages(prev => [optimisticMsg, ...prev]), 0);

        const msgData = {
            chatId: chatId,
            senderId: user.id,
            content: quantity > 1 ? `${gift.name} (x${quantity})` : gift.name,
            type: 'gift',
            tempId: tempId,
            giftId: gift.id,
            quantity: quantity
        };

        socketRef.current?.emit('send_message', msgData);
    };

    // --- MEDIA SHARING LOGIC ---
    const handleSendImage = async () => {
        // Enforce balance checking ONLY for male customers (non-operators) who are not premium
        if (!isOperator && !isPremiumMember && currentBalance < 50 && (user.vip_level || 0) < 1) {
            handleInsufficientCoins();
            return;
        }

        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            showAlert({ title: 'İzin Gerekli', message: 'Galeriye erişim izni vermelisiniz.', type: 'warning' });
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.7,
        });

        if (!result.canceled) {
            const uri = result.assets[0].uri;
            if (isOperator) {
                // Operators choose pricing via locked image sheet before upload
                setSelectedImageUri(uri);
                setUnlockCostSelection(100); // Default pricing
                setShowImageLockModal(true);
            } else {
                uploadAndSendImage(uri, false, 0);
            }
        }
    };
    const uploadAndSendImage = async (uri, isLocked = false, unlockCost = 0) => {
        try {
            const formData = new FormData();
            formData.append('file', {
                uri: uri,
                type: 'image/jpeg',
                name: 'chat_upload.jpg',
            });

            const token = await AsyncStorage.getItem('token');
            const res = await axios.post(`${API_URL}/media-upload`, formData, {
                headers: { 
                    'Content-Type': 'multipart/form-data',
                    'Authorization': `Bearer ${token}`
                },
            });

            const imageUrl = res.data.url || `${API_URL}${res.data.relativePath}`; // Handle both formats if flexible

            const tempId = Date.now().toString();
            const optimisticMsg = {
                id: tempId,
                chat_id: chatId,
                sender_id: user.id,
                content: imageUrl,
                type: isLocked ? 'locked_image' : 'image',
                content_type: isLocked ? 'locked_image' : 'image',
                unlock_cost: unlockCost,
                is_unlocked: !isLocked, // it is always unlocked for the sender!
                created_at: new Date().toISOString(),
                is_optimistic: true
            };
            setTimeout(() => setMessages(prev => [optimisticMsg, ...prev]), 0);

            const msgData = {
                chatId: chatId,
                senderId: user.id,
                content: imageUrl,
                type: isLocked ? 'locked_image' : 'image',
                tempId: tempId,
                unlockCost: unlockCost
            };
            socketRef.current?.emit('send_message', msgData);

        } catch (error) {
            console.error('Upload Error:', error);
            showAlert({ title: 'Hata', message: 'Resim gönderilemedi.', type: 'error' });
        }
    };


    // --- VOICE MESSAGE LOGIC ---
    const startRecording = async () => {
        // Balance validation is handled server-side via message_error -> INSUFFICIENT_FUNDS
        // Do not check currentBalance here as it may be stale (0) before API load completes
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            if (recordingRef.current) {
                try { await recordingRef.current.stopAndUnloadAsync(); } catch (e) {}
                recordingRef.current = null;
            }
            const permission = await Audio.requestPermissionsAsync();
            if (permission.status !== 'granted') {
                showAlert({ title: 'İzin Gerekli', message: 'Mikrofon izni vermelisiniz.', type: 'warning' });
                return;
            }
            await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
            const { recording: newRecording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
            setRecording(newRecording);
            recordingRef.current = newRecording;
            setIsRecording(true);
            isRecordingRef.current = true;
            setIsCancelling(false);
            isCancellingRef.current = false;
            slideAnim.setValue(0);
            startTimeRef.current = Date.now();
            startXRef.current = 0;

            let seconds = 0;
            setRecordTime('0:00');
            if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
            timerRef.current = setInterval(() => {
                seconds += 1;
                const mins = Math.floor(seconds / 60);
                const secs = seconds % 60;
                setRecordTime(mins + ':' + (secs < 10 ? '0' : '') + secs);
            }, 1000);

            Animated.loop(Animated.sequence([
                Animated.timing(blinkAnim, { toValue: 0.3, duration: 500, useNativeDriver: true }),
                Animated.timing(blinkAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
            ])).start();
            Animated.loop(Animated.sequence([
                Animated.timing(waveAnim, { toValue: 1, duration: 400, useNativeDriver: false }),
                Animated.timing(waveAnim, { toValue: 0, duration: 400, useNativeDriver: false }),
            ])).start();
        } catch (err) {
            console.error('Failed to start recording', err);
            if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
            setIsRecording(false);
            isRecordingRef.current = false;
        }
    };

    const handleRecordingMove = (event) => {
        if (!isRecordingRef.current) return;
        const { pageX } = event.nativeEvent;
        if (startXRef.current === 0) { startXRef.current = pageX; }
        if (pageX > 160) {
            if (!isCancellingRef.current) {
                isCancellingRef.current = true;
                setIsCancelling(true);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            }
        } else if (pageX < 100) {
            if (isCancellingRef.current) {
                isCancellingRef.current = false;
                setIsCancelling(false);
            }
        }
        slideAnim.setValue(Math.max(0, pageX - startXRef.current));
    };

    const stopRecording = async () => {
        const toStop = recordingRef.current;
        if (!toStop) return;

        const wasCancelling = isCancellingRef.current;
        const duration = Date.now() - startTimeRef.current;

        // Clear timer immediately
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        blinkAnim.stopAnimation(); blinkAnim.setValue(1);
        waveAnim.stopAnimation(); waveAnim.setValue(0);
        setRecording(null);
        recordingRef.current = null;
        setIsRecording(false);
        isRecordingRef.current = false;
        setIsCancelling(false);
        isCancellingRef.current = false;
        slideAnim.setValue(0);
        setRecordTime('0:00');

        try {
            await toStop.stopAndUnloadAsync();
            if (wasCancelling) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                return;
            }
            if (duration < 1000) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                showAlert({ title: 'Kısa Kayıt', message: 'Ses çok kısa, en az 1 saniye olmalı.', type: 'warning' });
                return;
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            const uri = toStop.getURI();
            const durationSec = Math.max(1, Math.round(duration / 1000));
            const mins = Math.floor(durationSec / 60);
            const secs = durationSec % 60;
            const durationStr = mins + ':' + (secs < 10 ? '0' : '') + secs;
            uploadAndSendAudio(uri, durationStr);
        } catch (err) {
            console.error('Stop Recording Error:', err);
        }
    };

    const uploadAndSendAudio = async (uri, durationStr) => {
        if (!chatId) return;
        if (!socketRef.current) {
            showAlert({ title: 'Bağlantı Hatası', message: 'Sunucu bağlantısı yok.', type: 'error' });
            return;
        }
        try {
            const formData = new FormData();
            formData.append('file', { uri: uri, type: 'audio/m4a', name: 'voice_message.m4a' });
            const token = await AsyncStorage.getItem('token');
            const res = await axios.post(API_URL + '/media-upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data', 'Authorization': 'Bearer ' + token },
            });
            // Strip /api suffix from base URL for file uploads (they live at root /uploads/...)
            const baseUrl = API_URL.replace(/\/api$/, '');
            const audioUrl = res.data.url || (baseUrl + res.data.relativePath);
            const tempId = Date.now().toString();
            setMessages(prev => [{
                id: tempId, chat_id: chatId, sender_id: user.id,
                content: audioUrl, type: 'audio', content_type: 'audio',
                duration: durationStr, created_at: new Date().toISOString(), is_optimistic: true
            }, ...prev]);
            socketRef.current && socketRef.current.emit('send_message', {
                chatId: chatId, senderId: user.id, content: audioUrl,
                type: 'audio', tempId: tempId, duration: durationStr
            });
        } catch (error) {
            console.error('Audio Upload Error:', error);
            showAlert({ title: 'Hata', message: 'Ses gönderilemedi.', type: 'error' });
        }
    };


    const resolveAudioUrl = (url) => {
        if (!url || typeof url !== 'string') return null;
        const trimmed = url.trim();

        // Local device file (recorded audio on device) - pass through as-is
        if (trimmed.startsWith('file://')) {
            return trimmed;
        }

        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
            // Remap localhost/emulator to device-accessible address
            const isLocal =
                trimmed.includes('localhost') ||
                trimmed.includes('127.0.0.1') ||
                trimmed.includes('10.0.2.2') ||
                trimmed.includes('192.168.');
            if (isLocal) {
                const parts = trimmed.split('/');
                if (parts.length > 3) {
                    const relativePart = '/' + parts.slice(3).join('/');
                    const baseUrl = API_URL.replace('/api', '');
                    return baseUrl + relativePart;
                }
            }

            // For Cloudinary audio/video URLs: add fl_attachment to force direct download
            if (trimmed.includes('res.cloudinary.com') && trimmed.includes('/video/upload/')) {
                return trimmed.replace('/video/upload/', '/video/upload/fl_attachment/');
            }

            return trimmed;
        }

        // Relative path
        const baseUrl = API_URL.replace('/api', '');
        return baseUrl + (trimmed.startsWith('/') ? trimmed : '/' + trimmed);
    };


    const playAudioRef = useRef(null);
    playAudioRef.current = async (uri) => {
        if (!uri || typeof uri !== 'string') return;
        if (uri.startsWith('[') || uri.startsWith('call_') || uri.includes('Sesli Arama') || uri.includes('Görüntülü Arama')) {
            return;
        }

        try {
            // Stop currently playing sound
            if (sound) {
                await sound.unloadAsync().catch(() => {});
                setSound(null);
                if (currentPlayingUri === uri) {
                    setCurrentPlayingUri(null);
                    return;
                }
            }

            const resolved = resolveAudioUrl(uri);
            if (!resolved) return;

            console.log('[Audio] Playing:', resolved);

            // Switch audio mode to playback
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true,
            });

            // Pre-check: verify URL returns audio (not HTML/404 page)
            try {
                const checkRes = await fetch(resolved, { method: 'HEAD' });
                const contentType = checkRes.headers.get('content-type') || '';
                if (contentType.includes('text/html')) {
                    showAlert({ title: 'Ses Dosyası Bulunamadı', message: 'Bu ses dosyası artık sunucuda mevcut değil.', type: 'error' });
                    return;
                }
            } catch (headErr) {
                // HEAD request failed, try playback anyway
            }

            const { sound: newSound, status } = await Audio.Sound.createAsync(
                {
                    uri: resolved,
                    overrideFileExtensionAndroid: 'm4a',
                    headers: { Accept: 'audio/*' },
                },
                { shouldPlay: true }
            );

            if (status && status.durationMillis) {
                const totalSec = Math.round(status.durationMillis / 1000);
                const m = Math.floor(totalSec / 60);
                const s = String(totalSec % 60).padStart(2, '0');
                const formatted = `${m}:${s}`;
                setAudioDurations((prev) => ({ ...prev, [uri]: formatted }));
            }

            setSound(newSound);
            setCurrentPlayingUri(uri);

            newSound.setOnPlaybackStatusUpdate(async (status) => {
                if (status.durationMillis) {
                    const totalSec = Math.round(status.durationMillis / 1000);
                    const m = Math.floor(totalSec / 60);
                    const s = String(totalSec % 60).padStart(2, '0');
                    const formatted = `${m}:${s}`;
                    setAudioDurations((prev) => ({ ...prev, [uri]: formatted }));
                }
                if (status.didJustFinish) {
                    setCurrentPlayingUri(null);
                    await newSound.unloadAsync().catch(() => {});
                    setSound(null);
                }
            });
        } catch (error) {
            console.error('Playback Error:', error);
            setCurrentPlayingUri(null);
            setSound(null);
        }
    };
    const playAudio = React.useCallback((uri) => playAudioRef.current?.(uri), []);

    const handleSelectVoice = (voice) => {
        sendMessage(`[Sesli Mesaj: ${voice.title}]`);
        showAlert({ title: 'Hızlı Ses', message: 'Sesli mesaj gönderildi.', type: 'info' });
    };



    const handleBlock = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            await axios.post(`${API_URL}/block`, {
                blockerId: user.id,
                blockedId: operatorId
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setShowOptions(false);
            navigation.goBack();
            showAlert({ title: 'Engellendi', message: 'Kullanıcı engellendi.', type: 'info' });
        } catch (error) {
            console.error(error);
            showAlert({ title: 'Hata', message: 'Engelleme başarısız.', type: 'error' });
        }
    };

    const getStableWaveform = (seed) => {
        const s = seed ? seed.toString().length : 10;
        return Array.from({ length: 15 }, (_, i) => {
            return Math.abs(Math.sin(s + i * 1.5));
        });
    };

    const getDateKey = (value) => {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    };

    const formatMessageDate = (value) => {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
    };

    const confirmUnlockRef = useRef(null);
    confirmUnlockRef.current = confirmUnlock;
    const stableConfirmUnlock = React.useCallback((msg) => confirmUnlockRef.current?.(msg), []);

    const handlePartnerAvatarPress = React.useCallback(() => {
        navigation.navigate('OperatorProfile', {
            operator: {
                id: operatorId,
                name: partnerName || name,
                avatar_url: partnerAvatar || avatar_url,
                is_online,
                vip_level
            },
            user
        });
    }, [navigation, operatorId, partnerName, name, partnerAvatar, avatar_url, is_online, vip_level, user]);

    const handleBubbleReaction = React.useCallback((type, targetMessageId) => {
        if (!targetMessageId) return;
        socketRef.current?.emit('message_reaction', { messageId: targetMessageId, reaction: type, chatId });
        setMessages(prev => prev.map(m => m.id === targetMessageId ? { ...m, reaction: type } : m));
    }, [socketRef, chatId, setMessages]);

    const renderMessage = React.useCallback(({ item, index }) => {
        const isUser = item.sender_id == user.id;

        if (false && (item.type === 'agency_invite' || item.is_agency_invite)) {
            return (
                <MessageBubble
                    isMine={false}
                    messageId={item.id}
                    animateEntrance={index === 0 && liveAnimatedIdsRef.current.has(String(item._clientKey || item.id))}
                    isRead={item.is_read}
                    avatar={resolveImageUrl(avatar_url)}
                    vipLevel={vip_level}
                    onAvatarPress={() => navigation.navigate('OperatorProfile', { operator: { id: operatorId, name, avatar_url, is_online, vip_level }, user })}
                    timestamp={item.created_at}
                    reaction={item.reaction}
                    onReaction={(type) => {
                        socketRef.current?.emit('message_reaction', { messageId: item.id, reaction: type, chatId });
                        setMessages(prev => prev.map(m => m.id === item.id ? { ...m, reaction: type } : m));
                    }}
                >
                    <GlassCard
                        intensity={45}
                        tint="dark"
                        style={{
                            width: 240,
                            padding: 14,
                            borderRadius: 16,
                            borderColor: 'rgba(236, 72, 153, 0.4)',
                            borderWidth: 1.5,
                            overflow: 'hidden'
                        }}
                    >
                        <LinearGradient
                            colors={['rgba(139, 92, 246, 0.15)', 'rgba(236, 72, 153, 0.15)']}
                            style={StyleSheet.absoluteFill}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        />
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                            <Ionicons name="business" size={18} color="#ec4899" style={{ marginRight: 8 }} />
                            <Text style={{ color: 'white', fontSize: 13, fontWeight: '700', flex: 1 }}>
                                Ajans Daveti ⚡
                            </Text>
                        </View>
                        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginBottom: 12 }}>
                            <Text style={{ fontWeight: 'bold', color: '#ec4899' }}>{item.agency_name}</Text> sizi ajansına katılmaya davet ediyor!
                        </Text>
                        {pendingAgencyInvite && pendingAgencyInvite.id === item.invite_id ? (
                            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
                                <TouchableOpacity 
                                    style={{
                                        paddingHorizontal: 14,
                                        paddingVertical: 6,
                                        borderRadius: 8,
                                        borderWidth: 1,
                                        borderColor: 'rgba(255,255,255,0.2)',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }} 
                                    onPress={() => handleRejectInvitation(item.invite_id)}
                                    activeOpacity={0.8}
                                >
                                    <Text style={{ color: 'white', fontSize: 11, fontWeight: '600' }}>Reddet</Text>
                                </TouchableOpacity>
                                
                                <TouchableOpacity 
                                    style={{
                                        borderRadius: 8,
                                        overflow: 'hidden'
                                    }}
                                    onPress={() => handleAcceptInvitation(item.invite_id)}
                                    activeOpacity={0.8}
                                >
                                    <LinearGradient
                                        colors={['#10b981', '#059669']}
                                        style={{
                                            paddingHorizontal: 18,
                                            paddingVertical: 6,
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                    >
                                        <Text style={{ color: 'white', fontSize: 11, fontWeight: '700' }}>Kabul Et</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }}>
                                <Ionicons name="checkmark-circle" size={16} color="#10b981" style={{ marginRight: 4 }} />
                                <Text style={{ color: '#10b981', fontSize: 11, fontWeight: '700' }}>İşlem Yapıldı</Text>
                            </View>
                        )}
                    </GlassCard>
                </MessageBubble>
            );
        }

        if (item.type === 'gift' || item.content_type === 'gift') {
            const giftId = parseInt(item.gift_id || item.giftId);
            const gift = GIFTS.find(g => g.id === giftId) || { name: item.content || 'Hediye', price: '?' };

            return (
                <MessageBubble 
                    isMine={isUser} 
                    messageId={item.id}
                    animateEntrance={index === 0 && liveAnimatedIdsRef.current.has(String(item._clientKey || item.id))} 
                    isRead={item.is_read}
                    avatar={resolveImageUrl(isUser ? (user.avatar_url || user.avatar) : avatar_url)}
                    vipLevel={isUser ? user.vip_level : vip_level}
                    onAvatarPress={!isUser ? () => navigation.navigate('OperatorProfile', { operator: { id: operatorId, name, avatar_url, is_online, vip_level }, user }) : undefined}
                    timestamp={item.created_at}
                    reaction={item.reaction}
                    onReaction={(type) => {
                        socketRef.current?.emit('message_reaction', { messageId: item.id, reaction: type, chatId });
                        setMessages(prev => prev.map(m => m.id === item.id ? { ...m, reaction: type } : m));
                    }}
                >
                    <View style={styles.giftMessageContent}>
                        <Image
                            source={gift.image || require('../assets/gift_icon.webp')}
                            style={{ width: 80, height: 80, marginBottom: 8 }}
                            resizeMode="contain"
                        />
                        <View style={styles.giftInfo}>
                            <Text style={[styles.giftNameText, { color: theme.colors.text }]}>{gift.name}</Text>
                            <View style={styles.giftPriceBadge}>
                                <Text style={[styles.giftPriceText, { color: theme.colors.text }]}>{gift.price} COIN</Text>
                            </View>
                        </View>
                    </View>
                </MessageBubble>
            );
        }

        let content = <Text style={[styles.messageText, { color: theme.colors.text }]}>{item.content}</Text>;

        if (item.content_type === 'image' || item.type === 'image' || item.content_type === 'locked_image' || item.type === 'locked_image') {
            const isLocked = (item.content_type === 'locked_image' || item.type === 'locked_image') && !item.is_unlocked && !isUser;
            content = (
                <TouchableOpacity 
                    activeOpacity={0.9} 
                    onPress={() => { 
                        if (isLocked) {
                            stableConfirmUnlock(item);
                        } else {
                            setSelectedImage(item.content);
                        }
                    }}
                >
                    <View style={{ position: 'relative' }}>
                        <Image
                            source={{ uri: resolveImageUrl(item.content) }}
                            style={{ width: 220, height: 220, borderRadius: 16, backgroundColor: '#0f172a', opacity: isLocked ? 0.12 : 1 }}
                            resizeMode="cover"
                            blurRadius={isLocked ? 95 : 0}
                        />
                        {isLocked && (
                            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(15, 23, 42, 0.88)', borderRadius: 16 }}>
                                <LinearGradient
                                    colors={['rgba(236, 72, 153, 0.9)', 'rgba(139, 92, 246, 0.95)']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={{ paddingHorizontal: 14, paddingVertical: 12, borderRadius: 20, alignItems: 'center', shadowColor: '#ec4899', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6, width: '85%' }}
                                >
                                    <Ionicons name="lock-closed" size={24} color="#fff" style={{ marginBottom: 6 }} />
                                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 11, textAlign: 'center', lineHeight: 15 }}>
                                        Fotoğrafı görmek için{"\n"}
                                        <Text style={{ fontWeight: '900', fontSize: 13, color: '#fff' }}>{item.unlock_cost || 200} Coin</Text> ile açın
                                    </Text>
                                </LinearGradient>
                            </View>
                        )}
                    </View>
                </TouchableOpacity>
            );
        } else if (item.content_type === 'video' || item.type === 'video' || item.content_type === 'locked_video' || item.type === 'locked_video') {
            const isLocked = (item.content_type === 'locked_video' || item.type === 'locked_video') && !item.is_unlocked && !isUser;
            content = (
                <View style={{ position: 'relative' }}>
                    {isLocked ? (
                        <TouchableOpacity 
                            activeOpacity={0.9} 
                            onPress={() => stableConfirmUnlock(item)}
                        >
                            <View style={{ width: 220, height: 220, borderRadius: 16, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' }}>
                                <Ionicons name="videocam" size={48} color="rgba(255,255,255,0.1)" />
                                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(15, 23, 42, 0.88)', borderRadius: 16 }}>
                                    <LinearGradient
                                        colors={['rgba(236, 72, 153, 0.9)', 'rgba(139, 92, 246, 0.95)']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={{ paddingHorizontal: 14, paddingVertical: 12, borderRadius: 20, alignItems: 'center', shadowColor: '#ec4899', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6, width: '85%' }}
                                    >
                                        <Ionicons name="lock-closed" size={24} color="#fff" style={{ marginBottom: 6 }} />
                                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 11, textAlign: 'center', lineHeight: 15 }}>
                                            Videoyu görmek için{"\n"}
                                            <Text style={{ fontWeight: '900', fontSize: 13, color: '#fff' }}>{item.unlock_cost || 200} Coin</Text> ile açın
                                        </Text>
                                    </LinearGradient>
                                </View>
                            </View>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity activeOpacity={0.9} onPress={() => setSelectedVideo(item.content)}>
                            <View style={{ position: 'relative', width: 220, height: 220 }}>
                                <Video
                                    source={{ uri: resolveImageUrl(item.content) }}
                                    style={{ width: '100%', height: '100%', borderRadius: 16, backgroundColor: '#0f172a' }}
                                    useNativeControls={false}
                                    resizeMode={ResizeMode.COVER}
                                    shouldPlay={false}
                                    isMuted={true}
                                />
                                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 16 }}>
                                    <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }}>
                                        <Ionicons name="play" size={28} color="#fff" style={{ marginLeft: 4 }} />
                                    </View>
                                </View>
                            </View>
                        </TouchableOpacity>
                    )}
                </View>
            );
        } else if (item.content_type === 'audio' || item.type === 'audio') {
            const isPlaying = currentPlayingUri === item.content;
            let rawDuration = audioDurations[item.content] || item.duration;
            let duration = '0:00';

            if (rawDuration && rawDuration !== '0:05' && rawDuration !== '0' && rawDuration !== 0) {
                if (typeof rawDuration === 'number') {
                    const m = Math.floor(rawDuration / 60);
                    const s = String(Math.floor(rawDuration % 60)).padStart(2, '0');
                    duration = `${m}:${s}`;
                } else {
                    duration = String(rawDuration);
                }
            } else if (audioDurations[item.content]) {
                duration = audioDurations[item.content];
            }

            const waveform = item.waveform || getStableWaveform(item.id || index);

            content = (
                <View style={styles.voiceContent}>
                    <TouchableOpacity 
                        onPress={() => playAudio(item.content)}
                        style={styles.voicePlayButton}
                    >
                        <Ionicons 
                            name={isPlaying ? "pause" : "play"} 
                            size={24} 
                            color="white" 
                        />
                    </TouchableOpacity>
                    
                    <View style={styles.waveformContainer}>
                        {waveform.map((val, i) => (
                            <View 
                                key={i} 
                                style={[
                                    styles.waveBar, 
                                    { height: 10 + val * 20, backgroundColor: isPlaying ? '#facc15' : 'rgba(255,255,255,0.4)' }
                                ]} 
                            />
                        ))}
                    </View>
                    
                    <Text style={styles.voiceDurationText}>{duration}</Text>
                </View>
            );
        } else if (item.content_type === 'location' || item.type === 'location') {
            let locData = {};
            try {
                locData = typeof item.content === 'string' ? JSON.parse(item.content) : (item.content || {});
            } catch(e) {}
            
            content = (
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                        if (!isPremiumMember && !isUser && !isOperator) {
                            showAlert({
                                title: 'Premium Özellik',
                                message: 'Bu konumu görüntüleyebilmek için Premium üye olmanız gerekmektedir.',
                                type: 'info',
                                showCancel: true,
                                cancelText: 'Kapat',
                                confirmText: 'Premium Al',
                                onConfirm: () => navigation.navigate('Store')
                            });
                        } else {
                            const url = `https://maps.google.com/?q=${locData.latitude},${locData.longitude}`;
                            Linking.openURL(url);
                        }
                    }}
                >
                    <View style={{ width: 220, height: 160, borderRadius: 16, backgroundColor: '#cbd5e1', overflow: 'hidden' }}>
                        <View style={{ flex: 1, backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center' }}>
                            <Ionicons name="map" size={48} color="#94a3b8" />
                            {(!isPremiumMember && !isUser && !isOperator) && (
                                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(9,2,26,0.6)', justifyContent: 'center', alignItems: 'center' }}>
                                    <LinearGradient
                                        colors={['#ec4899', '#8b5cf6']}
                                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                        style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, alignItems: 'center' }}
                                    >
                                        <Ionicons name="lock-closed" size={20} color="#fff" />
                                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold', marginTop: 4 }}>Premium Gerekli</Text>
                                    </LinearGradient>
                                </View>
                            )}
                        </View>
                        <View style={{ padding: 10, backgroundColor: theme.colors.surface }}>
                            <Text style={{ color: theme.colors.text, fontSize: 12, fontWeight: 'bold' }} numberOfLines={2}>
                                {locData.address || 'Paylaşılan Konum'}
                            </Text>
                        </View>
                    </View>
                </TouchableOpacity>
            );
        } else if (
            item.content_type === 'call_stub' || item.type === 'call_stub' ||
            item.content_type === 'call_audio' || item.type === 'call_audio' ||
            item.content_type === 'call_video' || item.type === 'call_video' ||
            (typeof item.content === 'string' && (item.content.includes('Sesli Arama') || item.content.includes('Görüntülü Arama') || item.content.includes('"callType"')))
        ) {
            let stubInfo = {};
            try {
                stubInfo = typeof item.content === 'string' && item.content.startsWith('{') ? JSON.parse(item.content) : (item.content || {});
            } catch (e) {
                stubInfo = { reason: 'ended', duration: '0:00' };
            }

            const isVideo = item.content_type === 'call_video' || item.type === 'call_video' || (typeof item.content === 'string' && item.content.includes('Görüntülü')) || stubInfo.callType === 'video';
            const status = stubInfo.status || stubInfo.reason || 'ended';

            const callMainTitle = isVideo ? 'Görüntülü Arama' : 'Sesli Arama';
            let statusText = 'Arama Yapıldı';
            let iconName = isVideo ? 'videocam' : 'call';
            let iconBg = 'rgba(34, 197, 94, 0.2)';
            let iconColor = '#22C55E';

            if (status === 'missed') {
                statusText = 'Cevapsız Arama';
                iconName = isVideo ? 'videocam-off' : 'call';
                iconBg = 'rgba(245, 158, 11, 0.2)';
                iconColor = '#F59E0B';
            } else if (status === 'rejected') {
                statusText = 'Arama Reddedildi';
                iconName = 'close';
                iconBg = 'rgba(239, 68, 68, 0.2)';
                iconColor = '#EF4444';
            } else if (status === 'cancelled') {
                statusText = 'İptal Edildi';
                iconName = 'ban';
                iconBg = 'rgba(148, 163, 184, 0.2)';
                iconColor = '#94A3B8';
            } else if (status === 'busy') {
                statusText = 'Hat Meşgul';
                iconName = 'call';
                iconBg = 'rgba(239, 68, 68, 0.2)';
                iconColor = '#EF4444';
            }

            content = (
                <TouchableOpacity
                    style={styles.callStubContainer}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        handleFakeCall(isVideo ? 'video' : 'voice');
                    }}
                    activeOpacity={0.85}
                >
                    <View style={[styles.callStubIconCircle, { backgroundColor: iconBg }]}>
                        <Ionicons name={iconName} size={20} color={iconColor} />
                    </View>

                    <View style={styles.callStubTextWrapper}>
                        <Text style={styles.callStubTitle} numberOfLines={1}>
                            {callMainTitle}
                        </Text>
                        <Text style={[styles.callStubSub, { color: iconColor }]} numberOfLines={1}>
                            {statusText}
                        </Text>
                    </View>

                    <View style={styles.callBackBtn}>
                        <Ionicons name={isVideo ? "videocam" : "call"} size={16} color="#fff" />
                    </View>
                </TouchableOpacity>
            );
        }

        return (
            <MessageBubble
                isMine={isUser}
                messageId={item.id}
                    animateEntrance={index === 0 && liveAnimatedIdsRef.current.has(String(item._clientKey || item.id))}
                isRead={item.is_read}
                avatar={resolveImageUrl(isUser ? (user.avatar_url || user.avatar) : (isFamilyChat ? item.avatar_url : (partnerAvatar || avatar_url)))}
                vipLevel={isFamilyChat ? 0 : (isUser ? user.vip_level : (gender === 'coin_bayisi' ? 'dealer' : vip_level))}
                onAvatarPress={!isUser && !isFamilyChat ? handlePartnerAvatarPress : undefined}
                timestamp={item.created_at}
                reaction={item.reaction}
                isReplied={item.is_replied}
                earnedDiamonds={item.earned_diamonds}
                isOperator={isOperator}
                onReaction={handleBubbleReaction}
            >
                {content}
            </MessageBubble>
        );
    }, [user.id, user.avatar_url, user.avatar, avatar_url, vip_level, pendingAgencyInvite, currentPlayingUri, audioDurations, playAudio, stableConfirmUnlock, setSelectedImage, isOperator, socketRef, chatId, setMessages, theme, isFamilyChat, handlePartnerAvatarPress, handleBubbleReaction]);

    messagesRef.current = messages;

    const renderMessageWithDate = React.useCallback(({ item, index }) => {
        const nextMessage = messagesRef.current[index + 1];
        const showDate = !nextMessage || getDateKey(item.created_at) !== getDateKey(nextMessage.created_at);
        const dateText = showDate ? formatMessageDate(item.created_at) : null;

        return (
            <ChatMessageRow
                item={item}
                index={index}
                isTopItem={index === 0}
                showDate={showDate}
                dateText={dateText}
                renderMessage={renderMessage}
                dateSeparatorStyle={styles.dateSeparator}
                dateSeparatorLineStyle={styles.dateSeparatorLine}
                dateSeparatorTextStyle={styles.dateSeparatorText}
            />
        );
    }, [renderMessage]);

    return (
        <View style={styles.container}>
            <StatusBar style="light" translucent backgroundColor="transparent" />
            <ChatBackground themeMode={themeMode} />

            <Modal visible={!!fakeCall} transparent={false} animationType="fade" onRequestClose={() => handleHangupCall(true)}>
                <View style={styles.fakeCallContainer}>
                    <StatusBar style="light" translucent backgroundColor="transparent" />
                    <LinearGradient
                        colors={['#1a0614', '#0d0309', '#050103']}
                        style={StyleSheet.absoluteFill}
                    />

                    {/* Üst Bilgi */}
                    <View style={styles.fakeCallTopSection}>
                        <View style={styles.fakeCallTypeBadge}>
                            <Ionicons name={fakeCall === 'video' ? 'videocam' : 'call'} size={14} color="#FFC53D" />
                            <Text style={styles.fakeCallTypeBadgeText}>
                                {fakeCall === 'video' ? 'GÖRÜNTÜLÜ ARAMA' : 'SESLİ ARAMA'}
                            </Text>
                        </View>
                        <Text style={[styles.fakeCallStatusText, fakeCallEndStatus && { color: fakeCallEndStatus.color, fontWeight: '700' }]}>
                            {fakeCallEndStatus ? fakeCallEndStatus.status : 'Aranıyor...'}
                        </Text>
                    </View>

                    {/* Orta Profil & Nabız Efekti */}
                    <View style={styles.fakeCallCenterSection}>
                        <View style={styles.fakeCallAvatarContainer}>
                            {!fakeCallEndStatus && (
                                <Animated.View style={[styles.fakeCallPulseRing, { transform: [{ scale: fakeCallPulse }] }]} />
                            )}
                            <View style={[styles.fakeCallAvatarWrapper, fakeCallEndStatus && { borderColor: fakeCallEndStatus.color }]}>
                                {partnerAvatar ? (
                                    <Image source={{ uri: partnerAvatar }} style={styles.fakeCallAvatarImg} />
                                ) : (
                                    <View style={[styles.fakeCallAvatarImg, styles.fakeCallAvatarPlaceholder]}>
                                        <Ionicons name="person" size={54} color="rgba(255,255,255,0.7)" />
                                    </View>
                                )}
                            </View>
                        </View>
                        <Text style={styles.fakeCallPartnerName}>{partnerName || name || 'Kullanıcı'}</Text>
                        <Text style={[styles.fakeCallRingingText, fakeCallEndStatus && { color: fakeCallEndStatus.color, fontSize: 18, fontWeight: '800' }]}>
                            {fakeCallEndStatus ? fakeCallEndStatus.status : 'Çalıyor...'}
                        </Text>
                        <Text style={[styles.fakeCallSubNote, fakeCallEndStatus && { color: 'rgba(255,255,255,0.75)', fontWeight: '600' }]}>
                            {fakeCallEndStatus ? fakeCallEndStatus.note : 'Kullanıcının yanıt vermesi bekleniyor'}
                        </Text>
                    </View>

                    {/* Alt Kapatma Butonu */}
                    <View style={styles.fakeCallBottomSection}>
                        <TouchableOpacity
                            style={styles.fakeCallHangupBtn}
                            onPress={() => handleHangupCall(true)}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="call" size={32} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
                        </TouchableOpacity>
                        <Text style={styles.fakeCallHangupLabel}>Aramayı Sonlandır</Text>
                    </View>
                </View>
            </Modal>

            <QuickActionsModal 
                visible={showQuickActions}
                onClose={() => setShowQuickActions(false)}
                onSelectMessage={(msg) => sendMessage(msg)}
                onSelectVoice={handleSelectVoice}
            />

            {/* Image Lock Price Selection Modal */}
            <Modal
                visible={showImageLockModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowImageLockModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <GlassCard intensity={80} tint="dark" style={styles.imageLockCard}>
                        <Text style={styles.imageLockTitle}>Fotoğraf Seçenekleri 🔒</Text>
                        <Text style={styles.imageLockSub}>Fotoğrafı kilitli mi göndermek istersiniz? Kilidi açmak için erkek kullanıcının ödeyeceği Coin miktarını seçin.</Text>
                        
                        {selectedImageUri && (
                            <Image 
                                source={{ uri: selectedImageUri }}
                                style={styles.imageLockPreview}
                                blurRadius={15}
                            />
                        )}

                        <View style={styles.pricingPillContainer}>
                            {[100, 200, 500, 1000].map((cost) => (
                                <TouchableOpacity
                                    key={cost}
                                    style={[
                                        styles.pricingPill,
                                        unlockCostSelection === cost && styles.pricingPillActive
                                    ]}
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        setUnlockCostSelection(cost);
                                    }}
                                >
                                    <Text style={[
                                        styles.pricingPillText,
                                        unlockCostSelection === cost && styles.pricingPillTextActive
                                    ]}>
                                        {cost === 0 ? 'Ücretsiz' : `${cost} Coin`}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={styles.imageLockBtnRow}>
                            <TouchableOpacity
                                style={styles.imageLockCancelBtn}
                                onPress={() => {
                                    setShowImageLockModal(false);
                                    setSelectedImageUri(null);
                                }}
                            >
                                <Text style={styles.imageLockCancelBtnText}>İptal</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.imageLockSubmitBtn}
                                onPress={() => {
                                    setShowImageLockModal(false);
                                    const isLocked = unlockCostSelection > 0;
                                    uploadAndSendImage(selectedImageUri, isLocked, unlockCostSelection);
                                    setSelectedImageUri(null);
                                }}
                            >
                                <LinearGradient
                                    colors={['#ec4899', '#8b5cf6']}
                                    style={styles.imageLockSubmitGradient}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                >
                                    <Text style={styles.imageLockSubmitBtnText}>Gönder</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </GlassCard>
                </View>
            </Modal>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
                style={{ flex: 1 }}
            >
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    inverted={true} // Start from bottom
                    keyExtractor={item => (item._clientKey || item.id).toString()}
                    renderItem={renderMessageWithDate}
                    contentContainerStyle={styles.messagesList}
                    scrollIndicatorInsets={{ right: 1 }} // Fix scrollbar on iOS
                    removeClippedSubviews={Platform.OS === 'android'}
                    maxToRenderPerBatch={10}
                    windowSize={10}
                    initialNumToRender={15}
                    onEndReached={loadOlderMessages}
                    onEndReachedThreshold={0.5}
                    maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
                    ListFooterComponent={
                        loadingOlder ? (
                            <View style={{ paddingVertical: 14, alignItems: 'center' }}>
                                <ActivityIndicator size="small" color={theme.colors.primary} />
                            </View>
                        ) : (!hasMoreMessages && messages.length >= PAGE_SIZE) ? (
                            <Text style={{ textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: 11, paddingVertical: 10 }}>
                                Tüm geçmiş mesajlar yüklendi
                            </Text>
                        ) : null
                    }
                    style={{ flex: 1 }}
                />

                {isTyping && <TypingIndicator />}

                <View style={[styles.modernInputWrapper, { paddingBottom: isKeyboardVisible ? (Platform.OS === 'ios' ? 8 : 4) : Math.max(insets.bottom + 8, Platform.OS === 'ios' ? 20 : 14) }]}>
                    {/* renderIcebreakers() is now handled by QuickActionsModal */}
                    <GlassCard intensity={40} tint="dark" style={styles.glassInputContainer}>
                        <View style={styles.inputRow}>
                              <Animated.View 
                                  {...(!isFamilyChat ? panResponder.panHandlers : {})}
                                  style={[styles.quickMsgToggle, { transform: [{ translateX: slideAnim }] }]} 
                              >
                                  <Ionicons 
                                      name={isFamilyChat ? "people" : (isCancelling ? "trash" : "mic")} 
                                      size={18} 
                                      color={isRecording ? (isCancelling ? "#ef4444" : "#ec4899") : "rgba(255,255,255,0.4)"} 
                                  />
                                  {isRecording && (
                                      <Animated.View style={[styles.recordingRipple, {
                                          transform: [{ scale: waveAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }],
                                          opacity: waveAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] })
                                      }]} />
                                  )}
                              </Animated.View>
                             
                             <View style={styles.inputFlexContainer}>
                                 {isRecording ? (
                                     <View style={styles.recordingRow}>
                                         <View style={styles.recordingIndicator}>
                                             <Animated.View style={[styles.recordingDot, { opacity: blinkAnim }]} />
                                             <Text style={styles.recordTimerText}>{isCancelling ? 'İptal etmek için bırak' : recordTime}</Text>
                                         </View>
                                         {!isCancelling && (
                                             <View style={styles.waveformContainer}>
                                                 {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                                                     <Animated.View 
                                                         key={i}
                                                         style={[
                                                             styles.waveBar,
                                                             {
                                                                 height: waveAnim.interpolate({
                                                                     inputRange: [0, 1],
                                                                     outputRange: [8, 12 + (i % 4) * 6]
                                                                 })
                                                             }
                                                         ]}
                                                     />
                                                 ))}
                                             </View>
                                         )}
                                         {!isCancelling && <Text style={styles.slideHintText}>Sağa kaydır ›</Text>}
                                     </View>
                                 ) : (
                                     <>
                                      <TextInput
                                          ref={textInputRef}
                                          style={[styles.input, { color: theme.colors.text }]}
                                          defaultValue=""
                                          onChange={(e) => {
                                              const ec = e?.nativeEvent?.eventCount;
                                              if (typeof ec === 'number' && ec > lastInputEventCountRef.current) {
                                                  lastInputEventCountRef.current = ec;
                                              }
                                          }}
                                          onChangeText={handleTyping}
                                          placeholder="Mesaj yaz..."
                                          placeholderTextColor="rgba(255,255,255,0.4)"
                                          multiline
                                          maxHeight={100}
                                          cursorColor={theme.colors.primary}
                                      />
                                     </>
                                 )}
                             </View>

                             {!isRecording && (
                                 <TouchableOpacity onPress={sendMessage} style={styles.sendButton} activeOpacity={0.7}>
                                     <LinearGradient colors={theme.gradients.primary} style={styles.sendGradient}>
                                         <Ionicons name="send" size={20} color="white" />
                                     </LinearGradient>
                                 </TouchableOpacity>
                             )}
                        </View>

                        {/* Bottom Action Bar */}
                        {!isFamilyChat && <View style={styles.actionBar}>
                            <TouchableOpacity style={styles.modernActionBtn} onPress={() => handleFakeCall('video')}>
                                <View style={styles.btnBlur}>
                                    <Ionicons name="videocam" size={22} color="rgba(255,255,255,0.8)" />
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.modernActionBtn} onPress={() => handleFakeCall('voice')}>
                                <View style={styles.btnBlur}>
                                    <Ionicons name="call" size={22} color="rgba(255,255,255,0.8)" />
                                </View>
                            </TouchableOpacity>


 
                            <TouchableOpacity style={styles.modernActionBtn} onPress={() => {
                                Keyboard.dismiss();
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setShowQuickActions(true);
                            }}>
                                <View style={[styles.btnBlur, showQuickActions && { backgroundColor: 'rgba(250, 204, 21, 0.2)', borderColor: 'rgba(250, 204, 21, 0.4)' }]}>
                                    <Ionicons name="flash" size={22} color={showQuickActions ? "#facc15" : "rgba(255,255,255,0.8)"} />
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.modernActionBtn} onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                handleSendLocation();
                            }}>
                                <View style={styles.btnBlur}>
                                    <Ionicons name="location" size={22} color="rgba(255,255,255,0.8)" />
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.modernActionBtn} onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                handleSendImage();
                            }}>
                                <View style={styles.btnBlur}>
                                    <Ionicons name="image" size={22} color="rgba(255,255,255,0.8)" />
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.modernActionBtn} onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                setShowGiftModal(true);
                            }}>
                                <View style={styles.btnBlur}>
                                    <Image
                                        source={require('../assets/gift_icon.webp')}
                                        style={{ width: 22, height: 22 }}
                                        resizeMode="contain"
                                    />
                                </View>
                            </TouchableOpacity>
                        </View>}
                    </GlassCard>
                </View>
            </KeyboardAvoidingView>

            {/* OPTIONS MENU */}
            {
                showOptions && (
                    <View style={[styles.optionsMenu, { backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.glassBorder }]}>
                        <TouchableOpacity style={styles.optionItem} onPress={() => { setShowOptions(false); setShowReportModal(true); }}>
                            <Ionicons name="flag-outline" size={20} color={theme.colors.text} />
                            <Text style={[styles.optionText, { color: theme.colors.text }]}>Şikayet Et</Text>
                        </TouchableOpacity>
                        <View style={styles.divider} />
                        <TouchableOpacity style={styles.optionItem} onPress={handleBlock}>
                            <Ionicons name="ban-outline" size={20} color="#ef4444" />
                            <Text style={[styles.optionText, { color: '#ef4444' }]}>Engelle</Text>
                        </TouchableOpacity>
                    </View>
                )
            }

            {/* LIGHTBOX MODAL */}
            <ImageLightbox 
                visible={!!selectedImage}
                imageUri={resolveImageUrl(selectedImage)}
                onClose={() => setSelectedImage(null)}
            />

            {/* VIDEO LIGHTBOX MODAL */}
            <Modal
                visible={!!selectedVideo}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setSelectedVideo(null)}
            >
                <View style={{ flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' }}>
                    <TouchableOpacity 
                        style={{ position: 'absolute', top: Platform.OS === 'ios' ? 50 : 20, right: 20, zIndex: 10, padding: 10 }} 
                        onPress={() => setSelectedVideo(null)}
                    >
                        <Ionicons name="close" size={32} color="white" />
                    </TouchableOpacity>
                    {selectedVideo && (
                        <Video
                            source={{ uri: resolveImageUrl(selectedVideo) }}
                            style={{ width: '100%', height: '100%' }}
                            useNativeControls={true}
                            resizeMode={ResizeMode.CONTAIN}
                            shouldPlay={true}
                        />
                    )}
                </View>
            </Modal>

            {/* REPORT MODAL */}
            <ReportModal
                visible={showReportModal}
                onClose={() => setShowReportModal(false)}
                reporterId={user.id}
                reportedId={operatorId}
                onReportSubmitted={() => {
                    setShowReportModal(false);
                    navigation.goBack();
                }}
            />

            {/* GIFT MODAL */}
            <GiftPickerModal
                visible={showGiftModal}
                onClose={() => setShowGiftModal(false)}
                onSelectGift={handleSendGift}
                userBalance={currentBalance}
            />

            {/* GIFT ANIMATION OVERLAY */}
            <GiftOverlay
                gift={activeGift}
                receiver={{ avatar_url: resolveImageUrl(avatar_url), display_name: name, username: name }}
                onFinish={() => setActiveGift(null)}
            />
        </View >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F080A', // Fallback color
    },
    background: {
        ...StyleSheet.absoluteFillObject,
    },
    messagesList: {
        paddingHorizontal: 8,
        paddingTop: 10,
        paddingBottom: 90,
    },
    dateSeparator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 34,
        paddingVertical: 14,
        gap: 10,
    },
    dateSeparatorLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.10)',
    },
    dateSeparatorText: {
        color: 'rgba(255,255,255,0.55)',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.4,
    },
    messageBubble: {
        maxWidth: '75%',
        marginBottom: 16,
        borderRadius: 24,
        overflow: 'hidden',
        ...SHADOWS.medium,
    },
    userBubble: {
        alignSelf: 'flex-end',
        borderBottomRightRadius: 4,
    },
    operatorBubble: {
        alignSelf: 'flex-start',
        borderBottomLeftRadius: 4,
        borderWidth: 1,
    },
    bubbleGradient: {
        paddingHorizontal: 20,
        paddingVertical: 14,
    },
    messageText: {
        fontSize: 13,
        lineHeight: 22,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    modernInputWrapper: {
        paddingBottom: Platform.OS === 'ios' ? 20 : 10,
        backgroundColor: 'transparent',
    },
    glassInputContainer: {
        marginHorizontal: 12,
        borderRadius: 32,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    input: {
        flex: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        marginRight: 8,
        fontSize: 15,
        minHeight: 44,
        maxHeight: 100,
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        overflow: 'hidden',
    },
    sendGradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    optionsMenu: {
        position: 'absolute',
        top: 60,
        right: 20,
        borderRadius: 16,
        borderWidth: 1,
        padding: 8,
        minWidth: 160,
        zIndex: 1000,
        ...SHADOWS.large,
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        gap: 12,
    },
    optionText: {
        fontSize: 15,
        fontWeight: '600',
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginVertical: 4,
    },
    quickMsgToggle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        position: 'relative'
    },
    recordingRipple: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        borderRadius: 20,
        backgroundColor: '#ec4899',
    },
    inputFlexContainer: {
        flex: 1,
    },
    recordingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        flex: 1,
        paddingRight: 10,
    },
    recordingIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    recordingDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#ef4444',
    },
    recordTimerText: {
        color: 'white',
        fontSize: 14,
        fontVariant: ['tabular-nums'],
    },
    waveformContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        height: 24,
    },
    waveBar: {
        width: 3,
        backgroundColor: '#ec4899',
        borderRadius: 2,
    },
    slideHintText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 12,
        marginRight: 10,
    },
    actionBar: {
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        alignItems: 'center',
        paddingVertical: 12,
        borderTopWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    modernActionBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        overflow: 'hidden',
    },
    btnBlur: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        borderRadius: 22,
    },
    giftIconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    giftLogoLarge: {
        width: 55,
        height: 55,
        marginBottom: 8
    },
    voiceContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minWidth: 180,
    },
    voicePlayButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#ec4899',
        alignItems: 'center',
        justifyContent: 'center',
        ...SHADOWS.small
    },
    voiceDurationText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
        fontVariant: ['tabular-nums'],
    },
    fakeCallContainer: {
        flex: 1,
        backgroundColor: '#0a0309',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: Platform.OS === 'ios' ? 70 : 50,
        paddingBottom: Platform.OS === 'ios' ? 60 : 40,
    },
    fakeCallTopSection: {
        alignItems: 'center',
        marginTop: 10,
    },
    fakeCallTypeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(255, 197, 61, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(255, 197, 61, 0.3)',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
        marginBottom: 8,
    },
    fakeCallTypeBadgeText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#FFC53D',
        letterSpacing: 0.8,
    },
    fakeCallStatusText: {
        fontSize: 15,
        color: 'rgba(255, 255, 255, 0.65)',
        fontWeight: '500',
    },
    fakeCallCenterSection: {
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    fakeCallAvatarContainer: {
        width: 170,
        height: 170,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    fakeCallPulseRing: {
        position: 'absolute',
        width: 170,
        height: 170,
        borderRadius: 85,
        backgroundColor: 'rgba(236, 72, 153, 0.12)',
        borderWidth: 2,
        borderColor: 'rgba(236, 72, 153, 0.3)',
    },
    fakeCallAvatarWrapper: {
        width: 130,
        height: 130,
        borderRadius: 65,
        borderWidth: 3,
        borderColor: '#EC4899',
        overflow: 'hidden',
        backgroundColor: '#1A0C13',
    },
    fakeCallAvatarImg: {
        width: '100%',
        height: '100%',
    },
    fakeCallAvatarPlaceholder: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#2A1220',
    },
    fakeCallPartnerName: {
        fontSize: 26,
        fontWeight: '800',
        color: '#FFFFFF',
        marginBottom: 6,
        textAlign: 'center',
    },
    fakeCallRingingText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#EC4899',
        marginBottom: 6,
    },
    fakeCallSubNote: {
        fontSize: 13,
        color: 'rgba(255, 255, 255, 0.45)',
        textAlign: 'center',
    },
    fakeCallBottomSection: {
        alignItems: 'center',
        gap: 12,
        marginBottom: 20,
    },
    fakeCallHangupBtn: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#EF4444',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.5,
        shadowRadius: 12,
        elevation: 8,
    },
    fakeCallHangupLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.8)',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    imageLockCard: {
        width: '100%',
        maxWidth: 400,
        padding: 24,
        borderRadius: 24,
        alignItems: 'center',
    },
    imageLockTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    imageLockSub: {
        color: 'rgba(255,255,255,0.6)',
        textAlign: 'center',
        fontSize: 13,
        marginBottom: 20,
    },
    imageLockPreview: {
        width: 140,
        height: 140,
        borderRadius: 16,
        marginBottom: 24,
        borderWidth: 2,
        borderColor: 'rgba(236,72,153,0.3)',
    },
    pricingPillContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 10,
        marginBottom: 24,
    },
    pricingPill: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    pricingPillActive: {
        backgroundColor: 'rgba(236,72,153,0.15)',
        borderColor: '#ec4899',
    },
    pricingPillText: {
        color: '#fff',
        fontWeight: '600',
    },
    pricingPillTextActive: {
        color: '#ec4899',
    },
    imageLockBtnRow: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    imageLockCancelBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
    },
    imageLockCancelBtnText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    imageLockSubmitBtn: {
        flex: 1,
        borderRadius: 16,
        overflow: 'hidden',
    },
    imageLockSubmitGradient: {
        paddingVertical: 14,
        alignItems: 'center',
    },
    imageLockSubmitBtnText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    agencyInviteCard: {
        position: 'absolute',
        top: 100, // Below header
        left: 20,
        right: 20,
        backgroundColor: 'rgba(15, 8, 10, 0.95)',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#ec4899',
        zIndex: 999,
        ...SHADOWS.large
    },
    agencyInviteHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10
    },
    agencyInviteTitle: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold'
    },
    agencyInviteText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 13,
        marginBottom: 16,
        lineHeight: 20
    },
    agencyInviteActions: {
        flexDirection: 'row',
        gap: 12
    },
    agencyInviteBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center'
    },
    agencyInviteBtnReject: {
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        borderWidth: 1,
        borderColor: '#ef4444'
    },
    agencyInviteBtnAccept: {
        backgroundColor: '#ec4899',
    },
    agencyInviteBtnText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14
    },
    callStubContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
        width: 250,
        justifyContent: 'space-between',
    },
    callStubIconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    callStubTextWrapper: {
        flex: 1,
        marginHorizontal: 10,
        justifyContent: 'center',
    },
    callStubTitle: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    callStubSub: {
        fontSize: 12,
        fontWeight: '600',
        marginTop: 2,
    },
    callBackBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#EC4899',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#EC4899',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.35,
        shadowRadius: 4,
        elevation: 3,
    }
});
