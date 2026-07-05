import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    Dimensions,
    TouchableOpacity,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    Image,
    ScrollView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
    FadeIn,
    FadeInUp,
    FadeOut,
    SlideInRight,
    SlideOutLeft,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
    withRepeat,
    withSequence
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import { API_URL } from '../config';
import { COLORS, GRADIENTS } from '../theme';
import AuthBackground from '../components/animated/AuthBackground';
import GradientButton from '../components/ui/GradientButton';
import ModernAlert from '../components/ui/ModernAlert';
import { useChat } from '../contexts/ChatContext';
import GlassCard from '../components/ui/GlassCard';
import * as Haptics from 'expo-haptics';

const { width, height } = Dimensions.get('window');

const STEPS = [
    { id: 'welcome', title: 'Hoş Geldin!', subtitle: 'Seni tanımaya başlayalım.' },
    { id: 'name', title: 'Sana nasıl hitap edelim?', subtitle: 'Bu isim profilinde ve sesli odalarda görünecek.' },
    { id: 'gender', title: 'Cinsiyetin?', subtitle: 'Sana uygun eşleşmeler ve canlı odalar önerebilmemiz için.' },
    { id: 'relationship', title: 'Ne Arıyorsun?', subtitle: 'İlgini çekenleri seç, sana uygun kişiler ve odalar önerelim.' },
    { id: 'details', title: 'Hakkında birkaç bilgi', subtitle: 'Profilini tamamlayalım ve sana daha uygun kişiler önerelim.' },
    { id: 'interests', title: 'İlgi Alanların?', subtitle: 'Sana benzer kişiler ve canlı odalar önerelim.' },
    { id: 'photo', title: 'Son Dokunuş', subtitle: 'Harika bir profil fotoğrafı seç.' }
];

const BAD_WORDS = ['argo', 'kufur', 'slang', 'serefsiz', 'pic', 'piç', 'amk', 'aq', 'got', 'göt', 'sex', 'seks', 'sik', 'yarrak', 'amcik', 'amcık', 'orospu'];

const isNameValid = (text) => {
    const trimmed = text.trim();
    if (trimmed.length < 2 || trimmed.length > 16) return false;
    if (trimmed === '') return false;
    const hasNumbers = /[0-9]/.test(trimmed);
    if (hasNumbers) return false;
    
    const lower = trimmed.toLowerCase();
    const hasBadWord = BAD_WORDS.some(word => lower.includes(word));
    if (hasBadWord) return false;
    
    return true;
};

const GENDER_OPTIONS = [
    { id: 'kadin', label: 'Kadın', icon: 'woman' },
    { id: 'erkek', label: 'Erkek', icon: 'man' },
];

const RELATIONSHIP_OPTIONS = [
    { id: 'sohbet', label: 'Sohbet' },
    { id: 'flort', label: 'Flört' },
    { id: 'ciddi', label: 'Ciddi ilişki' },
    { id: 'arkadaslik', label: 'Arkadaşlık' },
    { id: 'sesli', label: 'Sesli odalar' },
    { id: 'eglence', label: 'Eğlence' },
];

const INTERESTS_DATA = [
    { name: 'Müzik', icon: 'musical-notes-outline', color: '#ec4899' },
    { name: 'Spor', icon: 'football-outline', color: '#3b82f6' },
    { name: 'Seyahat', icon: 'airplane-outline', color: '#06b6d4' },
    { name: 'Sinema', icon: 'film-outline', color: '#fbbf24' },
    { name: 'Yemek', icon: 'restaurant-outline', color: '#f97316' },
    { name: 'Dans', icon: 'walk-outline', color: '#e11d48' },
    { name: 'Oyun', icon: 'game-controller-outline', color: '#a855f7' },
    { name: 'Sanat', icon: 'color-palette-outline', color: '#10b981' },
    { name: 'Kitap', icon: 'book-outline', color: '#14b8a6' },
    { name: 'Doğa', icon: 'leaf-outline', color: '#22c55e' },
    { name: 'Karaoke', icon: 'mic-outline', color: '#ec4899' },
    { name: 'Anime', icon: 'sparkles-outline', color: '#f43f5e' },
    { name: 'Fitness', icon: 'barbell-outline', color: '#f59e0b' },
    { name: 'Motor', icon: 'speedometer-outline', color: '#ef4444' },
    { name: 'Gece Sohbeti', icon: 'moon-outline', color: '#c084fc' }
];

const TURKISH_CITIES = [
    'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Amasya', 'Ankara', 'Antalya', 'Artvin', 'Aydın', 'Balıkesir', 
    'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa', 'Çanakkale', 'Çankırı', 'Çorum', 'Denizli', 
    'Diyarbakır', 'Edirne', 'Elazığ', 'Erzincan', 'Erzurum', 'Eskişehir', 'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkari', 
    'Hatay', 'Isparta', 'Mersin', 'İstanbul', 'İzmir', 'Kars', 'Kastamonu', 'Kayseri', 'Kırklareli', 'Kırşehir', 
    'Kocaeli', 'Konya', 'Kütahya', 'Malatya', 'Manisa', 'Kahramanmaraş', 'Mardin', 'Muğla', 'Muş', 'Nevşehir', 
    'Niğde', 'Ordu', 'Rize', 'Sakarya', 'Samsun', 'Siirt', 'Sinop', 'Sivas', 'Tekirdağ', 'Tokat', 
    'Trabzon', 'Tunceli', 'Şanlıurfa', 'Uşak', 'Van', 'Yozgat', 'Zonguldak', 'Aksaray', 'Bayburt', 'Karaman', 
    'Kırıkkale', 'Batman', 'Şırnak', 'Bartın', 'Ardahan', 'Iğdır', 'Yalova', 'Karabük', 'Kilis', 'Osmaniye', 'Düzce'
];

const PremiumWelcomeIllustration = () => {
    const float1 = useSharedValue(0);
    const float2 = useSharedValue(0);
    const pulse = useSharedValue(1);

    React.useEffect(() => {
        float1.value = withRepeat(
            withSequence(
                withTiming(-6, { duration: 2500 }),
                withTiming(6, { duration: 2500 })
            ),
            -1,
            true
        );
        float2.value = withRepeat(
            withSequence(
                withTiming(6, { duration: 2800 }),
                withTiming(-6, { duration: 2800 })
            ),
            -1,
            true
        );
        pulse.value = withRepeat(
            withSequence(
                withTiming(1.1, { duration: 850 }),
                withTiming(1, { duration: 850 })
            ),
            -1,
            true
        );
    }, []);

    const card1Style = useAnimatedStyle(() => ({
        transform: [{ translateY: float1.value }, { rotate: '-6deg' }],
    }));

    const card2Style = useAnimatedStyle(() => ({
        transform: [{ translateY: float2.value }, { rotate: '6deg' }],
    }));

    const heartStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulse.value }],
    }));

    const badge1Style = useAnimatedStyle(() => ({
        transform: [{ translateY: float1.value - 2 }, { rotate: '-3deg' }],
    }));

    const badge2Style = useAnimatedStyle(() => ({
        transform: [{ translateY: float2.value + 2 }, { rotate: '3deg' }],
    }));

    return (
        <View style={illStyles.illContainer}>
            {/* Back Card (Can, 26) */}
            <Animated.View style={[illStyles.profileCard, illStyles.backCard, card2Style]}>
                <Image
                    source={{ uri: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200' }}
                    style={illStyles.cardImage}
                />
                <LinearGradient
                    colors={['transparent', 'rgba(3, 7, 18, 0.85)']}
                    style={StyleSheet.absoluteFillObject}
                />
                <View style={illStyles.cardDetails}>
                    <Text style={illStyles.cardName}>Can, 26</Text>
                </View>
            </Animated.View>

            {/* Front Card (Selin, 24) */}
            <Animated.View style={[illStyles.profileCard, illStyles.frontCard, card1Style]}>
                <Image
                    source={{ uri: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200' }}
                    style={illStyles.cardImage}
                />
                <LinearGradient
                    colors={['transparent', 'rgba(3, 7, 18, 0.85)']}
                    style={StyleSheet.absoluteFillObject}
                />
                <View style={illStyles.cardDetails}>
                    <Text style={illStyles.cardName}>Selin, 24</Text>
                </View>
            </Animated.View>

            {/* Glowing Central Match Heart Badge */}
            <Animated.View style={[illStyles.matchHeartBadge, heartStyle]}>
                <LinearGradient
                    colors={['#ec4899', '#f43f5e']}
                    style={illStyles.heartGradient}
                >
                    <Ionicons name="heart" size={26} color="white" />
                </LinearGradient>
            </Animated.View>

            {/* Floating Badge: Yeni Eşleşme (placed to the top-left of Selin's card, not touching) */}
            <Animated.View style={[illStyles.floatBadge, illStyles.badgeSelinLeft, badge1Style]}>
                <LinearGradient
                    colors={['rgba(236, 72, 153, 0.15)', 'rgba(236, 72, 153, 0.35)']}
                    style={illStyles.badgeGradient}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                >
                    <Ionicons name="heart-outline" size={12} color="#f472b6" />
                    <Text style={illStyles.badgeText}>Yeni Eşleşme</Text>
                </LinearGradient>
            </Animated.View>

            {/* Floating Badge: Sesli Oda (placed to the bottom-right of Can't card, not touching) */}
            <Animated.View style={[illStyles.floatBadge, illStyles.badgeCanRight, badge2Style]}>
                <LinearGradient
                    colors={['rgba(139, 92, 246, 0.15)', 'rgba(139, 92, 246, 0.35)']}
                    style={illStyles.badgeGradient}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                >
                    <Ionicons name="headset-outline" size={12} color="#c084fc" />
                    <Text style={illStyles.badgeText}>Sesli Oda</Text>
                </LinearGradient>
            </Animated.View>
        </View>
    );
};

const MiniProfilePreview = ({ name }) => {
    const displayName = name.trim() || 'Profil Adın';
    return (
        <View style={nameStyles.verticalPreview}>
            <View style={nameStyles.avatarOuterRing}>
                <LinearGradient
                    colors={['#8b5cf6', '#ec4899']}
                    style={nameStyles.largeAvatar}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <Ionicons name="person" size={40} color="rgba(255, 255, 255, 0.95)" />
                </LinearGradient>
                <View style={nameStyles.largeOnlineIndicator} />
            </View>
            <Text style={nameStyles.verticalName} numberOfLines={1}>{displayName}</Text>
            <Text style={nameStyles.verticalSub}>Şimdi Katıldı • Çevrimiçi</Text>
        </View>
    );
};

const OnboardingNameInput = ({ name, setName, inputFocused, setInputFocused }) => {
    const isValid = isNameValid(name);
    
    let borderColor = 'rgba(255, 255, 255, 0.08)';
    if (inputFocused) {
        borderColor = '#EC4DA7';
    } else if (name.length > 0) {
        borderColor = isValid ? 'rgba(34, 211, 159, 0.8)' : 'rgba(239, 68, 110, 0.3)';
    }

    return (
        <View style={[
            nameStyles.container,
            { borderColor },
            inputFocused && nameStyles.containerFocused
        ]}>
            <TextInput
                style={nameStyles.input}
                placeholder="Profil adını gir"
                placeholderTextColor="rgba(255, 255, 255, 0.25)"
                value={name}
                onChangeText={setName}
                selectionColor="#EC4DA7"
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                maxLength={20}
                underlineColorAndroid="transparent"
                importantForAutofill="no"
                autoComplete="off"
                autoCorrect={false}
                textContentType="none"
                keyboardType="default"
            />
            {isValid && (
                <View style={nameStyles.checkWrapper}>
                    <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color="#10b981"
                    />
                </View>
            )}
        </View>
    );
};

const GenderOptionCard = ({ opt, selected, onPress }) => {
    let iconName = 'person';
    let iconColors = ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.05)'];
    let iconColor = '#FFFFFF';
    
    if (opt.id === 'kadin') {
        iconName = 'female';
        iconColors = ['rgba(244, 114, 182, 0.12)', 'rgba(236, 72, 153, 0.25)'];
        iconColor = '#ec4899';
    } else if (opt.id === 'erkek') {
        iconName = 'male';
        iconColors = ['rgba(56, 189, 248, 0.12)', 'rgba(59, 130, 246, 0.25)'];
        iconColor = '#3b82f6';
    }

    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={onPress}
            style={genderStyles.touchableWrapper}
        >
            <LinearGradient
                colors={selected ? ['#a855f7', '#ec4899'] : ['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.05)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                    genderStyles.gradientBorder,
                    selected && genderStyles.selectedGlow
                ]}
            >
                <View style={[
                    genderStyles.cardContainer,
                    !selected && genderStyles.unselectedCard
                ]}>
                    <LinearGradient
                        colors={iconColors}
                        style={genderStyles.iconBg}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <Ionicons name={iconName} size={28} color={iconColor} />
                    </LinearGradient>

                    <Text style={[
                        genderStyles.cardLabel,
                        selected ? genderStyles.selectedLabel : genderStyles.unselectedLabel
                    ]}>
                        {opt.label}
                    </Text>

                    {selected ? (
                        <Animated.View entering={FadeIn.duration(200)} style={genderStyles.checkWrapper}>
                            <Ionicons name="checkmark-circle" size={24} color="#ec4899" />
                        </Animated.View>
                    ) : (
                        <View style={genderStyles.emptyCheck} />
                    )}
                </View>
            </LinearGradient>
        </TouchableOpacity>
    );
};

const RelationshipOptionCard = ({ opt, selected, onPress }) => {
    let iconName = 'help-circle-outline';
    let iconColors = ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.05)'];
    let iconColor = '#FFFFFF';
    let activeBorderGradients = ['#a855f7', '#ec4899'];
    let activeGlowColor = '#a855f7';

    if (opt.id === 'sohbet') {
        iconName = 'chatbubbles-outline';
        iconColors = ['rgba(6, 182, 212, 0.12)', 'rgba(59, 130, 246, 0.25)'];
        iconColor = '#06b6d4';
        activeBorderGradients = ['#06b6d4', '#3b82f6'];
        activeGlowColor = '#06b6d4';
    } else if (opt.id === 'flort') {
        iconName = 'heart-outline';
        iconColors = ['rgba(244, 114, 182, 0.12)', 'rgba(236, 72, 153, 0.25)'];
        iconColor = '#ec4899';
        activeBorderGradients = ['#f472b6', '#ec4899'];
        activeGlowColor = '#ec4899';
    } else if (opt.id === 'ciddi') {
        iconName = 'rose-outline';
        iconColors = ['rgba(251, 191, 36, 0.12)', 'rgba(244, 63, 94, 0.25)'];
        iconColor = '#fbbf24';
        activeBorderGradients = ['#fbbf24', '#f43f5e'];
        activeGlowColor = '#fbbf24';
    } else if (opt.id === 'arkadaslik') {
        iconName = 'people-outline';
        iconColors = ['rgba(168, 85, 247, 0.12)', 'rgba(139, 92, 246, 0.25)'];
        iconColor = '#a855f7';
        activeBorderGradients = ['#a855f7', '#8b5cf6'];
        activeGlowColor = '#a855f7';
    } else if (opt.id === 'sesli') {
        iconName = 'headset-outline';
        iconColors = ['rgba(139, 92, 246, 0.12)', 'rgba(6, 182, 212, 0.25)'];
        iconColor = '#c084fc';
        activeBorderGradients = ['#8b5cf6', '#06b6d4'];
        activeGlowColor = '#8b5cf6';
    } else if (opt.id === 'eglence') {
        iconName = 'sparkles-outline';
        iconColors = ['rgba(249, 115, 22, 0.12)', 'rgba(236, 72, 153, 0.25)'];
        iconColor = '#f97316';
        activeBorderGradients = ['#f97316', '#ec4899'];
        activeGlowColor = '#f97316';
    }

    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={onPress}
            style={relStyles.touchableWrapper}
        >
            <LinearGradient
                colors={selected ? activeBorderGradients : ['rgba(255, 255, 255, 0.04)', 'rgba(255, 255, 255, 0.04)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                    relStyles.gradientBorder,
                    selected && {
                        shadowColor: activeGlowColor,
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.35,
                        shadowRadius: 12,
                        elevation: 8,
                    }
                ]}
            >
                <View style={[
                    relStyles.cardContainer,
                    !selected && relStyles.unselectedCard
                ]}>
                    <View style={relStyles.iconContainer}>
                        <Ionicons name={iconName} size={28} color={selected ? iconColor : 'rgba(255, 255, 255, 0.4)'} />
                    </View>

                    <Text style={[
                        relStyles.cardLabel,
                        selected ? relStyles.selectedLabel : relStyles.unselectedLabel
                    ]}>
                        {opt.label}
                    </Text>

                    {selected ? (
                        <Animated.View entering={FadeIn.duration(200)} style={relStyles.checkWrapper}>
                            <Ionicons name="checkmark-circle" size={24} color={activeGlowColor} />
                        </Animated.View>
                    ) : (
                        <View style={relStyles.emptyCheck} />
                    )}
                </View>
            </LinearGradient>
        </TouchableOpacity>
    );
};

const InterestChip = ({ opt, selected, onPress }) => {
    return (
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={onPress}
            style={[
                styles.chipWrapper,
                selected && styles.chipWrapperSelected
            ]}
        >
            {selected ? (
                <LinearGradient
                    colors={['#a855f7', '#ec4899']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.chipSelectedGradient}
                >
                    <Ionicons name={opt.icon} size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={[styles.chipText, styles.chipTextSelected]}>{opt.name}</Text>
                    <Animated.View entering={FadeIn.duration(150)} style={{ marginLeft: 6 }}>
                        <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    </Animated.View>
                </LinearGradient>
            ) : (
                <View style={styles.chipUnselectedContainer}>
                    <Ionicons name={opt.icon} size={16} color={opt.color} style={{ marginRight: 6 }} />
                    <Text style={styles.chipText}>{opt.name}</Text>
                </View>
            )}
        </TouchableOpacity>
    );
};

export default function OnboardingScreen({ navigation, route }) {
    const { refreshUser } = useChat();
    const insets = useSafeAreaInsets();
    const { userId, token } = route.params || {};
    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(false);

    // Alert State
    const [alert, setAlert] = useState({ visible: false, title: '', message: '', type: 'info' });

    // Form State
    const [name, setName] = useState('');
    const [gender, setGender] = useState(null);
    const [relationship, setRelationship] = useState([]);
    const [interests, setInterests] = useState([]);
    const [photo, setPhoto] = useState(null);
    const [city, setCity] = useState('');
    const [age, setAge] = useState('');
    const [boy, setBoy] = useState('');
    const [showCitySuggestions, setShowCitySuggestions] = useState(false);
    const [inputFocused, setInputFocused] = useState(false);

    const progress = useSharedValue(0);

    const nextStep = () => {
        // Validation
        if (currentStep === 1 && !name.trim()) {
            setAlert({ visible: true, title: 'Uyarı', message: 'Lütfen adınızı girin.', type: 'warning' });
            return;
        }
        if (currentStep === 2 && !gender) {
            setAlert({ visible: true, title: 'Uyarı', message: 'Lütfen cinsiyetinizi seçin.', type: 'warning' });
            return;
        }
        if (currentStep === 4) { // details step
            const isAgeValid = age && !isNaN(parseInt(age)) && parseInt(age) >= 18 && parseInt(age) <= 99;
            const isBoyValid = boy && !isNaN(parseInt(boy)) && parseInt(boy) >= 120 && parseInt(boy) <= 220;
            const isCityValid = city && TURKISH_CITIES.includes(city.trim());
            if (!isCityValid) {
                setAlert({ visible: true, title: 'Uyarı', message: 'Lütfen listeden geçerli bir şehir seçin.', type: 'warning' });
                return;
            }
            if (!isAgeValid) {
                setAlert({ visible: true, title: 'Uyarı', message: 'Lütfen geçerli bir yaş girin (18-99).', type: 'warning' });
                return;
            }
            if (!isBoyValid) {
                setAlert({ visible: true, title: 'Uyarı', message: 'Lütfen geçerli bir boy girin (120-220 cm).', type: 'warning' });
                return;
            }
        }

        if (currentStep < STEPS.length - 1) {
            setCurrentStep(prev => prev + 1);
            progress.value = withSpring((currentStep + 1) / (STEPS.length - 1));
        } else {
            handleComplete();
        }
    };

    const prevStep = () => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
            progress.value = withSpring((currentStep - 1) / (STEPS.length - 1));
        }
    };

    const handleComplete = async () => {
        setLoading(true);
        try {
            // --- TOKEN FALLBACK SYSTEM ---
            let activeToken = token;
            let activeUserId = userId;

            if (!activeToken || !activeUserId) {
                console.log('[Onboarding] Missing params, checking AsyncStorage...');
                const storedToken = await AsyncStorage.getItem('token');
                const storedUserJson = await AsyncStorage.getItem('user');
                if (storedToken) activeToken = storedToken;
                if (storedUserJson) {
                    const parsed = JSON.parse(storedUserJson);
                    if (parsed.id) activeUserId = parsed.id;
                }
            }

            if (!activeToken) {
                throw new Error('Oturum anahtarı bulunamadı. Lütfen tekrar giriş yapın.');
            }
            // -----------------------------

            let photoUrl = '';
            if (photo) {
                const formData = new FormData();
                formData.append('file', {
                    uri: photo,
                    name: 'photo.jpg',
                    type: 'image/jpeg',
                });
                const uploadRes = await axios.post(`${API_URL}/upload`, formData, {
                    headers: { 
                        'Content-Type': 'multipart/form-data',
                        'Authorization': `Bearer ${activeToken}`
                    }
                });
                photoUrl = uploadRes.data.url;

                await axios.post(`${API_URL}/moderation/submit`, {
                    userId: activeUserId,
                    type: 'avatar',
                    url: photoUrl
                }, {
                    headers: { 'Authorization': `Bearer ${activeToken}` }
                });
            }

            // Update user profile
            const updateRes = await axios.put(`${API_URL}/users/${activeUserId}/profile`, {
                display_name: name,
                name: name,
                gender,
                interests: JSON.stringify(interests),
                relationship: relationship.length > 0 ? relationship.join(',') : null,
                age: age ? parseInt(age) : null,
                boy: boy || null,
                city: city || null,
                onboarding_completed: true,
                avatar_url: photoUrl || undefined
            }, {
                headers: { 'Authorization': `Bearer ${activeToken}` }
            });

            const updatedUser = updateRes.data;

            const userJson = await AsyncStorage.getItem('user');
            if (userJson) {
                const userData = { ...JSON.parse(userJson), ...updatedUser, onboarding_completed: true };
                await AsyncStorage.setItem('user', JSON.stringify(userData));
            }

            // Sync global socket connection with completed onboarding user data
            await refreshUser();

            setAlert({
                visible: true,
                title: 'Başarılı',
                message: 'Profilin hazır! Aramıza hoş geldin.',
                type: 'success',
                onClose: () => {
                    setTimeout(() => {
                        navigation.replace('Main', { user: { ...updatedUser, token: activeToken } });
                    }, 300);
                }
            });
        } catch (err) {
            console.error('Onboarding Error:', err);
            const errorData = err.response?.data;
            const errorMsg = errorData?.error || errorData?.message || err.message;
            const errorDetails = errorData?.details || '';
            const statusCode = err.response?.status || 'N/A';

            setAlert({
                visible: true,
                title: 'Hata',
                message: `Bilgiler kaydedilirken bir sorun oluştu.\n\n${errorMsg}\n${errorDetails ? `Detay: ${errorDetails}\n` : ''}Kod: ${statusCode}`,
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled) {
            setPhoto(result.assets[0].uri);
        }
    };

    const renderProgress = () => (
        <View style={styles.progressContainer}>
            {STEPS.map((_, index) => (
                <View
                    key={index}
                    style={[
                        styles.progressDot,
                        currentStep >= index && styles.progressDotActive,
                        currentStep === index && styles.progressDotCurrent
                    ]}
                />
            ))}
        </View>
    );

    const renderStepContent = () => {
        const step = STEPS[currentStep];

        return (
            <Animated.View
                key={step.id}
                entering={SlideInRight.duration(400)}
                exiting={FadeOut.duration(200)}
                style={styles.stepWrapper}
            >
                {step.id === 'welcome' ? (
                    <>
                        <View style={styles.textCenter}>
                            <Text style={styles.title}>{step.title}</Text>
                            <Text style={styles.subtitle}>{step.subtitle}</Text>
                        </View>

                        <View style={styles.welcomeContainer}>
                            <View>
                                <PremiumWelcomeIllustration />
                            </View>
                            <Text style={styles.welcomeInfo}>
                                Profilini birkaç adımda oluştur,{'\n'}sana uygun kişileri ve sesli odaları önerelim.
                            </Text>
                        </View>
                    </>
                ) : step.id === 'name' ? (
                    <>
                        <View style={styles.textCenter}>
                            <Text style={styles.title}>{step.title}</Text>
                            <Text style={styles.subtitle}>{step.subtitle}</Text>
                        </View>

                        <View style={{ width: '100%', alignItems: 'center' }}>
                            <MiniProfilePreview name={name} />
                        </View>

                        <OnboardingNameInput
                            name={name}
                            setName={setName}
                            inputFocused={inputFocused}
                            setInputFocused={setInputFocused}
                        />

                        <View style={{ width: '100%', marginTop: 10 }}>
                            <View style={nameStyles.infoContainer}>
                                <View style={nameStyles.infoLine}>
                                    <Ionicons name="information-circle-outline" size={13} color="rgba(255,255,255,0.4)" />
                                    <Text style={nameStyles.infoText}>2–16 karakter kullan. Numara ve uygunsuz içerik kullanma.</Text>
                                </View>
                                <View style={nameStyles.infoLine}>
                                    <Ionicons name="create-outline" size={13} color="rgba(255,255,255,0.3)" />
                                    <Text style={nameStyles.subInfoText}>İstersen bu adı daha sonra değiştirebilirsin.</Text>
                                </View>
                            </View>
                        </View>
                    </>
                ) : (
                    <>
                        <View style={styles.textCenter}>
                            <Text style={styles.title}>{step.title}</Text>
                            <Text style={styles.subtitle}>{step.subtitle}</Text>
                        </View>
                    </>
                )}

                {step.id === 'name' && (
                    <View style={styles.inputStepContainer}>
                    </View>
                )}

                {step.id === 'gender' && (
                    <View style={{ width: '100%', marginTop: 10 }}>
                        {GENDER_OPTIONS.map(opt => (
                            <GenderOptionCard
                                key={opt.id}
                                opt={opt}
                                selected={gender === opt.id}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setGender(opt.id);
                                }}
                            />
                        ))}
                    </View>
                )}

                {step.id === 'relationship' && (
                    <ScrollView 
                        style={{ width: '100%', maxHeight: height * 0.52 }}
                        contentContainerStyle={{ paddingBottom: 10 }}
                        showsVerticalScrollIndicator={false}
                    >
                        {RELATIONSHIP_OPTIONS.map(opt => (
                            <RelationshipOptionCard
                                key={opt.id}
                                opt={opt}
                                selected={relationship.includes(opt.id)}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    if (relationship.includes(opt.id)) {
                                        setRelationship(relationship.filter(i => i !== opt.id));
                                    } else {
                                        if (relationship.length >= 2) {
                                            setAlert({
                                                visible: true,
                                                title: 'Uyarı',
                                                message: 'En fazla 2 seçim yapabilirsiniz.',
                                                type: 'warning'
                                            });
                                            return;
                                        }
                                        setRelationship([...relationship, opt.id]);
                                    }
                                }}
                            />
                        ))}
                    </ScrollView>
                )}

                {step.id === 'details' && (
                    <View style={detailsStyles.formContainer}>
                        {/* City Input */}
                        <View style={detailsStyles.inputGroup}>
                            <Text style={detailsStyles.label}>Hangi Şehirde Yaşıyorsun?</Text>
                            <View style={detailsStyles.inputWrapper}>
                                <Ionicons name="location-outline" size={20} color="rgba(255,255,255,0.4)" style={{ marginRight: 10 }} />
                                <TextInput
                                    style={detailsStyles.input}
                                    placeholder="Şehir adı ara veya gir..."
                                    placeholderTextColor="rgba(255, 255, 255, 0.3)"
                                    value={city}
                                    onChangeText={(val) => {
                                        setCity(val);
                                        setShowCitySuggestions(true);
                                    }}
                                    onFocus={() => setShowCitySuggestions(true)}
                                    color="white"
                                />
                            </View>
                            {/* City Suggestions */}
                            {showCitySuggestions && city.trim().length > 0 && (
                                <View style={detailsStyles.suggestionsList}>
                                    <ScrollView keyboardShouldPersistTaps="always" style={{ maxHeight: 150 }}>
                                        {TURKISH_CITIES.filter(c => c.toLowerCase().includes(city.toLowerCase()))
                                            .slice(0, 5)
                                            .map(c => (
                                                <TouchableOpacity
                                                    key={c}
                                                    style={detailsStyles.suggestionItem}
                                                    onPress={() => {
                                                        setCity(c);
                                                        setShowCitySuggestions(false);
                                                    }}
                                                >
                                                    <Ionicons name="location-outline" size={14} color="#a855f7" style={{ marginRight: 8 }} />
                                                    <Text style={detailsStyles.suggestionText}>{c}</Text>
                                                </TouchableOpacity>
                                            ))
                                        }
                                    </ScrollView>
                                </View>
                            )}
                        </View>

                        <View style={detailsStyles.row}>
                            {/* Age Input */}
                            <View style={[detailsStyles.inputGroup, { flex: 1, marginRight: 10 }]}>
                                <Text style={detailsStyles.label}>Yaşın</Text>
                                <View style={detailsStyles.inputWrapper}>
                                    <Ionicons name="calendar-outline" size={20} color="rgba(255,255,255,0.4)" style={{ marginRight: 10 }} />
                                    <TextInput
                                        style={detailsStyles.input}
                                        placeholder="Örn: 25"
                                        placeholderTextColor="rgba(255, 255, 255, 0.3)"
                                        value={age}
                                        onChangeText={setAge}
                                        keyboardType="number-pad"
                                        maxLength={2}
                                        color="white"
                                    />
                                </View>
                            </View>

                            {/* Height Input */}
                            <View style={[detailsStyles.inputGroup, { flex: 1, marginLeft: 10 }]}>
                                <Text style={detailsStyles.label}>Boyun (cm)</Text>
                                <View style={detailsStyles.inputWrapper}>
                                    <Ionicons name="man-outline" size={20} color="rgba(255,255,255,0.4)" style={{ marginRight: 10 }} />
                                    <TextInput
                                        style={detailsStyles.input}
                                        placeholder="Örn: 175"
                                        placeholderTextColor="rgba(255, 255, 255, 0.3)"
                                        value={boy}
                                        onChangeText={setBoy}
                                        keyboardType="number-pad"
                                        maxLength={3}
                                        color="white"
                                    />
                                </View>
                            </View>
                        </View>
                    </View>
                )}

                {step.id === 'interests' && (
                    <View style={{ width: '100%', height: height * 0.46, alignItems: 'center' }}>
                        <Text style={styles.interestsCounter}>
                            {interests.length < 3 
                                ? `En az 3 seçim yap (Şu an: ${interests.length}/5)` 
                                : `Seçim limiti: ${interests.length}/5`}
                        </Text>
                        <ScrollView 
                            contentContainerStyle={styles.interestsGrid} 
                            showsVerticalScrollIndicator={false}
                            style={{ width: '100%' }}
                        >
                            {INTERESTS_DATA.map(opt => (
                                <InterestChip
                                    key={opt.name}
                                    opt={opt}
                                    selected={interests.includes(opt.name)}
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        if (interests.includes(opt.name)) {
                                            setInterests(interests.filter(i => i !== opt.name));
                                        } else {
                                            if (interests.length >= 5) {
                                                setAlert({
                                                    visible: true,
                                                    title: 'Uyarı',
                                                    message: 'En fazla 5 ilgi alanı seçebilirsiniz.',
                                                    type: 'warning'
                                                });
                                                return;
                                            }
                                            setInterests([...interests, opt.name]);
                                        }
                                    }}
                                />
                            ))}
                        </ScrollView>
                    </View>
                )}

                {step.id === 'photo' && (
                    <View style={styles.photoContainer}>
                        <TouchableOpacity style={styles.photoPicker} onPress={pickImage}>
                            {photo ? (
                                <Image source={{ uri: photo }} style={styles.previewImage} />
                            ) : (
                                <View style={styles.photoPlaceholder}>
                                    <Ionicons name="camera" size={40} color="#64748b" />
                                    <Text style={styles.photoPlaceholderText}>Fotoğraf Seç</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>
                )}
            </Animated.View>
        );
    };

    const isStepValid = () => {
        const step = STEPS[currentStep];
        if (step.id === 'name') return isNameValid(name);
        if (step.id === 'gender') return gender !== null;
        if (step.id === 'relationship') return relationship.length > 0;
        if (step.id === 'details') {
            const isAgeValid = age && !isNaN(parseInt(age)) && parseInt(age) >= 18 && parseInt(age) <= 99;
            const isBoyValid = boy && !isNaN(parseInt(boy)) && parseInt(boy) >= 120 && parseInt(boy) <= 220;
            const isCityValid = city && TURKISH_CITIES.includes(city.trim());
            return !!(isAgeValid && isBoyValid && isCityValid);
        }
        if (step.id === 'interests') return interests.length >= 3;
        if (step.id === 'photo') return photo !== null;
        return true;
    };

    const isNextDisabled = () => {
        if (currentStep === 1) return !name.trim();
        if (currentStep === 2) return !gender;
        return false;
    };

    return (
        <View style={styles.container}>
            <AuthBackground hideCircles />

            <SafeAreaView style={{ flex: 1 }}>
                <View style={styles.header}>
                    <TouchableOpacity 
                        onPress={() => {
                            if (currentStep > 0) {
                                prevStep();
                            } else {
                                if (navigation.canGoBack()) {
                                    navigation.goBack();
                                } else {
                                    navigation.replace('Welcome');
                                }
                            }
                        }} 
                        style={styles.backButton}
                    >
                        <Ionicons name="chevron-back" size={20} color="white" />
                    </TouchableOpacity>
                    {renderProgress()}
                    <View style={{ width: 36 }} />
                </View>

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 40}
                    style={styles.content}
                >
                    {renderStepContent()}
                </KeyboardAvoidingView>

                <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                    <GradientButton
                        title={currentStep === STEPS.length - 1 ? 'TAMAMLA' : 'DEVAM ET'}
                        onPress={nextStep}
                        disabled={!isStepValid()}
                        loading={loading}
                        style={styles.nextButton}
                    />
                </View>
            </SafeAreaView>

            <ModernAlert
                visible={alert.visible}
                title={alert.title}
                message={alert.message}
                type={alert.type}
                onClose={() => {
                    if (alert.onClose) alert.onClose();
                    setAlert({ ...alert, visible: false });
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#030712' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 10 : 30,
        height: 80
    },
    backButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    progressContainer: { flexDirection: 'row', gap: 6 },
    progressDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.1)' },
    progressDotActive: {
        backgroundColor: '#a855f7',
        shadowColor: '#a855f7',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 5,
        elevation: 5,
    },
    progressDotCurrent: {
        width: 20,
        backgroundColor: '#ec4899',
        shadowColor: '#ec4899',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 6,
        elevation: 6,
    },
    content: { flex: 1, paddingHorizontal: 25, justifyContent: 'center' },
    stepWrapper: { width: '100%', alignItems: 'center' },
    textCenter: { alignItems: 'center', marginBottom: 50 },
    title: { fontSize: 34, fontWeight: '900', color: 'white', marginBottom: 16, textAlign: 'center', letterSpacing: -1 },
    subtitle: { fontSize: 16, color: 'rgba(255,255,255,0.7)', textAlign: 'center', fontWeight: '500', lineHeight: 24, paddingHorizontal: 20 },
    welcomeContainer: { alignItems: 'center', gap: 35 },
    welcomeIconCircle: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', elevation: 20, shadowColor: '#8b5cf6', shadowOffset: { width: 0, height: 15 }, shadowOpacity: 0.6, shadowRadius: 25 },
    welcomeInfo: { color: 'rgba(255,255,255,0.5)', fontSize: 18, textAlign: 'center', lineHeight: 26, paddingHorizontal: 15, fontWeight: '400' },
    inputStepContainer: { width: '100%', alignItems: 'center' },
    inputShadow: {
        width: '100%',
        borderRadius: 28,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.08)',
        shadowColor: '#8b5cf6',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        overflow: 'hidden'
    },
    textInput: {
        padding: 24,
        color: 'white',
        fontSize: 32,
        fontWeight: '800',
        letterSpacing: -0.5
    },
    inputHint: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 15, opacity: 0.8 },
    hintText: { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: '500' },
    optionsContainer: { gap: 14, width: '100%' },
    optionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 24,
        padding: 22,
        gap: 18,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.06)'
    },
    optionCardSelected: {
        backgroundColor: 'rgba(139, 92, 246, 0.2)',
        borderColor: '#8b5cf6'
    },
    optionText: { fontSize: 19, color: 'rgba(255,255,255,0.5)', fontWeight: '700' },
    optionTextSelected: { color: 'white' },
    interestsCounter: {
        color: 'rgba(255, 255, 255, 0.55)',
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 16,
        letterSpacing: 0.2,
    },
    interestsGrid: { 
        flexDirection: 'row', 
        flexWrap: 'wrap', 
        gap: 10, 
        paddingBottom: 20, 
        justifyContent: 'center',
        paddingHorizontal: 5
    },
    chipWrapper: {
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.035)',
        borderWidth: 1.2,
        borderColor: 'rgba(255,255,255,0.06)',
        overflow: 'hidden',
    },
    chipWrapperSelected: {
        borderColor: 'transparent',
        shadowColor: '#a855f7',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    chipSelectedGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    chipUnselectedContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    chipText: { 
        color: 'rgba(255,255,255,0.65)', 
        fontWeight: '600', 
        fontSize: 14 
    },
    chipTextSelected: { 
        color: '#FFFFFF',
        fontWeight: '700'
    },
    photoContainer: { alignItems: 'center' },
    photoPicker: {
        width: 240,
        height: 240,
        borderRadius: 120,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.08)',
        borderStyle: 'dashed',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#8b5cf6',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20
    },
    previewImage: { width: '100%', height: '100%' },
    photoPlaceholder: { alignItems: 'center', gap: 15 },
    photoPlaceholderText: { color: 'rgba(255,255,255,0.3)', fontSize: 17, fontWeight: '600' },
    footer: { padding: 30, paddingBottom: Platform.OS === 'ios' ? 40 : 30 },
    nextButton: { height: 68, borderRadius: 34, shadowColor: '#8b5cf6', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 15, elevation: 10 }
});

const illStyles = StyleSheet.create({
    illContainer: {
        width: width * 0.9,
        height: 230,
        justifyContent: 'center',
        alignItems: 'center',
        marginVertical: 10,
        position: 'relative',
    },
    glowAura: {
        position: 'absolute',
        width: 170,
        height: 170,
        borderRadius: 85,
        backgroundColor: '#8b5cf6',
        opacity: 0.14,
        shadowColor: '#8b5cf6',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 30,
        elevation: 8,
    },
    profileCard: {
        width: 120,
        height: 170,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.12)',
        overflow: 'hidden',
        position: 'absolute',
        backgroundColor: '#1f2937',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 6,
    },
    frontCard: {
        left: '20%',
        zIndex: 2,
    },
    backCard: {
        right: '20%',
        zIndex: 1,
    },
    cardImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    cardDetails: {
        position: 'absolute',
        bottom: 8,
        left: 10,
        right: 10,
        zIndex: 3,
    },
    cardName: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: -0.2,
    },
    matchHeartBadge: {
        position: 'absolute',
        zIndex: 4,
        width: 48,
        height: 48,
        borderRadius: 24,
        shadowColor: '#ec4899',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.45,
        shadowRadius: 12,
        elevation: 10,
    },
    heartGradient: {
        flex: 1,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#030712',
    },
    floatBadge: {
        position: 'absolute',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 5,
        zIndex: 5,
    },
    badgeSelinLeft: {
        left: '6%',
        top: 15,
    },
    badgeCanRight: {
        right: '6%',
        bottom: 15,
    },
    badgeGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 14,
        gap: 4,
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '800',
    },
});

const nameStyles = StyleSheet.create({
    verticalPreview: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        alignSelf: 'center',
    },
    avatarOuterRing: {
        width: 102,
        height: 102,
        borderRadius: 51,
        borderWidth: 2.5,
        borderColor: 'rgba(168, 85, 247, 0.35)',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#a855f7',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        position: 'relative',
    },
    largeAvatar: {
        width: 90,
        height: 90,
        borderRadius: 45,
        alignItems: 'center',
        justifyContent: 'center',
    },
    largeOnlineIndicator: {
        position: 'absolute',
        bottom: 3,
        right: 3,
        width: 13,
        height: 13,
        borderRadius: 6.5,
        backgroundColor: '#10b981',
        borderWidth: 2,
        borderColor: '#030712',
        zIndex: 3,
    },
    verticalName: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '900',
        marginTop: 12,
        textAlign: 'center',
        letterSpacing: -0.2,
    },
    verticalSub: {
        color: 'rgba(255, 255, 255, 0.45)',
        fontSize: 11,
        fontWeight: '600',
        marginTop: 4,
        textAlign: 'center',
    },
    container: {
        height: 68,
        borderRadius: 24,
        borderWidth: 1.5,
        backgroundColor: '#1a0533',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        width: '100%',
        marginBottom: 12,
        overflow: 'hidden',
    },
    containerFocused: {
        shadowColor: '#EC4DA7',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
        elevation: 6,
    },
    input: {
        flex: 1,
        alignSelf: 'stretch',
        margin: 0,
        paddingHorizontal: 0,
        paddingVertical: 0,
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '600',
        includeFontPadding: false,
        textAlignVertical: 'center',
    },
    checkWrapper: {
        marginLeft: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    infoContainer: {
        gap: 6,
        paddingHorizontal: 10,
    },
    infoLine: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    infoText: {
        color: 'rgba(255, 255, 255, 0.65)',
        fontSize: 11,
        fontWeight: '600',
    },
    subInfoText: {
        color: 'rgba(255, 255, 255, 0.55)',
        fontSize: 10.5,
        fontWeight: '600',
    },
});

const relStyles = StyleSheet.create({
    touchableWrapper: {
        width: '100%',
        height: 78,
        marginBottom: 12,
    },
    gradientBorder: {
        borderRadius: 20,
        padding: 1.5,
        flex: 1,
    },
    cardContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#030712',
        borderRadius: 18.5,
        paddingHorizontal: 20,
        flex: 1,
    },
    unselectedCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.025)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    iconContainer: {
        width: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardLabel: {
        flex: 1,
        fontSize: 18,
        fontWeight: '700',
        marginLeft: 16,
    },
    selectedLabel: {
        color: '#FFFFFF',
    },
    unselectedLabel: {
        color: 'rgba(255, 255, 255, 0.65)',
    },
    checkWrapper: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyCheck: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
});

const genderStyles = StyleSheet.create({
    touchableWrapper: {
        width: '100%',
        height: 90,
        marginBottom: 16,
    },
    gradientBorder: {
        borderRadius: 20,
        padding: 1.5,
        flex: 1,
    },
    selectedGlow: {
        shadowColor: '#a855f7',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    cardContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#030712',
        borderRadius: 18.5,
        paddingHorizontal: 20,
        flex: 1,
    },
    unselectedCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.025)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    iconBg: {
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardLabel: {
        flex: 1,
        fontSize: 22,
        fontWeight: '700',
        marginLeft: 18,
    },
    selectedLabel: {
        color: '#FFFFFF',
    },
    unselectedLabel: {
        color: 'rgba(255, 255, 255, 0.6)',
    },
    checkWrapper: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyCheck: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
});

const detailsStyles = StyleSheet.create({
    formContainer: {
        width: '100%',
        marginTop: 10,
        gap: 16,
    },
    inputGroup: {
        width: '100%',
        position: 'relative',
    },
    row: {
        flexDirection: 'row',
        width: '100%',
    },
    label: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
        paddingLeft: 4,
    },
    inputWrapper: {
        height: 60,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        backgroundColor: '#1a0533',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        overflow: 'hidden',
    },
    input: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
        paddingVertical: 0,
        margin: 0,
        height: '100%',
    },
    suggestionsList: {
        position: 'absolute',
        top: 86,
        left: 0,
        right: 0,
        backgroundColor: '#110c24',
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        zIndex: 999,
        padding: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 15,
        elevation: 10,
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
    },
    suggestionText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
});
