import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function RoomCoverUploader({ imageUri, onPickImage, onRemoveImage }) {
    return (
        <View style={styles.container}>
            <Text style={styles.label}>ODA KAPAK RESMİ</Text>
            
            <TouchableOpacity 
                style={styles.uploadCard} 
                onPress={onPickImage}
                activeOpacity={0.85}
            >
                {imageUri ? (
                    <View style={styles.imageWrapper}>
                        <Image source={{ uri: imageUri }} style={styles.previewImage} />
                        <LinearGradient
                            colors={['transparent', 'rgba(11, 7, 26, 0.85)']}
                            style={styles.gradientOverlay}
                        />
                        <TouchableOpacity style={styles.removeBtn} onPress={onRemoveImage} activeOpacity={0.8}>
                            <Ionicons name="close" size={16} color="#FFF" />
                        </TouchableOpacity>
                        <View style={styles.changeBadge}>
                            <Ionicons name="camera" size={12} color="#FFF" />
                            <Text style={styles.changeBadgeText}>Resmi Değiştir</Text>
                        </View>
                    </View>
                ) : (
                    <View style={styles.placeholderContainer}>
                        <LinearGradient
                            colors={['rgba(168, 85, 247, 0.15)', 'rgba(236, 72, 153, 0.15)']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={StyleSheet.absoluteFill}
                        />
                        <View style={styles.iconCircle}>
                            <LinearGradient
                                colors={['#a855f7', '#ec4899']}
                                style={styles.iconGradient}
                            >
                                <Ionicons name="image" size={22} color="#FFF" />
                            </LinearGradient>
                        </View>
                        <Text style={styles.titleText}>Kapak Resmi Ekleyin</Text>
                        
                        <View style={styles.selectButtonPill}>
                            <Ionicons name="add-circle" size={14} color="#ec4899" />
                            <Text style={styles.selectBtnText}>Görsel Seç</Text>
                        </View>
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
        color: '#94A3B8',
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 1.2,
        marginBottom: 10,
    },
    uploadCard: {
        width: '100%',
        height: 155,
        borderRadius: 22,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
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
    gradientOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 70,
    },
    removeBtn: {
        position: 'absolute',
        top: 10,
        right: 10,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        width: 30,
        height: 30,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    changeBadge: {
        position: 'absolute',
        bottom: 12,
        left: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        gap: 5,
    },
    changeBadgeText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '700',
    },
    placeholderContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    iconCircle: {
        width: 46,
        height: 46,
        borderRadius: 23,
        overflow: 'hidden',
        marginBottom: 8,
        shadowColor: '#ec4899',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 3,
    },
    iconGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    titleText: {
        color: '#F8FAFC',
        fontSize: 14,
        fontWeight: '800',
        marginBottom: 3,
    },
    subText: {
        color: '#64748B',
        fontSize: 11,
        textAlign: 'center',
        marginBottom: 10,
    },
    selectButtonPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(236, 72, 153, 0.12)',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(236, 72, 153, 0.3)',
        gap: 4,
    },
    selectBtnText: {
        color: '#ec4899',
        fontSize: 11,
        fontWeight: '800',
    },
});
