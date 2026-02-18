import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

export default function LegalScreen({ route, navigation }) {
    const { type } = route.params || { type: 'privacy' };
    const { theme } = useTheme();

    const isPrivacy = type === 'privacy';

    const sections = isPrivacy ? [
        {
            id: 1,
            title: 'Veri Toplama',
            icon: 'eye-outline',
            content: 'Size daha iyi bir deneyim sunmak için bazı verileri topluyoruz. Bu veriler profilinizi özelleştirmek ve güvenliğinizi sağlamak için kullanılır.'
        },
        {
            id: 2,
            title: 'Veri Paylaşımı',
            icon: 'share-social-outline',
            content: 'Verileriniz asla üçüncü taraflarla reklam amacıyla paylaşılmaz. Güvenliğiniz bizim için her şeyden önemlidir.'
        },
        {
            id: 3,
            title: 'Kullanıcı Hakları',
            icon: 'shield-checkmark-outline',
            content: 'İstediğiniz zaman verilerinizin silinmesini talep edebilir veya hesabınızı kapatabilirsiniz.'
        },
        {
            id: 4,
            title: 'Çerez Kullanımı',
            icon: 'settings-outline',
            content: 'Uygulama performansını artırmak ve oturumunuzu açık tutmak için teknik çerezler kullanıyoruz.'
        }
    ] : [
        {
            id: 1,
            title: 'Genel Kurallar',
            icon: 'document-text-outline',
            content: 'Uygulamamızı kullanarak topluluk kurallarına ve genel kullanım koşullarına uyacağınızı kabul etmiş olursunuz.'
        },
        {
            id: 2,
            title: 'Hesap Güvenliği',
            icon: 'lock-closed-outline',
            content: 'Hesap bilgilerinizin güvenliğinden siz sorumlusunuz. Şüpheli bir durum fark ederseniz lütfen bize bildirin.'
        },
        {
            id: 3,
            title: 'Telif Hakları',
            icon: 'copy-outline',
            content: 'Uygulama içerisindeki tasarımlar ve içerikler Fiva ekibine aittir, izinsiz kopyalanamaz.'
        },
        {
            id: 4,
            title: 'İptal ve İade',
            icon: 'card-outline',
            content: 'Dijital aboneliklerle ilgili iptal ve iade süreçleri uygulama mağazası (Google Play) politikalarına göredir.'
        }
    ];

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <LinearGradient
                colors={[theme.colors.primary + '20', 'transparent']}
                style={StyleSheet.absoluteFill}
            />

            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={styles.backButton}
                    >
                        <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
                    </TouchableOpacity>
                    <Animated.Text entering={FadeIn.delay(200)} style={[styles.headerTitle, { color: theme.colors.text }]}>
                        {isPrivacy ? 'Gizlilik' : 'Şartlar'}
                    </Animated.Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    <Animated.View entering={FadeInDown.delay(300).springify()}>
                        <Text style={[styles.mainTitle, { color: theme.colors.text }]}>
                            {isPrivacy ? 'Gizlilik Politikası' : 'Kullanım Şartları'}
                        </Text>
                        <Text style={[styles.lastUpdated, { color: theme.colors.text }]}>
                            Son Güncelleme: 17 Şubat 2026
                        </Text>
                    </Animated.View>

                    {sections.map((section, index) => (
                        <Animated.View
                            key={section.id}
                            entering={FadeInDown.delay(400 + (index * 100)).springify()}
                            style={[styles.card, { backgroundColor: theme.colors.card || 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }]}
                        >
                            <View style={styles.cardHeader}>
                                <View style={[styles.iconContainer, { backgroundColor: theme.colors.primary + '30' }]}>
                                    <Ionicons name={section.icon} size={20} color={theme.colors.primary} />
                                </View>
                                <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                                    {section.title}
                                </Text>
                            </View>
                            <Text style={[styles.cardContent, { color: theme.colors.text }]}>
                                {section.content}
                            </Text>
                        </Animated.View>
                    ))}

                    <Animated.View entering={FadeIn.delay(1000)} style={styles.footer}>
                        <Text style={[styles.footerText, { color: theme.colors.text }]}>
                            Destek için: falkasoft@gmail.com
                        </Text>
                    </Animated.View>
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        height: 60,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        fontFamily: 'Outfit_800ExtraBold',
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingBottom: 40,
        paddingTop: 10,
    },
    mainTitle: {
        fontSize: 32,
        fontWeight: '800',
        fontFamily: 'Outfit_800ExtraBold',
        marginBottom: 8,
    },
    lastUpdated: {
        fontSize: 14,
        opacity: 0.5,
        marginBottom: 30,
    },
    card: {
        padding: 20,
        borderRadius: 24,
        borderWidth: 1,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    cardContent: {
        fontSize: 15,
        lineHeight: 22,
        opacity: 0.7,
    },
    footer: {
        marginTop: 20,
        alignItems: 'center',
        paddingBottom: 20,
    },
    footerText: {
        fontSize: 14,
        opacity: 0.4,
    },
});