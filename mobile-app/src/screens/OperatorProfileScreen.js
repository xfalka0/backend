import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Dimensions, Pressable } from 'react-native';
import axios from 'axios';
import { API_URL } from '../config';
import * as Haptics from 'expo-haptics';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    useAnimatedScrollHandler,
    interpolate,
    Extrapolate
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import GlassCard from '../components/ui/GlassCard';
import { useTheme } from '../contexts/ThemeContext';
import { Motion } from '../components/motion/MotionSystem';
import VipFrame from '../components/ui/VipFrame';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ImageViewing from 'react-native-image-viewing';

const { width } = Dimensions.get('window');
const HEADER_HEIGHT = width * 1.2;

export default function OperatorProfileScreen({ route, navigation }) {
    const insets = useSafeAreaInsets();
    const { theme, themeMode } = useTheme();
    const { operator, user } = route.params;

    const [isFavorited, setIsFavorited] = useState(false);
    const [isImageViewerVisible, setIsImageViewerVisible] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    useEffect(() => {
        // Track Profile View
        if (user && operator) {
            axios.post(`${API_URL}/views`, {
                viewerId: user.id,
                viewedUserId: operator.id || operator.user_id // Handle operator vs user objects
            }).catch(e => console.log('View track err', e));
        }

        // Check if favorited
        if (user && operator) {
            axios.get(`${API_URL}/favorites/check/${user.id}/${operator.id || operator.user_id}`)
                .then(res => setIsFavorited(res.data.isFavorited))
                .catch(e => console.log('Fav check err', e));
        }
    }, [user, operator]);

    const handleFavorite = async () => {
        if (!user || !operator) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            const targetId = operator.id || operator.user_id;
            if (isFavorited) {
                await axios.delete(`${API_URL}/favorites/${targetId}`, { data: { userId: user.id } });
                setIsFavorited(false);
            } else {
                await axios.post(`${API_URL}/favorites`, { userId: user.id, targetUserId: targetId });
                setIsFavorited(true);
            }
        } catch (e) {
            console.error('Fav action err', e);
        }
    };

    // 1. Scroll pozisyonunu takip etmek için bir sharedValue oluşturuyoruz.
    // Bu değer, sayfa her kaydırıldığında Reanimated tarafından güncellenecek.
    const scrollY = useSharedValue(0);

    // 2. Scroll event'lerini SharedValue'ya aktaran handler.
    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollY.value = event.contentOffset.y;
        },
    });

    // 3. Header resmi için animasyonlu stil.
    // interpolate() fonksiyonu ile scroll değerini (0'dan HEADER_HEIGHT'a) 
    // resmin boyutuna (1'den 1.2'ye) veya pozisyonuna bağlıyoruz.
    const animatedImageStyle = useAnimatedStyle(() => {
        return {
            transform: [
                {
                    // Daha derin bir bounce efekti için input range'i artırdık (-300)
                    scale: interpolate(
                        scrollY.value,
                        [-300, 0],
                        [2, 1],
                        Extrapolate.CLAMP
                    ),
                },
                {
                    // Sayfayı yukarı kaydırdığımızda resmin parallax efektiyle yavaşça yukarı kaymasını sağladık
                    translateY: interpolate(
                        scrollY.value,
                        [0, HEADER_HEIGHT],
                        [0, -HEADER_HEIGHT * 0.4],
                        Extrapolate.CLAMP
                    ),
                }
            ],
            // Resim yukarı çıktıkça yavaşça solmasını sağlıyoruz
            opacity: interpolate(
                scrollY.value,
                [0, HEADER_HEIGHT * 0.8],
                [1, 0.4],
                Extrapolate.CLAMP
            )
        };
    });

    // 4. Header resminin üzerine binen bulanıklık efekti.
    // Sayfa yukarı kaydırıldıkça resim yavaşça solar ve bulanıklaşır.
    const animatedBlurStyle = useAnimatedStyle(() => {
        return {
            opacity: interpolate(
                scrollY.value,
                [0, HEADER_HEIGHT * 0.8],
                [0, 1],
                Extrapolate.CLAMP
            ),
        };
    });

    return (
        <View style={styles.container}>
            {/* Animasyonlu Header Arka Planı */}
            <Animated.View
                pointerEvents="none"
                style={[styles.imageContainer, animatedImageStyle]}
            >
                <Image
                    source={{ uri: operator.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(operator.name)}&background=random&color=fff` }}
                    style={styles.mainImage}
                />
                <LinearGradient
                    colors={themeMode === 'dark'
                        ? ['rgba(15, 23, 42, 0.2)', 'rgba(15, 23, 42, 0.4)', '#0f172a']
                        : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.3)', theme.colors.background]}
                    style={styles.gradientOverlay}
                />

                {/* Scroll ile aktive olan Blur efekti */}
                <Animated.View style={[StyleSheet.absoluteFill, animatedBlurStyle]}>
                    <BlurView intensity={20} tint={themeMode === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                </Animated.View>
            </Animated.View>

            {/* Modern Floating Header */}
            <View style={[styles.floatingHeader, { paddingTop: insets.top + 10 }]}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.headerIconButton}
                >
                    <BlurView intensity={50} tint="dark" style={styles.iconBlur}>
                        <Ionicons name="chevron-back" size={24} color="white" />
                    </BlurView>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={handleFavorite}
                    style={styles.headerIconButton}
                >
                    <BlurView intensity={50} tint="dark" style={styles.iconBlur}>
                        <Ionicons
                            name={isFavorited ? "heart" : "heart-outline"}
                            size={24}
                            color={isFavorited ? "#ef4444" : "white"}
                        />
                    </BlurView>
                </TouchableOpacity>
            </View>

            <Animated.ScrollView
                onScroll={scrollHandler}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* Header için boşluk bırakıyoruz çünkü resim statik olarak arkada duruyor */}
                <View style={{ height: HEADER_HEIGHT - 90 }} />

                {/* Profil Aksiyon Butonları (Resmin üstüne binen) */}
                <Motion.SlideUp delay={100}>
                    <View style={styles.heroActionsRow}>
                        {/* Video, Mic, Gift actions removed as requested */}
                        <TouchableOpacity
                            style={[styles.heroActionButton, { backgroundColor: isFavorited ? 'rgba(239, 68, 68, 0.95)' : 'rgba(255, 255, 255, 0.15)' }]}
                            activeOpacity={0.8}
                            onPress={handleFavorite}
                        >
                            <Ionicons name="heart" size={24} color={isFavorited ? "white" : "#cbd5e1"} />
                        </TouchableOpacity>
                    </View>
                </Motion.SlideUp>

                {/* İçerik Alanı: Glassmorphism kullanarak arka planı hafif gösteriyoruz */}
                <Motion.Fade delay={200}>
                    <GlassCard
                        style={[
                            styles.contentCard,
                            { backgroundColor: themeMode === 'dark' ? '#0f172a' : theme.colors.surface }
                        ]}
                        intensity={70}
                        tint="dark"
                    >
                        <View style={styles.nameRow}>
                            <View style={{ marginRight: 15 }}>
                                <VipFrame
                                    level={operator.vip_level}
                                    avatar={operator.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(operator.name)}&background=random&color=fff`}
                                    size={60}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text
                                        style={[styles.name, { flexShrink: 1 }]}
                                        numberOfLines={1}
                                        adjustsFontSizeToFit
                                        minimumFontScale={0.8}
                                    >
                                        {operator.name}
                                    </Text>
                                    {operator.vip_level > 0 && (
                                        <LinearGradient
                                            colors={
                                                operator.vip_level === 1 ? ['#94a3b8', '#64748b'] :
                                                    operator.vip_level === 2 ? ['#3b82f6', '#8b5cf6'] :
                                                        operator.vip_level === 3 ? ['#a855f7', '#ec4899'] :
                                                            operator.vip_level === 4 ? ['#fbbf24', '#7c3aed'] :
                                                                operator.vip_level === 5 ? ['#e879f9', '#d946ef'] :
                                                                    ['#000000', '#1a1a1a']
                                            }
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={styles.premiumVipBadge}
                                        >
                                            <Ionicons name="star" size={12} color={operator.vip_level >= 4 ? "#fff" : "#fbbf24"} />
                                            <Text style={styles.premiumVipText}>VIP {operator.vip_level}</Text>
                                        </LinearGradient>
                                    )}
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                                    <Text style={styles.category}>
                                        {operator.is_operator && operator.category ? `${operator.category} • ` : ''}
                                        {operator.job || (operator.is_operator ? 'Öğrenci' : 'Kullanıcı')}
                                    </Text>
                                    {operator.age && (
                                        <View style={[
                                            styles.ageBadge,
                                            { backgroundColor: operator.gender === 'erkek' ? '#3b82f6' : '#f472b6' }
                                        ]}>
                                            <Ionicons name={operator.gender === 'erkek' ? "male" : "female"} size={12} color="white" />
                                            <Text style={styles.ageBadgeText}>{operator.age}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                            {operator.is_online && (
                                <View style={styles.onlineBadge}>
                                    <View style={styles.onlineDot} />
                                    <Text style={styles.onlineText}>Çevrimiçi</Text>
                                </View>
                            )}
                        </View>

                        <Motion.Fade delay={400}>
                            {/* 1. Fotoğraf Albümü (En Üstte) */}
                            {operator.photos && operator.photos.length > 0 && (
                                <View style={styles.section}>
                                    <Text style={styles.sectionTitle}>Fotoğraf Albümü</Text>
                                    <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.albumScroll}>
                                        {operator.photos.map((photo, index) => (
                                            <Motion.SlideUp delay={500 + (index * 100)} key={index}>
                                                <Pressable onPress={() => {
                                                    setCurrentImageIndex(index);
                                                    setIsImageViewerVisible(true);
                                                }}>
                                                    <Image source={{ uri: photo }} style={styles.albumPhoto} />
                                                </Pressable>
                                            </Motion.SlideUp>
                                        ))}
                                    </Animated.ScrollView>
                                </View>
                            )}

                            {/* 2. Hakkımda */}
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Hakkımda</Text>
                                <Text style={styles.bioText}>{operator.bio || 'Merhaba! Seninle tanışmak için sabırsızlanıyorum.'}</Text>
                            </View>

                            {/* 3. Kişisel Bilgiler ve İlgi Alanları */}
                            {(operator.relationship || operator.zodiac || operator.interests) && (
                                <View style={styles.section}>
                                    <Text style={styles.sectionTitle}>Kişisel Bilgiler</Text>
                                    <View style={styles.infoTagsContainer}>
                                        {operator.relationship && (
                                            <View style={[styles.infoTag, { backgroundColor: 'rgba(236, 72, 153, 0.15)', borderColor: 'rgba(236, 72, 153, 0.3)' }]}>
                                                <Ionicons name="heart" size={14} color="#ec4899" />
                                                <Text style={[styles.infoTagText, { color: '#fbcfe8' }]}>{operator.relationship}</Text>
                                            </View>
                                        )}
                                        {operator.zodiac && (
                                            <View style={[styles.infoTag, { backgroundColor: 'rgba(139, 92, 246, 0.15)', borderColor: 'rgba(139, 92, 246, 0.3)' }]}>
                                                <Ionicons name="sparkles" size={14} color="#a78bfa" />
                                                <Text style={[styles.infoTagText, { color: '#ddd6fe' }]}>{operator.zodiac}</Text>
                                            </View>
                                        )}
                                        {operator.job && (
                                            <View style={[styles.infoTag, { backgroundColor: 'rgba(59, 130, 246, 0.15)', borderColor: 'rgba(59, 130, 246, 0.3)' }]}>
                                                <Ionicons name="briefcase" size={14} color="#60a5fa" />
                                                <Text style={[styles.infoTagText, { color: '#dbeafe' }]}>{operator.job}</Text>
                                            </View>
                                        )}
                                    </View>

                                    {operator.interests && (
                                        <View style={{ marginTop: 12 }}>
                                            <Text style={[styles.sectionTitle, { fontSize: 14, marginBottom: 8, opacity: 0.8 }]}>İlgi Alanları</Text>
                                            <View style={styles.interestsContainer}>
                                                {(Array.isArray(operator.interests) ? operator.interests : JSON.parse(operator.interests || '[]').length > 0 ? JSON.parse(operator.interests) : operator.interests.split(',')).map((interest, idx) => (
                                                    <View key={idx} style={styles.interestTag}>
                                                        <Text style={styles.interestText}>{interest.trim()}</Text>
                                                    </View>
                                                ))}
                                            </View>
                                        </View>
                                    )}
                                </View>
                            )}
                        </Motion.Fade>

                        <View style={{ height: 100 }} />
                    </GlassCard>
                </Motion.Fade>
            </Animated.ScrollView>

            {/* Alttaki Mesaj Butonu */}
            <View style={styles.bottomContainer}>
                <BlurView intensity={60} tint="dark" style={styles.bottomBlur}>
                    <TouchableOpacity
                        style={styles.messageButton}
                        onPress={() => navigation.navigate('Chat', {
                            operatorId: operator.id,
                            name: operator.name,
                            job: operator.job || 'Öğrenci',
                            avatar_url: operator.avatar_url,
                            is_online: operator.is_online,
                            vip_level: operator.vip_level,
                            user
                        })}
                    >
                        <LinearGradient
                            colors={['#8b5cf6', '#d946ef']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.gradientButton}
                        >
                            <Ionicons name="chatbubble-ellipses" size={20} color="white" />
                            <Text style={styles.buttonText}>Mesaj Gönder</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </BlurView>
            </View>

            {/* Tam Ekran Fotoğraf Görüntüleyici */}
            {operator.photos && operator.photos.length > 0 && (
                <ImageViewing
                    images={operator.photos.map(p => ({ uri: p }))}
                    imageIndex={currentImageIndex}
                    visible={isImageViewerVisible}
                    onRequestClose={() => setIsImageViewerVisible(false)}
                    swipeToCloseEnabled={true}
                    doubleTapToZoomEnabled={true}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    scrollContent: {
        paddingBottom: 40,
    },
    imageContainer: {
        width: width,
        height: HEADER_HEIGHT,
        position: 'absolute',
        top: 0,
    },
    mainImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    gradientOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: HEADER_HEIGHT,
    },
    floatingHeader: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        zIndex: 100,
    },
    headerIconButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        overflow: 'hidden',
    },
    iconBlur: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroActionsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 20,
        marginBottom: 20,
        paddingHorizontal: 20,
        zIndex: 10,
    },
    heroActionButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    contentCard: {
        marginHorizontal: 15,
        padding: 20,
        borderRadius: 35,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
    },
    nameRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 25,
    },
    name: {
        fontSize: 20, // Reduced from 28
        fontWeight: '900',
        color: 'white',
        letterSpacing: -0.7,
    },
    category: {
        fontSize: 12, // Reduced from 16
        color: '#94a3b8',
        fontWeight: '600',
        marginTop: 4,
    },
    premiumVipBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 5, // Reduced from 10
        paddingVertical: 2, // Reduced from 3
        borderRadius: 10,
        marginLeft: 10, // Reduced from 12
        gap: 2,
    },
    premiumVipText: {
        color: 'white',
        fontSize: 10, // Reduced from 12
        fontWeight: '900',
        letterSpacing: 0.3,
    },
    ageBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6, // Reduced from 10
        paddingVertical: 2, // Reduced from 4
        borderRadius: 12,
        marginLeft: 8 // Reduced from 12
    },
    ageBadgeText: {
        color: 'white',
        fontSize: 10, // Reduced from 13
        fontWeight: '900',
        marginLeft: 2
    },
    onlineBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        paddingHorizontal: 5, // Reduced from 12
        paddingVertical: 4, // Reduced from 6
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.2)',
    },
    onlineDot: {
        width: 6, // Reduced from 8
        height: 6, // Reduced from 8
        borderRadius: 3,
        backgroundColor: '#10b981',
        marginRight: 4,
    },
    onlineText: {
        color: '#10b981',
        fontSize: 11, // Reduced from 12
        fontWeight: '800',
    },
    section: {
        marginBottom: 30,
    },
    sectionTitle: {
        fontSize: 18, // Reduced from 20
        fontWeight: '900',
        color: 'white',
        marginBottom: 12,
        letterSpacing: 0.5,
    },
    bioText: {
        fontSize: 14, // Reduced from 16
        lineHeight: 22, // Reduced from 26
        color: '#cbd5e1',
        opacity: 0.9,
    },
    albumScroll: {
        marginHorizontal: -20,
        paddingHorizontal: 20,
    },
    albumPhoto: {
        width: 130, // Reduced from 160
        height: 180, // Reduced from 220
        borderRadius: 20,
        marginRight: 12,
        backgroundColor: '#1e293b',
    },
    bottomContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        overflow: 'hidden',
    },
    bottomBlur: {
        padding: 20,
        paddingBottom: 40,
    },
    messageButton: {
        width: '100%',
        height: 60,
        borderRadius: 20,
        overflow: 'hidden',
        elevation: 10,
        shadowColor: '#8b5cf6',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
    },
    gradientButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    buttonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 1.5,
    },
    infoTagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 10,
    },
    infoTag: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        borderWidth: 1,
        gap: 6,
    },
    infoTagText: {
        fontSize: 13,
        fontWeight: '700',
    },
    interestsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    interestTag: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    interestText: {
        color: '#e2e8f0',
        fontSize: 12,
        fontWeight: '500',
    },
});
