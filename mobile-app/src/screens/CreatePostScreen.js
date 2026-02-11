import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Image, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { API_URL } from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAlert } from '../contexts/AlertContext';

export default function CreatePostScreen({ route, navigation }) {
    const { showAlert } = useAlert();
    const { isStory } = route.params || {};
    const [caption, setCaption] = useState('');
    const [image, setImage] = useState(null);
    const [isUploading, setIsUploading] = useState(false);

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            showAlert({
                title: 'İzin Gerekli',
                message: 'Galerinize erişmek için izin vermeniz gerekiyor.',
                type: 'warning'
            });
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: isStory ? [9, 16] : [1, 1],
            quality: 0.7,
        });

        if (!result.canceled) {
            setImage(result.assets[0].uri);
        }
    };

    const handleShare = async () => {
        if (!image) {
            showAlert({
                title: 'Hata',
                message: 'Lütfen bir fotoğraf seçin.',
                type: 'warning'
            });
            return;
        }

        try {
            setIsUploading(true);
            const token = await AsyncStorage.getItem('token');

            // 1. Upload to Cloudinary via backend
            const formData = new FormData();
            formData.append('file', {
                uri: Platform.OS === 'ios' ? image.replace('file://', '') : image,
                type: 'image/jpeg',
                name: 'upload.jpg'
            });

            console.log('[CREATE_POST] Uploading image...');
            const uploadRes = await axios.post(`${API_URL}/upload`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!uploadRes.data.url) throw new Error('Fotoğraf yüklenemedi.');

            const imageUrl = uploadRes.data.url;
            console.log('[CREATE_POST] Image uploaded:', imageUrl);

            // 2. Create Story or Post
            const endpoint = isStory ? '/social/story' : '/social/post';
            await axios.post(`${API_URL}${endpoint}`, {
                image_url: imageUrl,
                content: caption
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            showAlert({
                title: 'Başarılı',
                message: isStory ? 'Hikayen paylaşıldı!' : 'Gönderin paylaşıldı!',
                type: 'success',
                onConfirm: () => navigation.goBack()
            });
        } catch (err) {
            console.error('[SHARE_ERROR] Full error:', err);
            const status = err.response?.status;
            const errorMsg = err.response?.data?.error || err.message || 'Bilinmeyen bir hata oluştu.';

            showAlert({
                title: 'Hata',
                message: `Paylaşım sırasında bir sorun oluştu.\n\nDurum Kodu: ${status || 'Bilinmiyor'}\nMesaj: ${errorMsg}`,
                type: 'error'
            });
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} disabled={isUploading}>
                    <Ionicons name="close" size={28} color="white" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{isStory ? 'Hikaye Paylaş' : 'Yeni Paylaşım'}</Text>
                <TouchableOpacity onPress={handleShare} disabled={isUploading}>
                    {isUploading ? (
                        <ActivityIndicator size="small" color="#d946ef" />
                    ) : (
                        <Text style={[styles.shareText, !image && { opacity: 0.5 }]}>
                            {isStory ? 'Hikaye' : 'Paylaş'}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <TouchableOpacity
                    style={[
                        styles.imageCard,
                        !image && styles.imagePlaceholder,
                        isStory && { aspectRatio: 9 / 16 }
                    ]}
                    onPress={pickImage}
                    disabled={isUploading}
                >
                    {image ? (
                        <>
                            <Image source={{ uri: image }} style={styles.previewImage} />
                            <View style={[StyleSheet.absoluteFill, styles.imageOverlay]}>
                                <Ionicons name="camera" size={30} color="white" />
                                <Text style={styles.changeText}>Değiştir</Text>
                            </View>
                        </>
                    ) : (
                        <View style={styles.placeholderContent}>
                            <LinearGradient
                                colors={['rgba(139, 92, 246, 0.2)', 'rgba(217, 70, 239, 0.2)']}
                                style={styles.placeholderCircle}
                            >
                                <Ionicons name={isStory ? "camera-outline" : "image-outline"} size={50} color="#d946ef" />
                            </LinearGradient>
                            <Text style={styles.placeholderTitle}>Fotoğraf Seç</Text>
                            <Text style={styles.placeholderSub}>
                                {isStory ? 'En güzel anını hikayende paylaş' : 'En güzel anını keşfette paylaş'}
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>

                <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>{isStory ? 'Metin Ekle' : 'Açıklama'}</Text>
                    <TextInput
                        multiline
                        numberOfLines={isStory ? 2 : 4}
                        placeholder={isStory ? "Bir şeyler yaz..." : "Neler düşünüyorsun?"}
                        placeholderTextColor="#94a3b8"
                        style={[styles.input, isStory && { minHeight: 60 }]}
                        value={caption}
                        onChangeText={setCaption}
                        disabled={isUploading}
                    />
                </View>

                {!isStory && (
                    <>
                        <TouchableOpacity style={styles.optionItem} disabled={isUploading}>
                            <Ionicons name="location-outline" size={20} color="#cbd5e1" />
                            <Text style={styles.optionText}>Konum Ekle</Text>
                            <Ionicons name="chevron-forward" size={20} color="#475569" />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.optionItem} disabled={isUploading}>
                            <Ionicons name="people-outline" size={20} color="#cbd5e1" />
                            <Text style={styles.optionText}>Kişileri Etiketle</Text>
                            <Ionicons name="chevron-forward" size={20} color="#475569" />
                        </TouchableOpacity>
                    </>
                )}
            </ScrollView>

            <View style={styles.bottomBar}>
                <TouchableOpacity
                    style={[styles.shareButton, (!image || isUploading) && { opacity: 0.7 }]}
                    onPress={handleShare}
                    disabled={isUploading}
                >
                    <LinearGradient
                        colors={['#8b5cf6', '#d946ef']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.shareGradient}
                    >
                        {isUploading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text style={styles.shareButtonText}>
                                {isStory ? 'Şimdi Hikayende Paylaş' : 'Şimdi Paylaş'}
                            </Text>
                        )}
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 50,
        paddingBottom: 15,
        backgroundColor: '#1e293b50',
    },
    headerTitle: {
        color: 'white',
        fontSize: 18,
        fontWeight: '900',
    },
    shareText: {
        color: '#d946ef',
        fontSize: 16,
        fontWeight: '800',
    },
    content: {
        padding: 20,
    },
    imageCard: {
        width: '100%',
        aspectRatio: 1,
        borderRadius: 25,
        overflow: 'hidden',
        backgroundColor: '#1e293b',
        marginBottom: 25,
        elevation: 10,
        shadowColor: 'black',
        shadowOpacity: 0.3,
        shadowRadius: 10,
    },
    imagePlaceholder: {
        borderWidth: 2,
        borderColor: 'rgba(217, 70, 239, 0.3)',
        borderStyle: 'dashed',
        backgroundColor: 'rgba(30, 41, 59, 0.5)',
    },
    previewImage: {
        width: '100%',
        height: '100%',
    },
    imageOverlay: {
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
        opacity: 0, // Show on hover/touch if needed, but for RN we just show it
    },
    placeholderContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    placeholderCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 15,
    },
    placeholderTitle: {
        color: 'white',
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    placeholderSub: {
        color: '#94a3b8',
        fontSize: 14,
        textAlign: 'center',
    },
    changeText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
        marginTop: 5,
    },
    inputContainer: {
        marginBottom: 25,
    },
    inputLabel: {
        color: '#94a3b8',
        fontSize: 12,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 10,
        marginLeft: 5,
    },
    input: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 15,
        padding: 15,
        color: 'white',
        fontSize: 15,
        minHeight: 100,
        textAlignVertical: 'top',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
        padding: 15,
        borderRadius: 15,
        marginBottom: 12,
        gap: 12,
    },
    optionText: {
        flex: 1,
        color: '#cbd5e1',
        fontSize: 15,
        fontWeight: '600',
    },
    bottomBar: {
        padding: 20,
        paddingBottom: 40,
    },
    shareButton: {
        height: 56,
        borderRadius: 20,
        overflow: 'hidden',
    },
    shareGradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    shareButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
});
