import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, GRADIENTS } from '../theme';

export default function JobEducationScreen({ navigation, route }) {
    const { gender, userId } = route.params || {};
    const [job, setJob] = useState('');
    const [education, setEducation] = useState(null);

    const eduLevels = ['İlkokul', 'Lise', 'Üniversite', 'Yüksek Lisans', 'Doktora'];

    return (
        <SafeAreaView style={styles.container}>
            <LinearGradient colors={[COLORS.background, '#1e1b4b']} style={styles.background} />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.content}>
                    <Text style={styles.title}>Meslek ve Eğitim</Text>
                    <Text style={styles.subtitle}>İnsanların seni daha iyi tanımasını sağla.</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Meslek</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Örn: Yazılımcı, Tasarımcı..."
                            placeholderTextColor="#64748b"
                            value={job}
                            onChangeText={setJob}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Eğitim Düzeyi</Text>
                        <View style={styles.eduGrid}>
                            {eduLevels.map((level) => (
                                <TouchableOpacity
                                    key={level}
                                    style={[
                                        styles.eduItem,
                                        education === level && styles.selectedEdu
                                    ]}
                                    onPress={() => setEducation(level)}
                                >
                                    <Text style={[
                                        styles.eduText,
                                        education === level && styles.selectedEduText
                                    ]}>
                                        {level}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <View style={{ flex: 1 }} />

                    <TouchableOpacity
                        style={[styles.nextButton, (!job || !education) && styles.disabledButton]}
                        onPress={() => navigation.navigate('Name', { gender, userId })}
                        disabled={(!job || !education)}
                    >
                        <LinearGradient colors={GRADIENTS.primary} style={styles.buttonGradient}>
                            <Text style={styles.buttonText}>Devam Et</Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.skipButton} onPress={() => navigation.navigate('Name', { gender, userId })}>
                        <Text style={styles.skipText}>Atla</Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    background: { ...StyleSheet.absoluteFillObject },
    content: { flexGrow: 1, padding: 24, paddingBottom: 40 },
    title: { fontSize: 28, fontWeight: 'bold', color: 'white', marginBottom: 12 },
    subtitle: { fontSize: 16, color: '#94a3b8', marginBottom: 32 },
    inputGroup: { marginBottom: 24 },
    label: { color: 'white', fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
    input: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 16,
        color: 'white',
        fontSize: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    eduGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    eduItem: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    selectedEdu: {
        backgroundColor: 'rgba(139, 92, 246, 0.2)',
        borderColor: '#8b5cf6',
    },
    eduText: { color: '#94a3b8', fontSize: 14 },
    selectedEduText: { color: 'white', fontWeight: 'bold' },
    nextButton: { borderRadius: 30, overflow: 'hidden', height: 60, marginBottom: 16, marginTop: 24 },
    buttonGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    buttonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
    disabledButton: { opacity: 0.5 },
    skipButton: { alignItems: 'center' },
    skipText: { color: '#64748b', fontSize: 16 },
});
