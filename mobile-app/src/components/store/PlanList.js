import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import PlanCard from './PlanCard';
import { STORE_THEME } from '../../constants/storeTheme';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';

export default function PlanList({
    plans,
    selectedIndex,
    onSelectPlan,
    socialProofCount = '2.340'
}) {
    // 1-month plan monthly price is base price for savings calculation
    const basePlan = plans.find(p => p.months === 1) || plans[0];
    const baseMonthlyPrice = basePlan
        ? parseFloat(basePlan.price.replace(/[^0-9,.]/g, '').replace(',', '.'))
        : 449.99;

    return (
        <View style={styles.container}>
            {plans.map((plan, index) => (
                <Animated.View key={plan.months || index} entering={FadeInUp.delay(8 * STORE_THEME.animations.staggerDelay + index * STORE_THEME.animations.staggerDelay).duration(300)}>
                    <PlanCard
                        plan={plan}
                        isSelected={selectedIndex === index}
                        onSelect={() => onSelectPlan(index)}
                        baseMonthlyPrice={baseMonthlyPrice}
                    />
                </Animated.View>
            ))}

            {/* Social Proof Line */}
            <Animated.View entering={FadeInUp.delay(12 * STORE_THEME.animations.staggerDelay).duration(300)} style={styles.socialProofRow}>
                <Text style={styles.socialProofText}>
                    <Ionicons name="flame" size={14} color={STORE_THEME.colors.textMuted} /> Bu hafta <Text style={styles.socialProofHighlight}>{socialProofCount}</Text> kişi Premium'a geçti
                </Text>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: STORE_THEME.spacing.paddingHorizontal,
        marginBottom: 20,
    },
    socialProofRow: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 6,
        marginBottom: 10,
    },
    socialProofText: {
        fontSize: 12,
        color: STORE_THEME.colors.textGray,
        textAlign: 'center',
    },
    socialProofHighlight: {
        color: STORE_THEME.colors.textMuted,
        fontWeight: 'bold',
    },
});
