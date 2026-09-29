import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { STORE_THEME } from '../../constants/storeTheme';

export default function WalletChip({ balance = 0, onRecharge }) {
    return (
        <TouchableOpacity
            style={styles.chipContainer}
            onPress={onRecharge}
            activeOpacity={0.8}
            accessibilityLabel={`Altın Cüzdan: ${Number(balance).toLocaleString('tr-TR')} altın. Bakiye yüklemek için dokunun.`}
            accessibilityRole="button"
        >
            <LinearGradient
                colors={['rgba(255, 197, 61, 0.15)', 'rgba(255, 197, 61, 0.05)']}
                style={styles.chipGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <View style={styles.iconCircle}>
                    <FontAwesome5 name="coins" size={12} color="#FFC53D" />
                </View>

                <Text style={styles.balanceText} numberOfLines={1}>
                    {Number(balance).toLocaleString('tr-TR')}
                </Text>

                <View style={styles.plusBtn}>
                    <Ionicons name="add" size={14} color="#0A0305" />
                </View>
            </LinearGradient>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    chipContainer: {
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 197, 61, 0.3)',
    },
    chipGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 5,
        paddingHorizontal: 8,
        gap: 6,
    },
    iconCircle: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: 'rgba(255, 197, 61, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    balanceText: {
        fontSize: 13,
        fontWeight: 'bold',
        color: STORE_THEME.colors.accentGold,
        maxWidth: 100,
    },
    plusBtn: {
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: STORE_THEME.colors.accentGold,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
