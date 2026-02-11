import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, GRADIENTS } from '../theme';

export default function InterestsScreen({ navigation, route }) {
    const { gender, userId } = route.params || {};
    const [selected, setSelected] = useState([]);

    const interests = [
        { id: 'spor', label: 'Spor', icon: 'fitness-outline' },
        { id: 'muzik', label: 'Müzik', icon: 'musical-notes-outline' },
        { id: 'oyun', label: 'Oyun', icon: 'game-controller-outline' },
        { id: 'seyahat', label: 'Seyahat', icon: 'airplane-outline' },
        { id: 'kitap', label: 'Kitap', icon: 'book-outline' },
        { id: 'film', label: 'Film', icon: 'film-outline' },
        { id: 'yazilim', label: 'Yazılım', icon: 'code-slash-outline' },
        { id: 'sanat', label: 'Sanat', icon: 'brush-outline' },
        { id: 'yemek', label: 'Yemek', icon: 'restaurant-outline' },
        { id: 'doga', label: 'Doğa', icon: 'leaf-outline' },
        { id: 'foto', label: 'Fotoğraf', icon: 'camera-outline' },
        { id: 'dans', label: 'Dans', icon: 'sparkles-outline' },
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
                <Text style={styles.title}>Nelerden hoşlanırsın?</Text>
                <Text style={styles.subtitle}>İlgi alanlarını seçerek seninle benzer zevklere sahip insanları bul.</Text>

                <View style={styles.chipContainer}>
                    {interests.map((item) => (
                        <TouchableOpacity
                            key={item.id}
                            style={[
                                styles.chip,
                                selected.includes(item.id) && styles.selectedChip
                            ]}
                            onPress={() => toggleSelect(item.id)}
                        >
                            <Ionicons
                                name={item.icon}
                                size={20}
                                color={selected.includes(item.id) ? 'white' : '#94a3b8'}
                                style={styles.chipIcon}
                            />
                            <Text style={[
                                styles.chipLabel,
                                selected.includes(item.id) && styles.selectedLabel
                            ]}>
                                {item.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <TouchableOpacity
                    style={[styles.nextButton, selected.length === 0 && styles.disabledButton]}
                    onPress={() => navigation.navigate('JobEducation', { gender, userId })}
                    disabled={selected.length === 0}
                >
                    <LinearGradient colors={GRADIENTS.primary} style={styles.buttonGradient}>
                        <Text style={styles.buttonText}>Devam Et</Text>
                    </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity style={styles.skipButton} onPress={() => navigation.navigate('JobEducation', { gender, userId })}>
                    <Text style={styles.skipText}>Geç</Text>
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
    chipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 40
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 30,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    selectedChip: {
        backgroundColor: '#8b5cf6',
        borderColor: '#f472b6',
    },
    chipIcon: { marginRight: 8 },
    chipLabel: { color: '#94a3b8', fontSize: 16, fontWeight: '600' },
    selectedLabel: { color: 'white' },
    nextButton: { borderRadius: 30, overflow: 'hidden', height: 60, marginBottom: 16 },
    buttonGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    buttonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
    disabledButton: { opacity: 0.5 },
    skipButton: { alignItems: 'center' },
    skipText: { color: '#64748b', fontSize: 16 },
});
