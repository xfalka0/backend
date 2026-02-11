import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Image } from 'react-native';
import { useAlert } from '../contexts/AlertContext';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, GRADIENTS } from '../theme';

export default function PhotoScreen({ navigation, route }) {
    const { showAlert } = useAlert();
    const { gender, name, userId } = route.params || {};
    const [image, setImage] = useState(null);

    const pickImage = async () => {
        // Request permissions
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (permissionResult.granted === false) {
            showAlert({
                title: 'İzin Gerekli',
                message: 'Fotoğraf yüklemek için galeri erişimine izin vermelisiniz.',
                type: 'warning'
            });
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
        });

        if (!result.canceled) {
            setImage(result.assets[0].uri);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <LinearGradient colors={[COLORS.background, '#1e1b4b']} style={styles.background} />

            <View style={styles.content}>
                <Text style={styles.title}>Profil fotoğrafı ekle</Text>
                <Text style={styles.subtitle}>İyi bir fotoğraf %80 daha fazla etkileşim sağlar.</Text>

                <View style={styles.photoContainer}>
                    <TouchableOpacity style={styles.photoBox} onPress={pickImage}>
                        <LinearGradient
                            colors={['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)']}
                            style={styles.photoGradient}
                        >
                            {image ? (
                                <Image source={{ uri: image }} style={styles.image} />
                            ) : (
                                <View style={styles.placeholder}>
                                    <Ionicons name="camera" size={48} color="#8b5cf6" />
                                    <Text style={styles.placeholderText}>Fotoğraf Yükle</Text>
                                </View>
                            )}
                        </LinearGradient>
                        <View style={styles.addButton}>
                            <Ionicons name="add" size={24} color="white" />
                        </View>
                    </TouchableOpacity>
                </View>

                <View style={{ flex: 1 }} />

                <TouchableOpacity
                    style={styles.nextButton}
                    onPress={() => navigation.navigate('Bio', { gender, name, userId, avatar_url: image })}
                >
                    <LinearGradient colors={GRADIENTS.primary} style={styles.buttonGradient}>
                        <Text style={styles.buttonText}>Devam Et</Text>
                    </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity style={styles.skipButton} onPress={() => navigation.navigate('Bio', { gender, name, userId })}>
                    <Text style={styles.skipText}>Şimdilik Geç</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    background: { ...StyleSheet.absoluteFillObject },
    content: { flex: 1, padding: 24, paddingBottom: 40 },
    title: { fontSize: 28, fontWeight: 'bold', color: 'white', marginBottom: 12, marginTop: 40 },
    subtitle: { fontSize: 16, color: '#94a3b8', marginBottom: 40 },
    photoContainer: { alignItems: 'center', marginTop: 20 },
    photoBox: {
        width: 220,
        height: 220,
        borderRadius: 110,
        borderWidth: 2,
        borderColor: '#f472b6',
        borderStyle: 'dashed',
        padding: 4,
        position: 'relative',
    },
    photoGradient: {
        flex: 1,
        borderRadius: 105,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden'
    },
    placeholder: { alignItems: 'center' },
    placeholderText: { color: '#94a3b8', marginTop: 12, fontSize: 16, fontWeight: '600' },
    image: { width: '100%', height: '100%' },
    addButton: {
        position: 'absolute',
        bottom: 10,
        right: 10,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#f472b6',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 4,
        borderColor: COLORS.background,
    },
    nextButton: { borderRadius: 30, overflow: 'hidden', height: 60, marginBottom: 16 },
    buttonGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    buttonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
    skipButton: { alignItems: 'center' },
    skipText: { color: '#64748b', fontSize: 16 },
});
