import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Dimensions,
    SafeAreaView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import VipFrame from '../components/ui/VipFrame';

const { width } = Dimensions.get('window');

const VipFrameDemoScreen = ({ navigation }) => {
    const [isStaticMode, setIsStaticMode] = useState(false);

    const DEMO_USERS = [
        { id: 1, level: 1, name: 'Premium Üye', image: 'https://i.pravatar.cc/150?u=1' },
        { id: 2, level: 2, name: 'Elite Üye', image: 'https://i.pravatar.cc/150?u=2' },
        { id: 3, level: 3, name: 'Süperüye', image: 'https://i.pravatar.cc/150?u=3' },
        { id: 4, level: 4, name: 'Grand Master', image: 'https://i.pravatar.cc/150?u=4' },
        { id: 5, level: 5, name: 'Legendary', image: 'https://i.pravatar.cc/150?u=5' },
        { id: 6, level: 6, name: 'Ultimate King', image: 'https://i.pravatar.cc/150?u=6' },
    ];

    return (
        <SafeAreaView style={styles.container}>
            <LinearGradient
                colors={['#0f172a', '#1e1b4b']}
                style={StyleSheet.absoluteFill}
            />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={28} color="white" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>VIP Çerçeve Galerisi</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.infoBox}>
                    <Ionicons name="sparkles" size={24} color="#fbbf24" />
                    <Text style={styles.infoText}>
                        Sugo/Grand stilindeki bu çerçeveler seviye arttıkça daha ihtişamlı hale gelir.
                    </Text>
                </View>

                {/* Performance Toggle */}
                <View style={styles.toggleContainer}>
                    <Text style={styles.toggleLabel}>Performans Modu (Static):</Text>
                    <TouchableOpacity
                        onPress={() => setIsStaticMode(!isStaticMode)}
                        style={[styles.toggle, isStaticMode && styles.toggleActive]}
                    >
                        <View style={[styles.toggleCircle, isStaticMode && styles.toggleCircleActive]} />
                    </TouchableOpacity>
                </View>

                <View style={styles.grid}>
                    {DEMO_USERS.map((user) => (
                        <View key={user.id} style={styles.card}>
                            <VipFrame
                                level={user.level}
                                avatar={user.image}
                                size={100}
                                isStatic={isStaticMode}
                            />
                            <Text style={styles.userName}>{user.name}</Text>
                            <View style={styles.levelBadge}>
                                <Text style={styles.levelText}>VIP {user.level}</Text>
                            </View>
                        </View>
                    ))}
                </View>

                {/* List View Example */}
                <Text style={styles.sectionTitle}>Liste/Feed Görünümü</Text>
                <View style={styles.listView}>
                    {DEMO_USERS.slice(0, 3).map((user) => (
                        <View key={`list-${user.id}`} style={styles.listItem}>
                            <VipFrame
                                level={user.level}
                                avatar={user.image}
                                size={50}
                                isStatic={true} // Feed'de performans için static
                            />
                            <View style={styles.listTextContainer}>
                                <Text style={styles.listUserName}>{user.name}</Text>
                                <Text style={styles.listUserStatus}>Şu an aktif • 2km ötede</Text>
                            </View>
                            <Ionicons name="heart" size={24} color="#ef4444" />
                        </View>
                    ))}
                </View>

                <View style={{ height: 50 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    headerTitle: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    scrollContent: {
        padding: 20,
    },
    infoBox: {
        backgroundColor: 'rgba(251, 191, 36, 0.1)',
        padding: 15,
        borderRadius: 15,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(251, 191, 36, 0.2)',
    },
    infoText: {
        color: '#fbbf24',
        fontSize: 14,
        flex: 1,
        marginLeft: 10,
        fontWeight: '500',
    },
    toggleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: 15,
        borderRadius: 15,
        marginBottom: 20,
    },
    toggleLabel: {
        color: 'white',
        fontSize: 14,
        fontWeight: 'bold',
    },
    toggle: {
        width: 50,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#334155',
        padding: 2,
    },
    toggleActive: {
        backgroundColor: '#10b981',
    },
    toggleCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'white',
    },
    toggleCircleActive: {
        transform: [{ translateX: 22 }],
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    card: {
        width: (width - 60) / 2,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 20,
        padding: 15,
        alignItems: 'center',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    userName: {
        color: 'white',
        fontSize: 14,
        fontWeight: 'bold',
        marginTop: 10,
    },
    levelBadge: {
        marginTop: 5,
        backgroundColor: 'rgba(251, 191, 36, 0.2)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
    },
    levelText: {
        color: '#fbbf24',
        fontSize: 10,
        fontWeight: '900',
    },
    sectionTitle: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 10,
        marginBottom: 15,
    },
    listView: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 20,
        padding: 10,
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    listTextContainer: {
        flex: 1,
        marginLeft: 15,
    },
    listUserName: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    listUserStatus: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
        marginTop: 2,
    }
});

export default VipFrameDemoScreen;
