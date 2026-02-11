import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Dimensions, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { Motion } from '../components/motion/MotionSystem';
import { DARK_THEME, LIGHT_THEME } from '../theme';

const { width } = Dimensions.get('window');

export default function ThemeSelectionScreen({ navigation, route }) {
    const { gender, name, avatar_url, userId, bio } = route.params || {};
    const { setTheme, themeMode } = useTheme();
    const [selected, setSelected] = useState('dark');

    const handleComplete = () => {
        setTheme(selected);
        navigation.navigate('Main', {
            user: { id: userId, display_name: name, avatar_url, bio },
            gender
        });
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: selected === 'dark' ? '#09090b' : '#f8fafc' }]}>
            <View style={styles.content}>
                <Motion.Fade>
                    <Text style={[styles.title, { color: selected === 'dark' ? 'white' : '#0f172a' }]}>
                        Tarzını Belirle
                    </Text>
                    <Text style={[styles.subtitle, { color: selected === 'dark' ? '#94a3b8' : '#64748b' }]}>
                        Uygulamanın nasıl görünmesini istersin? Bunu daha sonra ayarlardan değiştirebilirsin.
                    </Text>
                </Motion.Fade>

                <View style={styles.optionsContainer}>
                    {/* Dark Mode Option */}
                    <TouchableOpacity
                        style={[
                            styles.optionCard,
                            selected === 'dark' && styles.selectedCard,
                            { backgroundColor: '#18181b', borderColor: selected === 'dark' ? '#8b5cf6' : 'rgba(255,255,255,0.1)' }
                        ]}
                        onPress={() => setSelected('dark')}
                    >
                        <View style={styles.previewContainer}>
                            <View style={[styles.mockChat, { backgroundColor: '#27272a' }]}>
                                <View style={[styles.mockBubble, { width: '60%', backgroundColor: '#3f3f46' }]} />
                                <View style={[styles.mockBubble, { width: '40%', backgroundColor: '#8b5cf6', alignSelf: 'flex-end' }]} />
                            </View>
                        </View>
                        <View style={styles.optionLabelRow}>
                            <Ionicons name="moon" size={20} color="white" />
                            <Text style={styles.optionLabel}>Koyu Tema</Text>
                            {selected === 'dark' && <Ionicons name="checkmark-circle" size={20} color="#8b5cf6" />}
                        </View>
                    </TouchableOpacity>

                    {/* Light Mode Option */}
                    <TouchableOpacity
                        style={[
                            styles.optionCard,
                            selected === 'light' && styles.selectedCard,
                            { backgroundColor: '#ffffff', borderColor: selected === 'light' ? '#8b5cf6' : 'rgba(0,0,0,0.1)' }
                        ]}
                        onPress={() => setSelected('light')}
                    >
                        <View style={styles.previewContainer}>
                            <View style={[styles.mockChat, { backgroundColor: '#f1f5f9' }]}>
                                <View style={[styles.mockBubble, { width: '60%', backgroundColor: '#e2e8f0' }]} />
                                <View style={[styles.mockBubble, { width: '40%', backgroundColor: '#8b5cf6', alignSelf: 'flex-end' }]} />
                            </View>
                        </View>
                        <View style={styles.optionLabelRow}>
                            <Ionicons name="sunny" size={20} color="#0f172a" />
                            <Text style={[styles.optionLabel, { color: '#0f172a' }]}>Açık Tema</Text>
                            {selected === 'light' && <Ionicons name="checkmark-circle" size={20} color="#8b5cf6" />}
                        </View>
                    </TouchableOpacity>
                </View>

                <View style={{ flex: 1 }} />

                <TouchableOpacity
                    style={styles.nextButton}
                    onPress={handleComplete}
                >
                    <LinearGradient colors={['#8b5cf6', '#d946ef']} style={styles.buttonGradient}>
                        <Text style={styles.buttonText}>Kullanmaya Başla</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { flex: 1, padding: 24, justifyContent: 'center' },
    title: { fontSize: 32, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
    subtitle: { fontSize: 16, marginBottom: 40, textAlign: 'center', lineHeight: 24 },
    optionsContainer: { flexDirection: 'row', gap: 16, justifyContent: 'center' },
    optionCard: {
        width: (width - 64) / 2,
        borderRadius: 24,
        padding: 16,
        borderWidth: 2,
        alignItems: 'center',
    },
    selectedCard: {
        transform: [{ scale: 1.05 }],
    },
    previewContainer: {
        width: '100%',
        height: 140,
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 16,
    },
    mockChat: {
        flex: 1,
        padding: 12,
        gap: 8,
    },
    mockBubble: {
        height: 10,
        borderRadius: 5,
    },
    optionLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    optionLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        color: 'white',
    },
    nextButton: { borderRadius: 30, overflow: 'hidden', height: 60, marginBottom: 16 },
    buttonGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    buttonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
});
