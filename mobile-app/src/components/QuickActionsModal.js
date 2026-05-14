import React, { useState, useEffect } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    TouchableOpacity, 
    FlatList, 
    TextInput, 
    Keyboard,
    Platform,
    Image
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const QuickActionsModal = ({ visible, onClose, onSelectMessage }) => {
    const [messages, setMessages] = useState([
        "Selam, nasılsın? 😊",
        "Tipimi beğenmiyor musun? 🤔",
        "Bugün yeni bir şey var mı? ✨",
        "Neden cevap vermiyorsun? 🥺",
        "Sanırım telefonum bozuldu; mesajlarını alamıyorum 📱",
        "Harika görünüyorsun! 🔥",
        "Müsait olduğunda konuşalım mı? 📞"
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
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSelectMessage(item);
                onClose();
            }}
        >
            <View style={styles.iconContainer}>
                <View style={styles.bubbleIcon}>
                    <MaterialCommunityIcons name="comment-text-outline" size={20} color="#facc15" />
                </View>
            </View>
            <Text style={styles.messageText}>{item}</Text>
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
                    <View style={styles.tabContainer}>
                        <Text style={styles.headerTitle}>Hızlı Mesajlar</Text>
                        <View style={styles.activeDot} />
                    </View>
                </View>

                <Text style={styles.hintText}>
                    Hızlıca göndermek için bir mesaja dokun
                </Text>

                <FlatList
                    data={messages}
                    renderItem={renderMessageItem}
                    keyExtractor={(item, index) => index.toString()}
                    contentContainerStyle={styles.listContent}
                    ListHeaderComponent={
                        isAdding ? (
                            <View style={styles.addItemContainer}>
                                <TextInput 
                                    style={styles.addInput}
                                    placeholder="Yeni hızlı mesaj yaz..."
                                    placeholderTextColor="rgba(255,255,255,0.3)"
                                    value={newItemText}
                                    onChangeText={setNewItemText}
                                    autoFocus
                                />
                                <TouchableOpacity style={styles.saveButton} onPress={handleAdd}>
                                    <Text style={styles.saveButtonText}>Kaydet</Text>
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
                                <Ionicons name="add" size={24} color="#facc15" />
                                <Text style={styles.addButtonText}>Yeni Ekle</Text>
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
        backgroundColor: 'rgba(0,0,0,0.7)',
        zIndex: 10000,
    },
    modalContent: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#1a0b2e',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        paddingTop: 12,
        paddingHorizontal: 20,
        paddingBottom: 40,
        maxHeight: '80%',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        zIndex: 10001,
    },
    dragHandle: {
        width: 40,
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 20,
    },
    header: {
        paddingTop: 10,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
    },
    tabContainer: {
        alignItems: 'center',
        marginBottom: 10,
    },
    activeDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#facc15',
        marginTop: 6,
    },
    listContent: {
        paddingBottom: 20,
    },
    messageItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: 16,
        borderRadius: 20,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    iconContainer: {
        marginRight: 16,
    },
    bubbleIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    messageText: {
        flex: 1,
        fontSize: 15,
        color: 'rgba(255,255,255,0.9)',
        fontWeight: '500',
    },
    hintText: {
        textAlign: 'center',
        color: 'rgba(255,255,255,0.4)',
        fontSize: 12,
        marginBottom: 20,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(250, 204, 21, 0.1)',
        padding: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: '#facc15',
        marginTop: 10,
    },
    addButtonText: {
        marginLeft: 8,
        color: '#facc15',
        fontWeight: 'bold',
    },
    addItemContainer: {
        marginBottom: 20,
    },
    addInput: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: 15,
        color: '#fff',
        fontSize: 16,
        marginBottom: 10,
    },
    saveButton: {
        backgroundColor: '#facc15',
        borderRadius: 12,
        padding: 12,
        alignItems: 'center',
    },
    saveButtonText: {
        color: '#1a0b2e',
        fontWeight: 'bold',
        fontSize: 16,
    }
});

export default QuickActionsModal;
