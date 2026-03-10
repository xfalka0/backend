import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, SafeAreaView, Linking, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../contexts/ThemeContext';
import { Motion } from '../components/motion/MotionSystem';
import GlassCard from '../components/ui/GlassCard';
import PremiumBackground from '../components/animated/PremiumBackground';

const { width } = Dimensions.get('window');

const CoinDealerScreen = ({ navigation, route }) => {
    const { theme, themeMode } = useTheme();
    const user = route.params?.user;
    const userId = user?.id || 'ID Bulunamadı';

    const handleCopyId = async () => {
        await Clipboard.setStringAsync(String(userId));
        alert('Kullanıcı ID\'niz kopyalandı! Bayiye bu numarayı göndermeyi unutmayın.');
    };

    const handleWhatsApp = () => {
        Linking.openURL('https://wa.me/905414738700');
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {themeMode === 'dark' && <PremiumBackground />}
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <TouchableOpacity
                        style={[styles.backButton, { backgroundColor: theme.colors.glass }]}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Resmi Coin Bayisi</Text>
                    <View style={{ width: 44 }} />
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                    <Motion.Scale delay={100}>
                        <View style={styles.heroSection}>
                            <View style={styles.crownContainer}>
                                <LinearGradient colors={['#FBBF24', '#D97706']} style={styles.mainIconContainer}>
                                    <Ionicons name="diamond" size={54} color="white" />
                                </LinearGradient>
                                <View style={styles.badge}>
                                    <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                                    <Text style={styles.badgeText}>Onaylı Bayi</Text>
                                </View>
                            </View>
                            <Text style={[styles.title, { color: theme.colors.text }]}>Avantajlı Coin Alımı</Text>
                            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                                Store fiyatlarından çok daha uygun ve indirimli paketler için resmi bayimiz ile iletişime geçin.
                            </Text>
                        </View>
                    </Motion.Scale>

                    <Motion.SlideUp delay={200}>
                        <GlassCard style={styles.idCard} intensity={40}>
                            <View style={styles.idLabelContainer}>
                                <Ionicons name="person-circle" size={20} color={theme.colors.primary} />
                                <Text style={[styles.idLabel, { color: theme.colors.textSecondary }]}>Sizin ID Numaranız</Text>
                            </View>
                            <View style={styles.idValueRow}>
                                <Text style={[styles.idValue, { color: theme.colors.text }]}>{userId}</Text>
                                <TouchableOpacity onPress={handleCopyId} style={styles.copyBtn}>
                                    <Ionicons name="copy-outline" size={22} color={theme.colors.primary} />
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.warningText}>
                                * Yükleme yapılabilmesi için bu ID'yi bayiye iletmeniz gerekmektedir.
                            </Text>
                        </GlassCard>
                    </Motion.SlideUp>

                    <Motion.SlideUp delay={300}>
                        <View style={styles.featuresContainer}>
                            <View style={styles.featureItem}>
                                <View style={[styles.featureIcon, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                                    <Ionicons name="flash" size={24} color="#10B981" />
                                </View>
                                <View>
                                    <Text style={[styles.featureTitle, { color: theme.colors.text }]}>Hızlı Teslimat</Text>
                                    <Text style={[styles.featureDesc, { color: theme.colors.textSecondary }]}>Ödeme sonrası anında yükleme.</Text>
                                </View>
                            </View>
                            <View style={styles.featureItem}>
                                <View style={[styles.featureIcon, { backgroundColor: 'rgba(251, 191, 36, 0.1)' }]}>
                                    <Ionicons name="trending-down" size={24} color="#FBBF24" />
                                </View>
                                <View>
                                    <Text style={[styles.featureTitle, { color: theme.colors.text }]}>Özel İndirimler</Text>
                                    <Text style={[styles.featureDesc, { color: theme.colors.textSecondary }]}>Toplu alımlarda ek bonuslar.</Text>
                                </View>
                            </View>
                            <View style={styles.featureItem}>
                                <View style={[styles.featureIcon, { backgroundColor: 'rgba(236, 72, 153, 0.1)' }]}>
                                    <Ionicons name="shield-checkmark" size={24} color="#EC4899" />
                                </View>
                                <View>
                                    <Text style={[styles.featureTitle, { color: theme.colors.text }]}>Güvenli Ödeme</Text>
                                    <Text style={[styles.featureDesc, { color: theme.colors.textSecondary }]}>Resmi ve onaylı ödeme kanalları.</Text>
                                </View>
                            </View>
                        </View>
                    </Motion.SlideUp>

                    <Motion.SlideUp delay={400}>
                        <TouchableOpacity
                            style={styles.whatsAppButton}
                            onPress={handleWhatsApp}
                            activeOpacity={0.9}
                        >
                            <LinearGradient
                                colors={['#25D366', '#128C7E']}
                                style={styles.gradientButton}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            >
                                <Ionicons name="logo-whatsapp" size={28} color="white" />
                                <Text style={styles.buttonText}>WhatsApp ile İletişime Geç</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </Motion.SlideUp>

                    <Text style={styles.disclaimer}>
                        Bu işlem uygulama dışı gerçekleşmektedir. Ödeme ve ürün teslimatı ile ilgili tüm sorumluluk resmi bayi kanalımızdadır.
                    </Text>
                </ScrollView>
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    safeArea: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)'
    },
    headerTitle: { fontSize: 18, fontWeight: '800' },
    scrollContent: { paddingHorizontal: 24, paddingBottom: 40 },
    heroSection: { alignItems: 'center', marginTop: 20, marginBottom: 30 },
    crownContainer: { alignItems: 'center', marginBottom: 20 },
    mainIconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 15,
        shadowColor: '#FBBF24',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.4,
        shadowRadius: 20
    },
    badge: {
        position: 'absolute',
        bottom: -5,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0F172A',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)'
    },
    badgeText: { color: 'white', fontSize: 12, fontWeight: '700', marginLeft: 4 },
    title: { fontSize: 28, fontWeight: '900', marginBottom: 12, textAlign: 'center' },
    subtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22, opacity: 0.8 },
    idCard: { padding: 24, borderRadius: 24, marginBottom: 30 },
    idLabelContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    idLabel: { fontSize: 14, fontWeight: '600', marginLeft: 8 },
    idValueRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(0,0,0,0.2)',
        padding: 15,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)'
    },
    idValue: { fontSize: 18, fontWeight: '800', letterSpacing: 1 },
    copyBtn: { padding: 5 },
    warningText: { fontSize: 12, color: '#FBBF24', marginTop: 15, fontStyle: 'italic', fontWeight: '500' },
    featuresContainer: { marginBottom: 35 },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20
    },
    featureIcon: {
        width: 48,
        height: 48,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16
    },
    featureTitle: { fontSize: 16, fontWeight: '800', marginBottom: 2 },
    featureDesc: { fontSize: 13, opacity: 0.7 },
    whatsAppButton: {
        borderRadius: 20,
        overflow: 'hidden',
        elevation: 10,
        shadowColor: '#25D366',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
        marginBottom: 20
    },
    gradientButton: {
        flexDirection: 'row',
        height: 64,
        alignItems: 'center',
        justifyContent: 'center'
    },
    buttonText: { color: 'white', fontSize: 18, fontWeight: '900', marginLeft: 12 },
    disclaimer: {
        fontSize: 12,
        textAlign: 'center',
        opacity: 0.4,
        lineHeight: 18,
        paddingHorizontal: 20
    }
});

export default CoinDealerScreen;
