import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

export default function RoomSystemMessages({ messages = [] }) {
    // If no real messages, display mock ones to keep the view populated and vibrant
    const defaultMessages = [
        { id: 'sys-1', type: 'system', content: '🛡️ Güvenli sohbet ortamı aktiftir.' },
        { id: 'sys-2', type: 'join', content: '✨ @Yiğit odaya katıldı.' },
        { id: 'sys-3', type: 'gift', content: '🎁 Sarah, Zaragoza\'ya Çikolata gönderdi.' }
    ];

    const displayMessages = messages.length > 0 ? messages.slice(-3) : defaultMessages;

    return (
        <View style={styles.container}>
            {displayMessages.map((msg, index) => {
                const isGift = msg.type === 'gift' || msg.messageType === 'gift';
                const isJoin = msg.type === 'join';

                return (
                    <View 
                        key={msg.id || index} 
                        style={[
                            styles.msgRow,
                            isGift && styles.giftRow,
                            isJoin && styles.joinRow
                        ]}
                    >
                        <Text 
                            style={[
                                styles.msgText,
                                isGift && styles.giftText,
                                isJoin && styles.joinText
                            ]}
                            numberOfLines={2}
                        >
                            {msg.content}
                        </Text>
                    </View>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: width * 0.7,
        gap: 4,
        paddingHorizontal: 12,
        marginBottom: 6,
    },
    msgRow: {
        backgroundColor: 'rgba(7, 11, 36, 0.75)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 0.5,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        alignSelf: 'flex-start',
    },
    giftRow: {
        backgroundColor: 'rgba(251, 191, 36, 0.15)',
        borderColor: 'rgba(251, 191, 36, 0.3)',
    },
    joinRow: {
        backgroundColor: 'rgba(0, 243, 255, 0.12)',
        borderColor: 'rgba(0, 243, 255, 0.35)',
    },
    msgText: {
        fontSize: 9.5,
        color: '#a8a29e',
        fontWeight: '500',
    },
    giftText: {
        color: '#fbbf24',
        fontWeight: '600',
    },
    joinText: {
        color: '#00f3ff',
        fontWeight: '600',
    },
});
