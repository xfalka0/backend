import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, SafeAreaView, Linking, Clipboard } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { Motion } from '../components/motion/MotionSystem';
import GlassCard from '../components/ui/GlassCard';
import PremiumBackground from '../components/animated/PremiumBackground';

const { width } = Dimensions.get('window');

const PurchaseInfoScreen = ({ navigation, route }) => {
    const { theme, themeMode } = useTheme();

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {themeMode === 'dark' && <PremiumBackground />}
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <TouchableOpacity style={[styles.backButton, { backgroundColor: theme.colors.glass }]} onPress={() => navigation.goBack()}>
                        <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Satın Alım Bilgisi</Text>
                    <View style={{ width: 44 }} />
                </View>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                    <Motion.Scale delay={100}>
                        <View style={styles.heroSection}>
                            <LinearGradient colors={['#FBBF24', '#D97706']} style={styles.mainIconContainer}>
                                <Ionicons name="cart" size={48} color="white" />
                            </LinearGradient>
                            <Text style={[styles.title, { color: theme.colors.text }]}>Lüks Deneyime Başlayın</Text>
                            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>Hesabınıza coin yüklemek veya premium özellikleri aktif etmek için hazırladığımız seçenekleri inceleyin.</Text>
                        </View>
                    </Motion.Scale>
                    <Motion.SlideUp delay={200}>
                        <GlassCard style={styles.infoCard} intensity={30}>
                            <View style={styles.cardHeader}>
                                <Ionicons name="chatbubble-ellipses" size={24} color="#FBBF24" />
                                <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Canlı Destek</Text>
                            </View>
                            <Text style={[styles.cardText, { color: theme.colors.textSecondary }]}>En hızlı yöntem olan Whatsapp canlı destek hattımız üzerinden anında coin yüklemesi yapabilir ve sorularınıza cevap bulabilirsiniz.</Text>
                            <TouchableOpacity
                                style={[styles.actionButton, { backgroundColor: '#FBBF24' }]}
                                onPress={() => Linking.openURL('https://wa.me/905414738700')}
                            >
                                <Text style={styles.actionButtonText}>Whatsapp ile iletişime geç</Text>
                            </TouchableOpacity>
                        </GlassCard>
                    </Motion.SlideUp>

                    <Motion.SlideUp delay={250}>
                        <GlassCard style={[styles.infoCard, { borderColor: theme.colors.primary }]} intensity={40}>
                            <View style={styles.cardHeader}>
                                <Ionicons name="diamond" size={24} color={theme.colors.primary} />
                                <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Resmi Coin Bayisi</Text>
                            </View>
                            <Text style={[styles.cardText, { color: theme.colors.textSecondary }]}>
                                Avantajlı ve indirimli paketler için resmi coin bayimiz ile iletişime geçerek anında yükleme yapabilirsiniz.
                            </Text>

                            <TouchableOpacity
                                style={[styles.copyIdBtn, { backgroundColor: theme.colors.glass }]}
                                onPress={() => {
                                    const userId = route.params?.user?.id || 'ID Bulunamadı';
                                    Clipboard.setString(String(userId));
                                    alert('Kullanıcı ID\'niz kopyalandı! Bayiye bu numarayı göndermeyi unutmayın.');
                                }}
                            >
                                <Text style={[styles.copyIdText, { color: theme.colors.text }]}>
                                    ID: {route.params?.user?.id ? String(route.params.user.id).substring(0, 8) + '...' : 'Belirlenmedi'} (Kopyala)
                                </Text>
                                <Ionicons name="copy-outline" size={16} color={theme.colors.text} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.actionButton, { backgroundColor: theme.colors.primary, marginTop: 15 }]}
                                onPress={() => Linking.openURL('https://wa.me/905414738700')}
                            >
                                <Text style={[styles.actionButtonText, { color: 'white' }]}>Bayi ile İletişime Geç</Text>
                            </TouchableOpacity>
                        </GlassCard>
                    </Motion.SlideUp>
                    <Motion.SlideUp delay={300}>
                        <GlassCard style={styles.infoCard} intensity={30}>
                            <View style={styles.cardHeader}>
                                <Ionicons name="mail" size={24} color="#FBBF24" />
                                <Text style={[styles.cardTitle, { color: theme.colors.text }]}>E-posta İletişim</Text>
                            </View>
                            <Text style={[styles.cardText, { color: theme.colors.textSecondary }]}>Kurumsal talepleriniz veya ödeme sorunlarınız için e-posta yoluyla bize 7/24 ulaşabilirsiniz.</Text>
                            <View style={[styles.emailBadge, { backgroundColor: theme.colors.glass }]}>
                                <Text style={[styles.emailText, { color: theme.colors.text }]}>falkasoft@gmail.com</Text>
                            </View>
                        </GlassCard>
                    </Motion.SlideUp>
                    <Motion.SlideUp delay={400}>
                        <View style={styles.noteBox}>
                            <Ionicons name="information-circle-outline" size={20} color={theme.colors.primary} />
                            <Text style={[styles.noteText, { color: theme.colors.textSecondary }]}>Güvenliğiniz için ödemelerinizi sadece resmi kanallarımız üzerinden gerçekleştirin.</Text>
                        </View>
                    </Motion.SlideUp>
                </ScrollView>
            </SafeAreaView>
        </View >
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    safeArea: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15 },
    backButton: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' },
    headerTitle: { fontSize: 18, fontWeight: '800' },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
    heroSection: { alignItems: 'center', marginTop: 30, marginBottom: 40 },
    mainIconContainer: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 25, elevation: 10, shadowColor: '#FBBF24', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15 },
    title: { fontSize: 26, fontWeight: '900', marginBottom: 10, textAlign: 'center' },
    subtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22, paddingHorizontal: 15, opacity: 0.8 },
    infoCard: { padding: 24, borderRadius: 32, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(251, 191, 36, 0.2)' },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    cardTitle: { fontSize: 19, fontWeight: '800', marginLeft: 12 },
    cardText: { fontSize: 15, lineHeight: 22, marginBottom: 20, opacity: 0.9 },
    actionButton: { height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#FBBF24', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
    actionButtonText: { color: '#000', fontSize: 16, fontWeight: '800' },
    emailBadge: { padding: 15, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' },
    emailText: { fontSize: 15, fontWeight: '700' },
    copyIdBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)'
    },
    copyIdText: { fontSize: 12, fontWeight: '600', opacity: 0.8 },
    noteBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20, paddingHorizontal: 20 },
    noteText: { fontSize: 13, marginLeft: 10, textAlign: 'center', fontStyle: 'italic' }
});

export default PurchaseInfoScreen;
