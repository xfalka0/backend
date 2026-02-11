import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, GRADIENTS } from '../theme';

export default function RelationshipScreen({ navigation, route }) {
    const { gender, userId } = route.params || {};
    const [selected, setSelected] = useState([]);

    const options = [
        { id: 'sohbet', label: 'Sohbet', icon: 'chatbubbles-outline', desc: 'Sadece konuşmak istiyorum' },
        { id: 'flort', label: 'Flört', icon: 'heart-outline', desc: 'Yeni heyecanlar arıyorum' },
        { id: 'ciddi', label: 'Ciddi ilişki', icon: 'rose-outline', desc: 'Uzun süreli bir bağ' },
        { id: 'arkadaslik', label: 'Arkadaşlık', icon: 'people-outline', desc: 'Yeni insanlarla tanışmak' },
    ];

    const toggleSelect = (id) => {
        if (selected.includes(id)) {
            setSelected(selected.filter(i => i !== id));
        } else {
            setSelected([...selected, id]);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <LinearGradient colors={[COLORS.background, '#1e1b4b']} style={styles.background} />

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.title}>Ne tür bir ilişki arıyorsun?</Text>
                <Text style={styles.subtitle}>Birden fazla seçim yapabilirsin.</Text>

                <View style={styles.optionsContainer}>
                    {options.map((item) => (
                        <TouchableOpacity
                            key={item.id}
                            style={[
                                styles.optionCard,
                                selected.includes(item.id) && styles.selectedCard
                            ]}
                            onPress={() => toggleSelect(item.id)}
                        >
                            <LinearGradient
                                colors={selected.includes(item.id) ? GRADIENTS.primary : ['rgba(30, 41, 59, 0.7)', 'rgba(15, 23, 42, 0.7)']}
                                style={styles.optionGradient}
                            >
                                <View style={styles.iconContainer}>
                                    <Ionicons
                                        name={item.icon}
                                        size={30}
                                        color={selected.includes(item.id) ? 'white' : '#8b5cf6'}
                                    />
                                </View>
                                <View style={styles.textContainer}>
                                    <Text style={[styles.optionLabel, selected.includes(item.id) && { color: 'white' }]}>
                                        {item.label}
                                    </Text>
                                    <Text style={[styles.optionDesc, selected.includes(item.id) && { color: 'rgba(255,255,255,0.8)' }]}>
                                        {item.desc}
                                    </Text>
                                </View>
                                {selected.includes(item.id) && (
                                    <Ionicons name="checkmark-circle" size={24} color="white" />
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    ))}
                </View>

                <TouchableOpacity
                    style={[styles.nextButton, selected.length === 0 && styles.disabledButton]}
                    onPress={() => navigation.navigate('Interests', { gender, userId })}
                    disabled={selected.length === 0}
                >
                    <LinearGradient colors={GRADIENTS.primary} style={styles.buttonGradient}>
                        <Text style={styles.buttonText}>Devam Et</Text>
                    </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity style={styles.skipButton} onPress={() => navigation.navigate('Interests', { gender, userId })}>
                    <Text style={styles.skipText}>Atla</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    background: { ...StyleSheet.absoluteFillObject },
    content: { padding: 24, paddingBottom: 40 },
    title: { fontSize: 28, fontWeight: 'bold', color: 'white', marginBottom: 12 },
    subtitle: { fontSize: 16, color: '#94a3b8', marginBottom: 32 },
    optionsContainer: { gap: 16, marginBottom: 32 },
    optionCard: {
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    selectedCard: { borderColor: '#f472b6' },
    optionGradient: {
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center'
    },
    iconContainer: {
        width: 56,
        height: 56,
        borderRadius: 16,
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    textContainer: { flex: 1 },
    optionLabel: { fontSize: 18, fontWeight: 'bold', color: 'white', marginBottom: 4 },
    optionDesc: { fontSize: 14, color: '#64748b' },
    nextButton: { borderRadius: 30, overflow: 'hidden', height: 60, marginBottom: 16 },
    buttonGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    buttonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
    disabledButton: { opacity: 0.5 },
    skipButton: { alignItems: 'center' },
    skipText: { color: '#64748b', fontSize: 16 },
});
