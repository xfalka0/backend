import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, SafeAreaView, Dimensions, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, Easing } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

const PRIVILEGES = [
    { id: 1, label: 'Kimlik', icon: 'star', minLevel: 1 },
    { id: 2, label: 'Avatar\nÇerçevesi', icon: 'scan-outline', minLevel: 1 },
    { id: 3, label: 'Madalya', icon: 'ribbon', minLevel: 2 },
    { id: 4, label: 'Ücretsiz\nÇeviri', icon: 'language', minLevel: 2 },
    { id: 5, label: 'Kısıtlamaları\nKaldırın', icon: 'eye', minLevel: 3 },
    { id: 6, label: 'Konuşma\nBalonu', icon: 'chatbubble-ellipses', minLevel: 4 },
    { id: 7, label: 'Öne Çık', icon: 'thumbs-up', minLevel: 5 },
    { id: 8, label: 'Ziyaretçileri\nGör', icon: 'lock-open', minLevel: 6 },
    { id: 9, label: 'Hediye\nBildirimi', icon: 'megaphone', minLevel: 6 },
];

const VIP_CONFIGS = {
    1: { bg: ['#92400e', '#451a03'], frame: ['#cd7f32', '#a05a2c'], glow: 'rgba(146, 64, 14, 0.4)' },
    2: { bg: ['#475569', '#1e293b'], frame: ['#cbd5e1', '#94a3b8'], glow: 'rgba(71, 85, 105, 0.4)' },
    3: { bg: ['#b45309', '#78350f'], frame: ['#fbbf24', '#d97706'], glow: 'rgba(180, 83, 9, 0.5)' },
    4: { bg: ['#0e7490', '#164e63'], frame: ['#22d3ee', '#0891b2'], glow: 'rgba(14, 116, 144, 0.6)' },
    5: { bg: ['#be185d', '#831843'], frame: ['#e879f9', '#d946ef'], glow: 'rgba(190, 24, 93, 0.7)' },
    6: { bg: ['#1a1a1a', '#000000'], frame: ['#fbbf24', '#fde68a'], glow: 'rgba(251, 191, 36, 0.9)' }
};

export default function VipDetailsScreen({ navigation, route }) {
    const { user } = route.params || {};
    const vipLevel = user?.vip_level || 0;
    const [selectedLevel, setSelectedLevel] = useState(vipLevel > 0 ? vipLevel : 1);

    const avatarUri = user?.profile_image || user?.avatar || 'https://via.placeholder.com/150';
    const config = VIP_CONFIGS[selectedLevel] || VIP_CONFIGS[1];
    const frameColors = config.frame;

    const floatingY = useSharedValue(0);

    React.useEffect(() => {
        floatingY.value = withRepeat(
            withSequence(
                withTiming(-8, { duration: 2500, easing: Easing.inOut(Easing.sin) }),
                withTiming(0, { duration: 2500, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            true
        );
    }, [selectedLevel]);

    const floatingStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: floatingY.value }]
    }));

    return (
        <SafeAreaView style={styles.container}>
            {/* Ambient Background Particles Removed */}
            <View style={[StyleSheet.absoluteFill, { zIndex: 0 }]} pointerEvents="none" />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
                    <Ionicons name="arrow-back" size={24} color="white" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>VIP AYRICALIKLARI</Text>
                <TouchableOpacity style={styles.iconBtn}>
                    <Ionicons name="help-circle-outline" size={24} color="white" />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
                {/* VIP CARD */}
                <Animated.View style={[{ paddingHorizontal: 20, marginTop: 20 }, floatingStyle]}>
                    <LinearGradient
                        colors={config.bg}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={[styles.card, { borderColor: config.frame[0], borderWidth: 1.5 }]}
                    >
                        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.05)' }]} />
                        <Text style={[styles.bgVipText, { color: config.frame[0], opacity: 0.15 }]}>VIP {selectedLevel}</Text>


                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={{ padding: 3, borderWidth: 1, borderColor: '#fff', borderRadius: 50, marginRight: 15 }}>
                                <LinearGradient colors={frameColors} style={{ padding: 3, borderRadius: 50 }}>
                                    <Image source={{ uri: avatarUri }} style={styles.avatar} />
                                </LinearGradient>
                                <View style={styles.badgeContainer}>
                                    <LinearGradient colors={frameColors} style={styles.badge}>
                                        <Text style={styles.badgeText}>VIP{selectedLevel}</Text>
                                    </LinearGradient>
                                </View>
                            </View>
                            <View>
                                <Text style={styles.username}>{user?.name || 'Kullanıcı'}</Text>
                                <Text style={styles.vipStatus}>
                                    {selectedLevel <= vipLevel ? 'Bu seviye aktif' : 'Kilidi açmak için coins yükleyin'}
                                </Text>
                            </View>
                        </View>
                    </LinearGradient>
                </Animated.View>

                {/* LEVEL TABS */}
                <View style={{ marginTop: 30 }}>
                    <View style={styles.separatorContainer}>
                        <View style={styles.line} />
                        <Text style={styles.separatorText}>Seviye {selectedLevel} Ayrıcalıkları</Text>
                        <View style={styles.line} />
                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, marginTop: 15 }}>
                        {[1, 2, 3, 4, 5, 6].map((lvl) => (
                            <TouchableOpacity key={lvl} onPress={() => setSelectedLevel(lvl)} style={{ marginRight: 25, paddingBottom: 5, borderBottomWidth: selectedLevel === lvl ? 2 : 0, borderColor: '#fbbf24' }}>
                                <Text style={{ color: selectedLevel === lvl ? '#fbbf24' : '#64748b', fontSize: 16, fontWeight: 'bold', marginBottom: 5 }}>VIP{lvl}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* PRIVILEGES GRID */}
                <View style={styles.grid}>
                    {PRIVILEGES.map((item) => {
                        const isUnlocked = item.minLevel <= selectedLevel;
                        return (
                            <View key={item.id} style={[
                                styles.gridItem,
                                isUnlocked
                                    ? { borderColor: '#fbbf24', borderWidth: 1, backgroundColor: 'rgba(251, 191, 36, 0.05)' }
                                    : { borderColor: 'transparent', backgroundColor: 'rgba(71, 85, 105, 0.2)' }
                            ]}>
                                <View style={styles.gridIcon}>
                                    <Ionicons
                                        name={item.icon}
                                        size={28}
                                        color={isUnlocked ? '#fbbf24' : '#64748b'}
                                        style={isUnlocked ? { textShadowColor: 'rgba(251, 191, 36, 0.5)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 } : {}}
                                    />
                                </View>
                                <Text style={[styles.gridText, { color: isUnlocked ? 'white' : '#64748b', fontWeight: isUnlocked ? '600' : '400' }]}>
                                    {item.label}
                                </Text>
                            </View>
                        );
                    })}
                </View>
            </ScrollView>

            {/* BOTTOM BUTTON */}
            <View style={styles.bottomBar}>
                <TouchableOpacity onPress={() => navigation.navigate('Shop')}>
                    <LinearGradient
                        colors={['#fbebb5', '#d4af37']}
                        style={styles.actionButton}
                    >
                        <Text style={styles.actionButtonText}>Hemen yükseltin</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a', paddingTop: Platform.OS === 'android' ? 40 : 0 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10 },
    headerTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
    iconBtn: { padding: 5 },
    card: { borderRadius: 20, padding: 25, height: 200, justifyContent: 'center', position: 'relative', overflow: 'hidden', borderWidth: 1, borderColor: '#334155' },
    avatar: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: '#0f172a' },
    username: { color: 'white', fontSize: 22, fontWeight: 'bold' },
    vipStatus: { color: '#94a3b8', fontSize: 12, marginTop: 5 },
    badgeContainer: { position: 'absolute', bottom: -5, alignSelf: 'center' },
    badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
    badgeText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
    bgVipText: { position: 'absolute', bottom: -10, right: 10, fontSize: 60, fontWeight: '900', color: 'white', opacity: 0.1, fontStyle: 'italic' },
    separatorContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
    line: { height: 1, backgroundColor: '#334155', width: 50 },
    separatorText: { color: '#fbbf24', fontSize: 16, fontWeight: '600' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 20, justifyContent: 'space-between' },
    gridItem: { width: '30%', alignItems: 'center', marginBottom: 25, backgroundColor: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 12 },
    gridIcon: { marginBottom: 10 },
    gridText: { color: '#94a3b8', fontSize: 12, textAlign: 'center', lineHeight: 16 },
    bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: 'rgba(15, 23, 42, 0.95)' },
    actionButton: { height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
    actionButtonText: { color: '#0f172a', fontSize: 18, fontWeight: 'bold' }
});
