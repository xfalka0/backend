import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const SEAT_OPTIONS = [
    { count: 8, label: '8 Koltuk', isAvailable: true, level: 'Seviye 1' },
    { count: 12, label: '12 Koltuk', isAvailable: false, level: 'Seviye 2' },
    { count: 16, label: '16 Koltuk', isAvailable: false, level: 'Seviye 3' },
    { count: 20, label: '20 Koltuk', isAvailable: false, level: 'Seviye 4' },
];

export default function SeatCountSelector({ selectedSeats, onSelectSeats, onLockedPress }) {
    const handlePress = (option) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (option.isAvailable) {
            onSelectSeats(option.count);
        } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            if (onLockedPress) {
                onLockedPress(option);
            }
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <Text style={styles.label}>KOLTUK KAPASİTESİ</Text>
                <View style={styles.activeLevelTag}>
                    <Ionicons name="sparkles" size={10} color="#a855f7" />
                    <Text style={styles.activeLevelText}>Oda Seviyesi 1</Text>
                </View>
            </View>
            
            <View style={styles.gridContainer}>
                {SEAT_OPTIONS.map((option) => {
                    const isSelected = selectedSeats === option.count && option.isAvailable;
                    
                    if (isSelected) {
                        return (
                            <TouchableOpacity 
                                key={option.count} 
                                style={styles.activeWrapper}
                                activeOpacity={0.9}
                            >
                                <LinearGradient
                                    colors={['#a855f7', '#ec4899']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.activeGradient}
                                >
                                    <View style={styles.activeIconCircle}>
                                        <Ionicons name="people" size={15} color="#FFF" />
                                    </View>
                                    <View style={styles.activeTextGroup}>
                                        <Text style={styles.activeTitle}>{option.label}</Text>
                                        <Text style={styles.activeSub}>Aktif Kullanımda</Text>
                                    </View>
                                    <Ionicons name="checkmark-circle" size={16} color="#FFF" style={styles.checkIcon} />
                                </LinearGradient>
                            </TouchableOpacity>
                        );
                    }

                    return (
                        <TouchableOpacity
                            key={option.count}
                            style={[
                                styles.optionCard,
                                !option.isAvailable && styles.lockedCard
                            ]}
                            onPress={() => handlePress(option)}
                            activeOpacity={0.75}
                        >
                            <View style={styles.cardHeader}>
                                <View style={[
                                    styles.iconBox,
                                    !option.isAvailable && styles.lockedIconBox
                                ]}>
                                    <Ionicons 
                                        name={option.isAvailable ? "people-outline" : "lock-closed"} 
                                        size={13} 
                                        color={option.isAvailable ? "#ec4899" : "#64748B"} 
                                    />
                                </View>
                                {!option.isAvailable && (
                                    <View style={styles.levelBadge}>
                                        <Text style={styles.levelBadgeText}>{option.level}</Text>
                                    </View>
                                )}
                            </View>
                            <View style={{ marginTop: 4 }}>
                                <Text style={[
                                    styles.optionTitle,
                                    !option.isAvailable && styles.lockedTitle
                                ]}>
                                    {option.label}
                                </Text>
                                <Text style={styles.optionSub}>
                                    {option.isAvailable ? 'Seçilebilir' : 'İleride Açılacak'}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        marginBottom: 24,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    label: {
        color: '#94A3B8',
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 1.2,
    },
    activeLevelTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(168, 85, 247, 0.12)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(168, 85, 247, 0.25)',
        gap: 4,
    },
    activeLevelText: {
        color: '#c084fc',
        fontSize: 10,
        fontWeight: '800',
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    activeWrapper: {
        width: '48.5%',
        borderRadius: 18,
        backgroundColor: 'transparent',
    },
    activeGradient: {
        width: '100%',
        padding: 12,
        borderRadius: 18,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        minHeight: 68,
    },
    activeIconCircle: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    activeTextGroup: {
        flex: 1,
    },
    activeTitle: {
        color: '#FFFFFF',
        fontWeight: '900',
        fontSize: 13,
    },
    activeSub: {
        color: 'rgba(255, 255, 255, 0.85)',
        fontSize: 9,
        fontWeight: '600',
        marginTop: 1,
    },
    checkIcon: {
        marginLeft: 0,
    },
    optionCard: {
        width: '48.5%',
        padding: 12,
        minHeight: 68,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.07)',
        borderRadius: 18,
        justifyContent: 'space-between',
    },
    lockedCard: {
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        borderColor: 'rgba(255, 255, 255, 0.04)',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    iconBox: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: 'rgba(236, 72, 153, 0.12)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    lockedIconBox: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    levelBadge: {
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    levelBadgeText: {
        color: '#64748B',
        fontSize: 8.5,
        fontWeight: '800',
    },
    optionTitle: {
        color: '#F1F5F9',
        fontWeight: '800',
        fontSize: 13,
    },
    lockedTitle: {
        color: '#64748B',
    },
    optionSub: {
        color: '#475569',
        fontSize: 9,
        fontWeight: '600',
        marginTop: 1,
    },
});
