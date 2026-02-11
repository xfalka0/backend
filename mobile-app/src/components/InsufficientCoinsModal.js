import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export default function InsufficientCoinsModal({ visible, onClose, onBuyCoins }) {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <LinearGradient
                        colors={['#1e293b', '#0f172a']}
                        style={styles.gradient}
                    >
                        <View style={styles.iconContainer}>
                            <Ionicons name="alert-circle" size={50} color="#f59e0b" />
                        </View>

                        <Text style={styles.title}>Yetersiz Bakiye</Text>
                        <Text style={styles.message}>
                            Mesaj göndermek için yeterli coininiz bulunmamaktadır. Sohbet etmeye devam etmek için lütfen yükleme yapın.
                        </Text>

                        <TouchableOpacity onPress={onBuyCoins} style={{ width: '100%' }}>
                            <LinearGradient
                                colors={['#f59e0b', '#d97706']}
                                style={styles.buyBtn}
                            >
                                <Ionicons name="cart" size={20} color="white" style={{ marginRight: 8 }} />
                                <Text style={styles.buyBtnText}>Coin Yükle</Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
                            <Text style={styles.cancelBtnText}>Vazgeç</Text>
                        </TouchableOpacity>
                    </LinearGradient>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    container: {
        width: width * 0.85,
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)'
    },
    gradient: {
        padding: 24,
        alignItems: 'center'
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16
    },
    title: {
        color: 'white',
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 10
    },
    message: {
        color: '#94a3b8',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22
    },
    buyBtn: {
        flexDirection: 'row',
        paddingVertical: 14,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
        width: '100%'
    },
    buyBtnText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold'
    },
    cancelBtn: {
        paddingVertical: 10
    },
    cancelBtnText: {
        color: '#64748b',
        fontSize: 14,
        fontWeight: '600'
    }
});
