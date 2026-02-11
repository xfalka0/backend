import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, GRADIENTS } from '../theme';

export default function NameScreen({ navigation, route }) {
    const { gender, userId } = route.params || {};
    const [name, setName] = useState('');

    return (
        <SafeAreaView style={styles.container}>
            <LinearGradient colors={[COLORS.background, '#1e1b4b']} style={styles.background} />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <View style={styles.content}>
                    <Text style={styles.title}>Adını gir</Text>
                    <Text style={styles.subtitle}>İnsanlar seni bu isimle görecek.</Text>

                    <View style={styles.inputContainer}>
                        <Ionicons name="person-circle-outline" size={24} color="#8b5cf6" style={styles.icon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Adınız"
                            placeholderTextColor="#64748b"
                            value={name}
                            onChangeText={setName}
                            autoFocus
                        />
                    </View>

                    <View style={{ flex: 1 }} />

                    <TouchableOpacity
                        style={[styles.nextButton, !name.trim() && styles.disabledButton]}
                        onPress={() => navigation.navigate('Photo', { gender, name, userId })}
                        disabled={!name.trim()}
                    >
                        <LinearGradient colors={GRADIENTS.primary} style={styles.buttonGradient}>
                            <Text style={styles.buttonText}>Devam Et</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    background: { ...StyleSheet.absoluteFillObject },
    content: { flex: 1, padding: 24, paddingBottom: 40 },
    title: { fontSize: 32, fontWeight: 'bold', color: 'white', marginBottom: 12, marginTop: 40 },
    subtitle: { fontSize: 16, color: '#94a3b8', marginBottom: 40 },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 20,
        paddingHorizontal: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        height: 64,
    },
    icon: { marginRight: 12 },
    input: { flex: 1, color: 'white', fontSize: 20, fontWeight: '600' },
    nextButton: { borderRadius: 30, overflow: 'hidden', height: 60 },
    buttonGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    buttonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
    disabledButton: { opacity: 0.5 },
});
