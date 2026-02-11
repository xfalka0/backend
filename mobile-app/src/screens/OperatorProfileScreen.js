import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
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
import { Motion } from '../components/motion/MotionSystem';
import VipFrame from '../components/ui/VipFrame';

const { width } = Dimensions.get('window');
const HEADER_HEIGHT = width * 1.2;

export default function OperatorProfileScreen({ route, navigation }) {
    const { operator, user } = route.params;

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
                    // Sayfayı aşağı çektiğimizde (bounce) resmin büyümesini sağlıyoruz.
                    scale: interpolate(
                        scrollY.value,
                        [-200, 0],
                        [1.5, 1],
                        Extrapolate.CLAMP
                    ),
                },
                {
                    // Sayfayı yukarı kaydırdığımızda resmin aşağı inmesini engelliyoruz (Sabitliyoruz).
                    translateY: 0
                }
            ],
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
            <Animated.View style={[styles.imageContainer, animatedImageStyle]}>
                <Image
                    source={{ uri: operator.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(operator.name)}&background=random&color=fff` }}
                    style={styles.mainImage}
                />
                <LinearGradient
                    colors={['transparent', 'rgba(15, 23, 42, 0.4)', '#0f172a']}
                    style={styles.gradientOverlay}
                />

                {/* Scroll ile aktive olan Blur efekti */}
                <Animated.View style={[StyleSheet.absoluteFill, animatedBlurStyle]}>
                    <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
                </Animated.View>
            </Animated.View>

            {/* Geri Dön Butonu */}
            <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}
            >
                <BlurView intensity={40} tint="dark" style={styles.backButtonBlur}>
                    <Ionicons name="arrow-back" size={24} color="white" />
                </BlurView>
            </TouchableOpacity>

            <Animated.ScrollView
                onScroll={scrollHandler}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* Header için boşluk bırakıyoruz çünkü resim statik olarak arkada duruyor */}
                <View style={{ height: HEADER_HEIGHT - 60 }} />

                {/* İçerik Alanı: Glassmorphism kullanarak arka planı hafif gösteriyoruz */}
                <Motion.Fade delay={200}>
                    <GlassCard style={styles.contentCard}>
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
                                    <Text style={styles.name}>{operator.name}</Text>
                                    {operator.vip_level > 0 && (
                                        <LinearGradient
                                            colors={
                                                operator.vip_level === 1 ? ['#94a3b8', '#64748b'] :
                                                    operator.vip_level === 2 ? ['#3b82f6', '#8b5cf6'] :
                                                        operator.vip_level === 3 ? ['#a855f7', '#ec4899'] :
                                                            operator.vip_level === 4 ? ['#fbbf24', '#7c3aed'] :
                                                                operator.vip_level === 5 ? ['#fbbf24', '#ff00ff'] :
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

                        {/* Hakkımda Bölümü */}
                        <Motion.Fade delay={400}>
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Hakkımda</Text>
                                <Text style={styles.bioText}>{operator.bio || 'Merhaba! Seninle tanışmak için sabırsızlanıyorum.'}</Text>
                            </View>
                        </Motion.Fade>

                        {/* Albüm */}
                        {operator.photos && operator.photos.length > 0 && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Fotoğraf Albümü</Text>
                                <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.albumScroll}>
                                    {operator.photos.map((photo, index) => (
                                        <Motion.SlideUp delay={600 + (index * 100)} key={index}>
                                            <Image source={{ uri: photo }} style={styles.albumPhoto} />
                                        </Motion.SlideUp>
                                    ))}
                                </Animated.ScrollView>
                            </View>
                        )}

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
    backButton: {
        position: 'absolute',
        top: 50,
        left: 20,
        zIndex: 10,
        overflow: 'hidden',
        borderRadius: 20,
    },
    backButtonBlur: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
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
        fontSize: 32,
        fontWeight: '900',
        color: 'white',
        letterSpacing: -0.5,
    },
    category: {
        fontSize: 16,
        color: '#94a3b8',
        fontWeight: '600',
        marginTop: 4,
    },
    premiumVipBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 12, // Soft edges
        marginLeft: 12,
        gap: 5,
    },
    premiumVipText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    ageBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 15, marginLeft: 12 },
    ageBadgeText: { color: 'white', fontSize: 13, fontWeight: '900', marginLeft: 6 },
    onlineBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.2)',
    },
    onlineDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#10b981',
        marginRight: 6,
    },
    onlineText: {
        color: '#10b981',
        fontSize: 12,
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
});
