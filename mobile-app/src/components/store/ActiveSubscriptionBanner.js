import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { STORE_THEME } from '../../constants/storeTheme';

export default function ActiveSubscriptionBanner({ startDate, expireDate }) {
    const formatDate = (dateString) => {
        if (!dateString) return '-';
        try {
            const d = new Date(dateString);
            if (isNaN(d.getTime())) return '-';
            return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
        } catch (e) {
            return '-';
        }
    };

    const getRemainingDays = (dateString) => {
        if (!dateString) return null;
        try {
            const now = new Date();
            const expire = new Date(dateString);
            const diffMs = expire.getTime() - now.getTime();
            if (diffMs <= 0) return 0;
            return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        } catch (e) {
            return null;
        }
    };

    const remainingDays = getRemainingDays(expireDate);

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#24121A', '#160910']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.card}
            >
                {/* Header Row */}
                <View style={styles.headerRow}>
                    <View style={styles.leftGroup}>
                        <View style={styles.iconWrapper}>
                            <FontAwesome5 name="crown" size={14} color="#FFC53D" />
                        </View>
                        <View>
                            <Text style={styles.title}>Fiva Premium</Text>
                            <Text style={styles.subtitle}>Tüm ayrıcalıklar aktif</Text>
                        </View>
                    </View>

                    <View style={styles.badge}>
                        <View style={styles.dot} />
                        <Text style={styles.badgeText}>AKTİF</Text>
                    </View>
                </View>

                {/* Divider */}
                <View style={styles.divider} />

                {/* Dates Row */}
                <View style={styles.infoRow}>
                    <View style={styles.infoCol}>
                        <Text style={styles.infoLabel}>BAŞLANGIÇ</Text>
                        <Text style={styles.infoValue}>{formatDate(startDate)}</Text>
                    </View>

                    <View style={styles.verticalLine} />

                    <View style={styles.infoCol}>
                        <Text style={styles.infoLabel}>BİTİŞ TARİHİ</Text>
                        <Text style={[styles.infoValue, { color: '#FFC53D' }]}>{formatDate(expireDate)}</Text>
                    </View>

                    {remainingDays !== null ? (
                        <>
                            <View style={styles.verticalLine} />
                            <View style={styles.infoCol}>
                                <Text style={styles.infoLabel}>KALAN SÜRE</Text>
                                <Text style={[styles.infoValue, { color: '#34D399' }]}>
                                    {remainingDays > 0 ? `${remainingDays} gün` : 'Son gün'}
                                </Text>
                            </View>
                        </>
                    ) : null}
                </View>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: STORE_THEME.spacing.paddingHorizontal,
        marginBottom: 16,
    },
    card: {
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: '#1A0C13',
        borderWidth: 1,
        borderColor: 'rgba(255, 197, 61, 0.25)',
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    leftGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    iconWrapper: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: 'rgba(255, 197, 61, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(255, 197, 61, 0.25)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: -0.2,
    },
    subtitle: {
        fontSize: 11,
        color: '#A08D93',
        fontWeight: '500',
        marginTop: 1,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(52, 211, 153, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(52, 211, 153, 0.3)',
        paddingHorizontal: 8,
        paddingVertical: 3.5,
        borderRadius: 10,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#34D399',
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#34D399',
        letterSpacing: 0.5,
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        marginVertical: 11,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    infoCol: {
        flex: 1,
    },
    verticalLine: {
        width: 1,
        height: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        marginHorizontal: 8,
    },
    infoLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: '#7D6A71',
        letterSpacing: 0.5,
        marginBottom: 3,
    },
    infoValue: {
        fontSize: 13,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});
