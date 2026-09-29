import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import WalletChip from './WalletChip';
import { STORE_THEME } from '../../constants/storeTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function StoreHeader({ onBack, balance, onRecharge }) {
    const insets = useSafeAreaInsets();

    return (
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) + 8 }]}>
            <TouchableOpacity
                onPress={onBack}
                style={styles.circleBtn}
                accessibilityLabel="Geri"
                accessibilityRole="button"
            >
                <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>Mağaza</Text>

            <WalletChip balance={balance} onRecharge={onRecharge} />
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: STORE_THEME.spacing.paddingHorizontal,
        paddingVertical: 12,
        zIndex: 20,
    },
    circleBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: STORE_THEME.colors.textWhite,
        letterSpacing: -0.3,
    },
});
