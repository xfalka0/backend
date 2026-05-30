import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Share, Alert, Clipboard, Modal, SafeAreaView, Platform, Image, ImageBackground } from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

const { width, height } = Dimensions.get('window');

export default function InviteScreen({ navigation, route }) {
    const [user, setUser] = useState(route?.params?.user || null);
    const [inviteCode, setInviteCode] = useState(`8Gg9E6Nl`); 
    const [activeTab, setActiveTab] = useState('ilerleme');
    const [shareModalVisible, setShareModalVisible] = useState(false);

    useEffect(() => {
        const loadUser = async () => {
            if (!user) {
                const userData = await AsyncStorage.getItem('user');
                if (userData) {
                    const parsed = JSON.parse(userData);
                    setUser(parsed);
                    setInviteCode(parsed?.invite_code || `8Gg9E6Nl`);
                }
            } else {
                setInviteCode(user?.invite_code || `8Gg9E6Nl`);
            }
        };
        loadUser();
    }, [user]);

    const copyToClipboard = () => {
        Clipboard.setString(inviteCode);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Kopyalandı", "Davet kodun başarıyla kopyalandı!");
    };

    const handleShare = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            await Share.share({
                message: `Fiva'ya gel! Kayıt olurken benim kodumu kullan: ${inviteCode} \n\nUygulamayı hemen indir!`,
            });
        } catch (error) {
            console.error(error);
        }
    };

    // Render a 3D-looking pseudo-icon since we don't have exact image assets
    const render3DIcon = (type) => {
        if (type === 'coins') {
            return (
                <View style={styles.icon3DContainer}>
                    <LinearGradient colors={['#FCD34D', '#F59E0B', '#B45309']} style={styles.coinLayer3} />
                    <LinearGradient colors={['#FDE68A', '#F59E0B', '#D97706']} style={styles.coinLayer2} />
                    <LinearGradient colors={['#FEF3C7', '#FBBF24', '#F59E0B']} style={styles.coinLayer1}>
                        <FontAwesome5 name="yen-sign" size={16} color="#B45309" />
                    </LinearGradient>
                </View>
            );
        }
        if (type === 'cash') {
            return (
                <View style={styles.icon3DContainer}>
                    <LinearGradient colors={['#6EE7B7', '#10B981', '#047857']} style={[styles.coinLayer3, { borderRadius: 10, transform: [{ rotate: '-15deg' }] }]} />
                    <LinearGradient colors={['#A7F3D0', '#34D399', '#059669']} style={[styles.coinLayer2, { borderRadius: 10, transform: [{ rotate: '-5deg' }] }]} />
                    <LinearGradient colors={['#D1FAE5', '#6EE7B7', '#10B981']} style={[styles.coinLayer1, { borderRadius: 10 }]}>
                        <FontAwesome5 name="money-bill-wave" size={14} color="#064E3B" />
                    </LinearGradient>
                </View>
            );
        }
        if (type === 'chart') {
            return (
                <View style={styles.icon3DContainer}>
                    <LinearGradient colors={['#93C5FD', '#3B82F6', '#1D4ED8']} style={[styles.coinLayer3, { borderRadius: 15 }]} />
                    <LinearGradient colors={['#BFDBFE', '#60A5FA', '#2563EB']} style={[styles.coinLayer2, { borderRadius: 15 }]} />
                    <LinearGradient colors={['#DBEAFE', '#93C5FD', '#3B82F6']} style={[styles.coinLayer1, { borderRadius: 15 }]}>
                        <FontAwesome5 name="chart-line" size={16} color="#1E3A8A" />
                    </LinearGradient>
                </View>
            );
        }
    };

    const renderRewardItem = (type, title, desc) => (
        <View style={styles.rewardCol}>
            <View style={styles.rewardIconWrapper}>
                <LinearGradient colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.02)']} style={styles.rewardIconGlow}>
                    {render3DIcon(type)}
                </LinearGradient>
            </View>
            <Text style={styles.rewardTitle}>{title}</Text>
            <Text style={styles.rewardDesc}>{desc}</Text>
        </View>
    );

    return (
        <View style={styles.container}>
            {/* Rich Background with Gradient and subtle image texture */}
            <ImageBackground 
                source={require('../../assets/fiva_profile_banner.png')} // Fallback texture
                style={StyleSheet.absoluteFill}
                imageStyle={{ opacity: 0.15 }}
            >
                <LinearGradient
                    colors={['#2E1B5B', '#150E28', '#0D081A']}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                />
            </ImageBackground>

            <SafeAreaView style={{ flex: 1 }}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={28} color="#fff" />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }} />
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    
                    {/* Top Reward Card */}
                    <LinearGradient colors={['#2A1B54', '#1E143E']} style={styles.topCard}>
                        <View style={styles.topCardHeader}>
                            <Text style={styles.inviteCodeText}>Davetiye kodum: <Text style={{ color: '#fff' }}>{inviteCode}</Text></Text>
                        </View>

                        <View style={styles.rewardsGrid}>
                            {renderRewardItem('coins', '500 Coins', 'Her davet ettiğiniz kullanıcı için 500 Coins kazanın.')}
                            {renderRewardItem('cash', '500 Coins', 'Arkadaşınız ilk yüklemesini yaptıktan sonra ek olarak 500 Coins kazanın.')}
                            {renderRewardItem('chart', 'Sınırsız Ödül', "İstediğiniz kadar arkadaş davet ederek sınırsız kazanabilirsiniz.")}
                        </View>
                    </LinearGradient>

                    {/* Bottom Progress Card */}
                    <View style={styles.bottomCardWrapper}>
                        <LinearGradient colors={['#231647', '#1A1035']} style={styles.bottomCard}>
                            {/* Tabs */}
                            <View style={styles.tabsContainer}>
                                <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('ilerleme')} activeOpacity={0.8}>
                                    <Text style={[styles.tabText, activeTab === 'ilerleme' && styles.tabTextActive]}>Davet ve ödül ilerlemesi</Text>
                                    {activeTab === 'ilerleme' && <View style={styles.tabIndicator} />}
                                </TouchableOpacity>
                                
                                <View style={styles.tabDivider} />
                                
                                <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('siralama')} activeOpacity={0.8}>
                                    <Text style={[styles.tabText, activeTab === 'siralama' && styles.tabTextActive]}>Sıralama listesi</Text>
                                    {activeTab === 'siralama' && <View style={styles.tabIndicator} />}
                                </TouchableOpacity>
                            </View>

                            {/* Content */}
                            <View style={styles.tabContent}>
                                <Text style={styles.infoTitle}>Ödüller jeton olarak doğrudan hesaba</Text>
                                
                                <View style={styles.emptyStateBox}>
                                    <Ionicons name="people" size={54} color="#4B3A7B" style={{ marginBottom: 12 }} />
                                    <Text style={styles.emptyStateText}>
                                        Henüz ilerleme yok.
                                        <Text style={styles.linkText}> Hemen</Text>
                                    </Text>
                                    <Text style={styles.emptyStateText}>
                                        <Text style={styles.linkText}>Arkadaşını Davet Et</Text>
                                    </Text>
                                </View>

                                <TouchableOpacity activeOpacity={0.8} style={styles.detailsButtonWrapper}>
                                    <LinearGradient colors={['#4C1D95', '#3B0764']} style={styles.detailsButtonGradient}>
                                        <Text style={[styles.detailsButtonText, { color: '#D8B4FE' }]}>Jeton detayları</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </LinearGradient>
                    </View>
                    
                    <View style={{ height: 120 }} />
                </ScrollView>

                {/* Fixed Bottom CTA Button (Stunning Vibrant Gradient) */}
                <View style={styles.stickyBottom}>
                    <TouchableOpacity 
                        activeOpacity={0.85}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setShareModalVisible(true);
                        }}
                    >
                        <LinearGradient
                            colors={['#D946EF', '#8B5CF6']}
                            style={styles.ctaGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <Text style={[styles.ctaText, { color: '#fff' }]}>Şimdi davet et</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                {/* Share Bottom Sheet Modal */}
                <Modal visible={shareModalVisible} transparent={true} animationType="slide" onRequestClose={() => setShareModalVisible(false)}>
                    <View style={styles.modalOverlay}>
                        <TouchableOpacity style={{ flex: 1 }} onPress={() => setShareModalVisible(false)} />
                        
                        <View style={styles.modalContent}>
                            {/* Red Gift Banner */}
                            <LinearGradient colors={['#FF5F6D', '#FFC371']} style={styles.modalBanner} start={{x:0, y:0}} end={{x:1, y:1}}>
                                <Text style={styles.modalBannerTitle}>Fiva'ya Katıl</Text>
                                <Text style={styles.modalBannerTitle}>Ödülü Al</Text>
                                <Text style={styles.modalBannerTitle}>Arkadaş Edin</Text>
                                <Ionicons name="gift" size={110} color="rgba(255,255,255,0.25)" style={styles.modalBannerIcon} />
                            </LinearGradient>

                            {/* QR & Info Area */}
                            <View style={styles.qrArea}>
                                <View style={styles.dummyQR}>
                                    <Ionicons name="qr-code-outline" size={60} color="#000" />
                                </View>
                                <View style={styles.qrInfo}>
                                    <Text style={styles.qrCodeText}>Davet Kodu: {inviteCode}</Text>
                                    <Text style={styles.qrUserText}>Davetçi: {user?.name || 'Fiva Kullanıcısı'}</Text>
                                </View>
                            </View>

                            {/* Copy Row */}
                            <View style={styles.copyRow}>
                                <View style={styles.copyInputBox}>
                                    <Ionicons name="link-outline" size={16} color="#9CA3AF" style={{ marginRight: 5 }} />
                                    <Text style={styles.copyInputText} numberOfLines={1}>
                                        Arkadaşınız sizi Fiva'yı indirmeye davet ediyor...
                                    </Text>
                                </View>
                                <TouchableOpacity style={styles.copyButtonSolid} onPress={copyToClipboard}>
                                    <Text style={styles.copyButtonSolidText}>Kopyala</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Social Icons Grid */}
                            <View style={styles.socialGrid}>
                                <TouchableOpacity style={styles.socialItem} onPress={handleShare}>
                                    <View style={[styles.socialIconCircle, { backgroundColor: '#F3F4F6' }]}><Ionicons name="download-outline" size={24} color="#374151" /></View>
                                    <Text style={styles.socialLabel}>İndir</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.socialItem} onPress={handleShare}>
                                    <View style={[styles.socialIconCircle, { backgroundColor: '#FEE2E2' }]}><FontAwesome5 name="facebook-messenger" size={24} color="#3B82F6" /></View>
                                    <Text style={styles.socialLabel}>Messenger</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.socialItem} onPress={handleShare}>
                                    <View style={[styles.socialIconCircle, { backgroundColor: '#DCFCE7' }]}><FontAwesome5 name="whatsapp" size={24} color="#25D366" /></View>
                                    <Text style={styles.socialLabel}>WhatsApp</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.socialItem} onPress={handleShare}>
                                    <View style={[styles.socialIconCircle, { backgroundColor: '#DBEAFE' }]}><FontAwesome5 name="facebook" size={24} color="#1877F2" /></View>
                                    <Text style={styles.socialLabel}>Facebook</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.socialItem} onPress={handleShare}>
                                    <View style={[styles.socialIconCircle, { backgroundColor: '#000' }]}><FontAwesome5 name="times" size={24} color="#fff" /></View>
                                    <Text style={styles.socialLabel}>X</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.socialItem} onPress={handleShare}>
                                    <View style={[styles.socialIconCircle, { backgroundColor: '#F3F4F6' }]}><Ionicons name="ellipsis-horizontal" size={24} color="#374151" /></View>
                                    <Text style={styles.socialLabel}>Daha Fazla</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0D081A' },
    
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingTop: Platform.OS === 'android' ? 10 : 0,
        paddingBottom: 15,
        zIndex: 10,
    },
    backButton: { padding: 5 },
    rulesButton: {
        borderTopLeftRadius: 20,
        borderBottomLeftRadius: 20,
        overflow: 'hidden',
        marginRight: -15, // to attach it to the right edge
    },
    rulesGradient: {
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    rulesButtonText: { color: '#78350F', fontWeight: '900', fontSize: 13 },
    
    scrollContent: { padding: 15, paddingBottom: 40 },

    // Top Card
    topCard: {
        borderRadius: 24,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(167, 139, 250, 0.2)', // Light purple glow border
        shadowColor: '#A78BFA',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 8,
    },
    topCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#160E2A',
        padding: 12,
        paddingHorizontal: 16,
        borderRadius: 16,
        marginBottom: 30,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.03)',
    },
    inviteCodeText: { color: '#9CA3AF', fontSize: 13, fontWeight: '600' },
    supportButton: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
    },
    supportButtonText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
    
    rewardsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    rewardCol: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 5,
    },
    rewardIconWrapper: {
        width: 70,
        height: 70,
        borderRadius: 35,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 15,
    },
    rewardIconGlow: {
        width: '100%',
        height: '100%',
        borderRadius: 35,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)'
    },
    
    // Custom 3D Icons
    icon3DContainer: { width: 44, height: 44, position: 'relative' },
    coinLayer3: { position: 'absolute', top: 6, left: 0, width: 44, height: 44, borderRadius: 22, opacity: 0.6 },
    coinLayer2: { position: 'absolute', top: 3, left: 0, width: 44, height: 44, borderRadius: 22, opacity: 0.8 },
    coinLayer1: { position: 'absolute', top: 0, left: 0, width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 4, elevation: 5 },

    rewardTitle: { color: '#fff', fontSize: 14, fontWeight: '900', marginBottom: 8, textAlign: 'center' },
    rewardDesc: { color: '#9CA3AF', fontSize: 11, textAlign: 'center', lineHeight: 16 },

    // Bottom Card
    bottomCardWrapper: {
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(167, 139, 250, 0.15)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 8,
    },
    bottomCard: {
        borderRadius: 24,
        paddingTop: 15,
        overflow: 'hidden',
    },
    tabsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 10,
    },
    tabItem: { flex: 1, alignItems: 'center', paddingVertical: 14 },
    tabText: { color: '#6B7280', fontSize: 14, fontWeight: '700' },
    tabTextActive: { color: '#fff', fontWeight: '900' },
    tabDivider: { width: 1, height: 15, backgroundColor: 'rgba(255,255,255,0.1)' },
    tabIndicator: {
        width: 40,
        height: 3,
        backgroundColor: '#fff',
        position: 'absolute',
        bottom: 0,
        borderRadius: 3,
    },
    tabContent: {
        padding: 24,
    },
    infoTitle: { color: '#E5E7EB', fontSize: 15, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
    emptyStateBox: {
        backgroundColor: '#2E1B5B', // Much softer, richer purple than before
        borderRadius: 20,
        padding: 30,
        alignItems: 'center',
        marginBottom: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.03)',
    },
    emptyStateText: { color: '#9CA3AF', fontSize: 14, textAlign: 'center', lineHeight: 22 },
    linkText: { color: '#D8B4FE', textDecorationLine: 'underline', fontWeight: 'bold' },
    
    detailsButtonWrapper: { width: '100%', alignItems: 'center' },
    detailsButtonGradient: {
        width: '90%',
        paddingVertical: 16,
        borderRadius: 30,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.4)', // The white glow stroke
    },
    detailsButtonText: { color: '#312E81', fontSize: 16, fontWeight: '900' },

    // Sticky Bottom
    stickyBottom: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 40 : 25,
        left: 20,
        right: 20,
    },
    ctaGradient: {
        paddingVertical: 20,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.8)',
        shadowColor: '#D8B4FE',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.6,
        shadowRadius: 15,
        elevation: 10,
    },
    ctaText: { color: '#2E1065', fontSize: 19, fontWeight: '900', letterSpacing: 0.5 },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        padding: 20,
        paddingBottom: 40,
    },
    modalBanner: {
        borderRadius: 20,
        padding: 25,
        height: 200,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
        marginBottom: -30, // Overlay the white box
        zIndex: 1,
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.4,
        shadowRadius: 15,
        elevation: 8,
    },
    modalBannerTitle: { color: '#fff', fontSize: 26, fontWeight: '900', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.2)', textShadowOffset: {width: 0, height: 2}, textShadowRadius: 4 },
    modalBannerIcon: { position: 'absolute', right: -20, bottom: -20, transform: [{ rotate: '-15deg' }] },
    qrArea: {
        backgroundColor: '#fff',
        marginHorizontal: 15,
        padding: 20,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 6,
        zIndex: 2,
    },
    dummyQR: {
        width: 80,
        height: 80,
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    qrInfo: { flex: 1, justifyContent: 'center' },
    qrCodeText: { color: '#111827', fontSize: 18, fontWeight: '900', marginBottom: 4 },
    qrUserText: { color: '#6B7280', fontSize: 14, fontWeight: '500' },
    
    copyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 35,
        marginBottom: 30,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 30,
        padding: 6,
        paddingLeft: 20,
    },
    copyInputBox: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    copyInputText: { color: '#6B7280', fontSize: 14, flex: 1, fontWeight: '500' },
    copyButtonSolid: {
        backgroundColor: '#111827',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 24,
    },
    copyButtonSolidText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

    socialGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
    },
    socialItem: {
        width: '30%',
        alignItems: 'center',
        marginBottom: 25,
    },
    socialIconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    socialLabel: { color: '#4B5563', fontSize: 13, fontWeight: '600' }
});
