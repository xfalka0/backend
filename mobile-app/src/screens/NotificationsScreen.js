import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function NotificationsScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Bildirimler</Text>
            <Text style={styles.subtitle}>Henüz bir bildirim yok.</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' },
    title: { color: 'white', fontSize: 24, fontWeight: '900', marginBottom: 10 },
    subtitle: { color: '#94a3b8', fontSize: 16 }
});
