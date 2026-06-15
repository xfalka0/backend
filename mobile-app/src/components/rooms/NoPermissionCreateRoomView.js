import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import GlassCard from '../ui/GlassCard';

const { width } = Dimensions.get('window');

export default function NoPermissionCreateRoomView({ onApplyPress, onInfoPress, onBackPress }) {
    return (
        <View style={styles.container}>
            {/* Soft Glow Circles in background */}
            <View style={[styles.glowCircle, styles.glow1]} />
            <View style={[styles.glowCircle, styles.glow2]} />

            <GlassCard style={styles.card} intensity={30} tint="dark">
                {/* Header Back Button */}
                <TouchableOpacity style={styles.backBtn} onPress={onBackPress}>
                    <Ionicons name="chevron-back" size={24} color="#FFF" />
                </TouchableOpacity>

                {/* Locked Icon with Soft Glow */}
                <View style={styles.iconContainer}>
                    <LinearGradient
                        colors={['rgba(139, 92, 246, 0.3)', 'rgba(236, 72, 153, 0.3)']}
                        style={styles.iconCircle}
                    >
                        <Ionicons name="lock-closed-outline" size={54} color="#ec4899" />
                    </LinearGradient>
                </View>

                {/* Text Content */}
                <Text style={styles.title}>Oda Oluşturma Yetkin Yok</Text>
                
                <Text style={styles.description}>
                    Canlı oda oluşturma özelliği yalnızca onaylı ajans sahipleri ve yetkili hostlar için aktiftir. 
                    Sen de ajans başvurusu yaparak kendi odalarını yönetebilirsin.
                </Text>

                {/* Primary Action Button */}
                <TouchableOpacity style={styles.actionBtn} onPress={onApplyPress}>
                    <LinearGradient
                        colors={['#8b5cf6', '#ec4899']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.actionBtnGradient}
                    >
                        <Ionicons name="business-outline" size={20} color="#FFF" style={styles.btnIcon} />
                        <Text style={styles.actionBtnText}>Ajans Başvurusu Yap</Text>
                    </LinearGradient>
                </TouchableOpacity>

                {/* Secondary Button */}
                <TouchableOpacity style={styles.secondaryBtn} onPress={onInfoPress}>
                    <Text style={styles.secondaryBtnText}>Ajanslar Hakkında Bilgi Al</Text>
                </TouchableOpacity>
            </GlassCard>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
        backgroundColor: '#0B1028',
    },
    glowCircle: {
        position: 'absolute',
        width: 200,
        height: 200,
        borderRadius: 100,
        opacity: 0.15,
        filter: 'blur(40px)',
    },
    glow1: {
        backgroundColor: '#8b5cf6',
        top: '25%',
        left: '10%',
    },
    glow2: {
        backgroundColor: '#ec4899',
        bottom: '25%',
        right: '10%',
    },
    card: {
        width: width - 40,
        borderRadius: 30,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        shadowColor: '#ec4899',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 5,
        position: 'relative',
    },
    backBtn: {
        position: 'absolute',
        top: 20,
        left: 20,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconContainer: {
        marginBottom: 20,
        marginTop: 20,
    },
    iconCircle: {
        width: 110,
        height: 110,
        borderRadius: 55,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(236, 72, 153, 0.4)',
    },
    title: {
        color: '#FFFFFF',
        fontSize: 22,
        fontWeight: '900',
        textAlign: 'center',
        marginBottom: 14,
        letterSpacing: 0.5,
    },
    description: {
        color: '#9DA3B8',
        fontSize: 14,
        lineHeight: 22,
        textAlign: 'center',
        marginBottom: 30,
        paddingHorizontal: 10,
    },
    actionBtn: {
        width: '100%',
        height: 54,
        borderRadius: 27,
        overflow: 'hidden',
        marginBottom: 12,
        shadowColor: '#ec4899',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 3,
    },
    actionBtnGradient: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionBtnText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 15,
        letterSpacing: 0.5,
    },
    btnIcon: {
        marginRight: 8,
    },
    secondaryBtn: {
        width: '100%',
        height: 50,
        borderRadius: 25,
        borderWidth: 1.2,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    secondaryBtnText: {
        color: '#9DA3B8',
        fontWeight: '700',
        fontSize: 14,
    },
});
