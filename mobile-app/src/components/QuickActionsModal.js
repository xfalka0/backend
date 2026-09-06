import React, { useState, useEffect } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    TouchableOpacity, 
    FlatList, 
    TextInput, 
    Keyboard,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

const QuickActionsModal = ({ visible, onClose, onSelectMessage }) => {
    const [messages, setMessages] = useState([
        "Selam, nasılsın? 😊",
        "Harika görünüyorsun! 🔥",
        "Bugün günün nasıl geçti? ✨",
        "Müsait olduğunda konuşalım mı? 📞",
        "Seni tanımak isterim 💫",
        "Neler yapıyorsun? 🎈"
    ]);
    const [isAdding, setIsAdding] = useState(false);
    const [newItemText, setNewItemText] = useState('');

    useEffect(() => {
        if (visible) {
            Keyboard.dismiss();
        }
    }, [visible]);

    if (!visible) return null;

    const renderMessageItem = ({ item }) => (
        <TouchableOpacity 
            style={styles.messageItem}
            activeOpacity={0.7}
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSelectMessage(item);
                onClose();
            }}
        >
            <LinearGradient
                colors={['rgba(217, 70, 239, 0.1)', 'rgba(217, 70, 239, 0.02)']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                borderRadius={20}
            />
            <View style={styles.iconContainer}>
                <View style={styles.bubbleIcon}>
                    <Ionicons name="flash-outline" size={18} color="#d946ef" />
                </View>
            </View>
            <Text style={styles.messageText}>{item}</Text>
            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.2)" />
        </TouchableOpacity>
    );

    const handleAdd = () => {
        if (newItemText.trim()) {
            setMessages([newItemText.trim(), ...messages]);
            setNewItemText('');
            setIsAdding(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
    };

    return (
        <View style={styles.modalAbsoluteWrapper} pointerEvents="box-none">
            <TouchableOpacity 
                style={styles.modalOverlay} 
                activeOpacity={1} 
                onPress={onClose} 
            />
            <View style={styles.modalContent}>
                <View style={styles.dragHandle} />
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Hızlı Yanıtlar</Text>
                    <Text style={styles.hintText}>
                        Sohbete hızlıca başlamak için dokunun
                    </Text>
                </View>

                <FlatList
                    data={messages}
                    renderItem={renderMessageItem}
                    keyExtractor={(item, index) => index.toString()}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ListHeaderComponent={
                        isAdding ? (
                            <View style={styles.addItemContainer}>
                                <TextInput 
                                    style={styles.addInput}
                                    placeholder="Yeni hızlı yanıt yaz..."
                                    placeholderTextColor="rgba(255,255,255,0.3)"
                                    value={newItemText}
                                    onChangeText={setNewItemText}
                                    autoFocus
                                    maxLength={80}
                                />
                                <TouchableOpacity style={styles.saveButton} onPress={handleAdd}>
                                    <Text style={styles.saveButtonText}>Ekle</Text>
                                </TouchableOpacity>
                            </View>
                        ) : null
                    }
                    ListFooterComponent={
                        !isAdding && (
                            <TouchableOpacity 
                                style={styles.addButton} 
                                activeOpacity={0.7}
                                onPress={() => setIsAdding(true)}
                            >
                                <Ionicons name="add-circle-outline" size={22} color="#d946ef" />
                                <Text style={styles.addButtonText}>Kendi Yanıtını Ekle</Text>
                            </TouchableOpacity>
                        )
                    }
                />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    modalAbsoluteWrapper: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 10000,
    },
    modalOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.6)',
        zIndex: 10000,
    },
    modalContent: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#0B0F19', // Sleek dark slate
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        paddingTop: 12,
        paddingHorizontal: 20,
        paddingBottom: 40,
        maxHeight: '80%',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        zIndex: 10001,
    },
    dragHandle: {
        width: 40,
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 24,
    },
    header: {
        alignItems: 'center',
        marginBottom: 20,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 6,
        letterSpacing: 0.5,
    },
    hintText: {
        textAlign: 'center',
        color: 'rgba(255,255,255,0.4)',
        fontSize: 13,
        fontWeight: '500',
    },
    listContent: {
        paddingBottom: 20,
    },
    messageItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(30, 41, 59, 0.4)', // slate-800 with opacity
        padding: 16,
        borderRadius: 20,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    iconContainer: {
        marginRight: 12,
    },
    bubbleIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(217, 70, 239, 0.1)', // fuchsia-500 light
        justifyContent: 'center',
        alignItems: 'center',
    },
    messageText: {
        flex: 1,
        fontSize: 15,
        color: 'rgba(255,255,255,0.95)',
        fontWeight: '600',
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(30, 41, 59, 0.3)',
        padding: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: 'rgba(217, 70, 239, 0.3)',
        marginTop: 10,
    },
    addButtonText: {
        marginLeft: 8,
        color: '#d946ef',
        fontWeight: '700',
        fontSize: 14,
    },
    addItemContainer: {
        marginBottom: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    addInput: {
        flex: 1,
        backgroundColor: 'rgba(30, 41, 59, 0.8)',
        borderRadius: 16,
        padding: 16,
        color: '#fff',
        fontSize: 15,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    saveButton: {
        backgroundColor: '#d946ef',
        borderRadius: 16,
        paddingVertical: 16,
        paddingHorizontal: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    saveButtonText: {
        color: '#fff',
        fontWeight: '900',
        fontSize: 15,
    }
});

export default QuickActionsModal;
