import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, FlatList, Dimensions, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

import { GIFTS } from '../constants/gifts';

export default function GiftPickerModal({ visible, onClose, onSelectGift, userBalance }) {
    const renderItem = ({ item }) => (
        <TouchableOpacity
            style={styles.giftItem}
            onPress={() => onSelectGift(item)}
            disabled={userBalance < item.price}
        >
            <View style={[styles.iconContainer, userBalance < item.price && styles.disabledGift]}>
                <Text style={styles.giftIcon}>{item.icon}</Text>
            </View>
            <Text style={styles.giftName}>{item.name}</Text>
            <View style={styles.priceTag}>
                <Ionicons name="card" size={12} color="#fbbf24" />
                <Text style={styles.priceText}>{item.price}</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Hediye Gönder</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color="#94a3b8" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.balanceContainer}>
                        <Text style={styles.balanceLabel}>Bakiyeniz:</Text>
                        <Text style={styles.balanceValue}>{userBalance} Coin</Text>
                    </View>

                    <FlatList
                        data={GIFTS}
                        renderItem={renderItem}
                        keyExtractor={item => item.id.toString()}
                        numColumns={3}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                    />
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: '#1e293b',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        height: '60%',
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    title: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    balanceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: 10,
        borderRadius: 12,
    },
    balanceLabel: {
        color: '#94a3b8',
        marginRight: 10,
    },
    balanceValue: {
        color: '#fbbf24',
        fontWeight: 'bold',
        fontSize: 16,
    },
    listContent: {
        paddingBottom: 20,
    },
    giftItem: {
        flex: 1,
        alignItems: 'center',
        margin: 5,
        backgroundColor: 'rgba(255,255,255,0.03)',
        padding: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    disabledGift: {
        opacity: 0.3,
    },
    iconContainer: {
        width: 50,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 5,
    },
    giftIcon: {
        fontSize: 32,
    },
    giftName: {
        color: 'white',
        fontSize: 12,
        marginBottom: 5,
        textAlign: 'center',
    },
    priceTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(251, 191, 36, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    priceText: {
        color: '#fbbf24',
        fontSize: 12,
        fontWeight: 'bold',
        marginLeft: 4,
    }
});
