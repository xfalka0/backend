import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, GRADIENTS } from '../theme';

export default function GenderScreen({ navigation, route }) {
    const { userId } = route.params || {};
    const [selected, setSelected] = useState(null);

    const genders = [
        { id: 'kadin', label: 'Kadın', icon: 'woman-outline' },
        { id: 'erkek', label: 'Erkek', icon: 'man-outline' },
        { id: 'diger', label: 'Diğer', icon: 'person-outline' },
    ];

    return (
        <SafeAreaView style={styles.container}>
            <LinearGradient colors={[COLORS.background, '#1e1b4b']} style={styles.background} />

            <View style={styles.content}>
                <Text style={styles.title}>Cinsiyetini seç</Text>
                <Text style={styles.subtitle}>Sana en uygun profilleri göstermemize yardımcı ol.</Text>

                <View style={styles.optionsContainer}>
                    {genders.map((item) => (
                        <TouchableOpacity
                            key={item.id}
                            style={[
                                styles.optionCard,
                                selected === item.id && styles.selectedCard
                            ]}
                            onPress={() => setSelected(item.id)}
                        >
                            <LinearGradient
                                colors={selected === item.id ? GRADIENTS.primary : ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)']}
                                style={styles.optionGradient}
                            >
                                <Ionicons
                                    name={item.icon}
                                    size={32}
                                    color={selected === item.id ? 'white' : '#94a3b8'}
                                />
                                <Text style={[
                                    styles.optionLabel,
                                    selected === item.id && styles.selectedLabel
                                ]}>
                                    {item.label}
                                </Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    ))}
                </View>

                <TouchableOpacity
                    style={[styles.nextButton, !selected && styles.disabledButton]}
                    onPress={() => navigation.navigate('Relationship', { gender: selected, userId })}
                    disabled={!selected}
                >
                    <LinearGradient colors={GRADIENTS.primary} style={styles.buttonGradient}>
                        <Text style={styles.buttonText}>Devam Et</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    background: { ...StyleSheet.absoluteFillObject },
    content: { flex: 1, padding: 24, justifyContent: 'center' },
    title: { fontSize: 32, fontWeight: 'bold', color: 'white', marginBottom: 12 },
    subtitle: { fontSize: 16, color: '#94a3b8', marginBottom: 40 },
    optionsContainer: { gap: 16, marginBottom: 40 },
    optionCard: {
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        height: 80,
    },
    selectedCard: { borderColor: '#f472b6' },
    optionGradient: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24
    },
    optionLabel: { fontSize: 18, color: '#94a3b8', marginLeft: 16, fontWeight: '600' },
    selectedLabel: { color: 'white' },
    nextButton: { borderRadius: 30, overflow: 'hidden', height: 56, marginBottom: 16 },
    buttonGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    buttonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
    disabledButton: { opacity: 0.5 },
    skipButton: { alignItems: 'center' },
    skipText: { color: '#64748b', fontSize: 16 },
});
