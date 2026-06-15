import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function RoomCoverUploader({ imageUri, onPickImage, onRemoveImage }) {
    return (
        <View style={styles.container}>
            <Text style={styles.label}>Oda Kapak Resmi</Text>
            
            <TouchableOpacity 
                style={[styles.uploadCard, imageUri && styles.uploadCardActive]} 
                onPress={onPickImage}
                activeOpacity={0.8}
            >
                {imageUri ? (
                    <View style={styles.imageWrapper}>
                        <Image source={{ uri: imageUri }} style={styles.previewImage} />
                        <TouchableOpacity style={styles.removeBtn} onPress={onRemoveImage} activeOpacity={0.7}>
                            <Ionicons name="close-circle" size={26} color="#FF3F86" />
                        </TouchableOpacity>
                        <View style={styles.changeBadge}>
                            <Ionicons name="camera-outline" size={14} color="#FFF" />
                            <Text style={styles.changeBadgeText}>Değiştir</Text>
                        </View>
                    </View>
                ) : (
                    <View style={styles.placeholder}>
                        <View style={styles.iconCircle}>
                            <Ionicons name="image-outline" size={32} color="#FF3F86" />
                        </View>
                        <Text style={styles.titleText}>Harika Bir Görsel Seç</Text>
                        <Text style={styles.subText}>Kapak resmi odanın keşfedilmesini kolaylaştırır</Text>
                    </View>
                )}
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        marginBottom: 20,
    },
    label: {
        color: '#9DA3B8',
        fontSize: 13,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 10,
    },
    uploadCard: {
        width: '100%',
        height: 160,
        borderRadius: 24,
        borderWidth: 1.5,
        borderColor: 'rgba(255, 63, 134, 0.25)',
        borderStyle: 'dashed',
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    uploadCardActive: {
        borderStyle: 'solid',
        borderColor: 'rgba(255, 63, 134, 0.5)',
    },
    imageWrapper: {
        width: '100%',
        height: '100%',
        position: 'relative',
    },
    previewImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    removeBtn: {
        position: 'absolute',
        top: 12,
        right: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        borderRadius: 14,
        padding: 2,
    },
    changeBadge: {
        position: 'absolute',
        bottom: 12,
        left: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        gap: 4,
    },
    changeBadgeText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '700',
    },
    placeholder: {
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    iconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(255, 63, 134, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    titleText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    subText: {
        color: '#64748B',
        fontSize: 12,
        textAlign: 'center',
    },
});
