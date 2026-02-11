import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { API_URL } from '../config';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, GRADIENTS } from '../theme';

export default function BioScreen({ navigation, route }) {
    const { gender, name, avatar_url, userId } = route.params || {};
    const [bio, setBio] = useState('');

    const [loading, setLoading] = useState(false);

    const handleSetupComplete = async () => {
        setLoading(true);
        try {
            const currentUserId = userId || 'c917f7d6-cc44-4b04-8917-1dbbed0b1e9b';

            // 1. Update Profile in Backend
            if (name) {
                await axios.put(`${API_URL}/users/${currentUserId}/profile`, {
                    display_name: name,
                    bio: bio,
                    avatar_url: avatar_url
                });
            }

            // 2. Navigate to Main
            // Pass updated user object to Main for immediate local update
            const updatedUser = {
                id: currentUserId,
                display_name: name || 'Misafir',
                avatar_url: avatar_url,
                bio: bio
            };

            navigation.navigate('ThemeSelection', {
                gender,
                name,
                avatar_url,
                userId: currentUserId,
                bio
            });
        } catch (error) {
            console.error('Profile Update Error:', error);
            navigation.navigate('ThemeSelection', { gender });
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <LinearGradient colors={[COLORS.background, '#1e1b4b']} style={styles.background} />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <View style={styles.content}>
                    <Text style={styles.title}>Kendinden bahset</Text>
                    <Text style={styles.subtitle}>İnsanlara seninle konuşmaları için bir sebep ver.</Text>

                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="Kısaca kendini anlat..."
                            placeholderTextColor="#64748b"
                            value={bio}
                            onChangeText={setBio}
                            multiline
                            maxLength={200}
                            textAlignVertical="top"
                        />
                        <Text style={styles.charCount}>{bio.length}/200</Text>
                    </View>

                    <View style={{ flex: 1 }} />

                    <TouchableOpacity
                        style={styles.nextButton}
                        onPress={handleSetupComplete}
                        disabled={loading}
                    >
                        <LinearGradient colors={GRADIENTS.primary} style={styles.buttonGradient}>
                            {loading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text style={styles.buttonText}>Kaydet ve Başla</Text>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.skipButton} onPress={handleSetupComplete}>
                        <Text style={styles.skipText}>Şimdilik Geç</Text>
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
    title: { fontSize: 28, fontWeight: 'bold', color: 'white', marginBottom: 12, marginTop: 40 },
    subtitle: { fontSize: 16, color: '#94a3b8', marginBottom: 32 },
    inputContainer: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        minHeight: 140, // Reduced from 180
    },
    input: { color: 'white', fontSize: 16, height: 80 },
    charCount: {
        color: '#64748b',
        fontSize: 12,
        textAlign: 'right',
        marginTop: 10
    },
    nextButton: { borderRadius: 30, overflow: 'hidden', height: 60, marginBottom: 16 },
    buttonGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    buttonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
    skipButton: { alignItems: 'center' },
    skipText: { color: '#64748b', fontSize: 16 },
});
