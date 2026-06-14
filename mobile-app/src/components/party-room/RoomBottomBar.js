import React from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function RoomBottomBar({
    message,
    setMessage,
    onSendMessage,
    micMuted,
    onToggleMic,
    speakerMuted,
    onToggleSpeaker,
    onOpenGift,
    onOpenMenu,
    insets
}) {
    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={0}
        >
            <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 8), paddingTop: 8 }]}>
                {/* 1. Chat input (Left) */}
                <View style={styles.chatInputWrapper}>
                    <TextInput
                        style={styles.chatInput}
                        placeholder="Bir şeyler söyle..."
                        placeholderTextColor="rgba(255, 255, 255, 0.45)"
                        value={message}
                        onChangeText={setMessage}
                        onSubmitEditing={onSendMessage}
                        returnKeyType="send"
                    />
                </View>

                {/* 2. Emoji Button */}
                <TouchableOpacity style={styles.barIconBtn}>
                    <Ionicons name="happy-sharp" size={16} color="rgba(255, 255, 255, 0.85)" />
                </TouchableOpacity>

                {/* 3. Mic Toggle */}
                <TouchableOpacity
                    style={[styles.barIconBtn, !micMuted && styles.barIconBtnActive]}
                    onPress={onToggleMic}
                >
                    <Ionicons
                        name={!micMuted ? 'mic-sharp' : 'mic-off-sharp'}
                        size={16}
                        color={!micMuted ? '#ff007f' : 'rgba(255, 255, 255, 0.85)'}
                    />
                </TouchableOpacity>

                {/* 4. Speaker Toggle */}
                <TouchableOpacity
                    style={[styles.barIconBtn, !speakerMuted && styles.barIconBtnActive]}
                    onPress={onToggleSpeaker}
                >
                    <Ionicons
                        name={!speakerMuted ? 'volume-medium-sharp' : 'volume-mute-sharp'}
                        size={16}
                        color={!speakerMuted ? '#00f3ff' : 'rgba(255, 255, 255, 0.85)'}
                    />
                </TouchableOpacity>

                {/* 5. Menu Grid */}
                <TouchableOpacity style={styles.barIconBtn} onPress={onOpenMenu}>
                    <Ionicons name="grid-sharp" size={15} color="rgba(255, 255, 255, 0.85)" />
                </TouchableOpacity>

                {/* 6. Gift Button (White Circle, Pink Icon) */}
                <TouchableOpacity style={styles.giftBtn} onPress={() => onOpenGift(null)}>
                    <Ionicons name="gift" size={16} color="#ff007f" />
                </TouchableOpacity>

                {/* 7. Chat Count Badge Button */}
                <TouchableOpacity style={styles.chatBadgeBtn}>
                    <Ionicons name="chatbubble-ellipses-sharp" size={16} color="rgba(255,255,255,0.85)" />
                    <View style={styles.badgeCount}>
                        <Text style={styles.badgeText}>16</Text>
                    </View>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    bottomBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        backgroundColor: 'transparent',
        borderTopWidth: 0.5,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        gap: 5,
    },
    chatInputWrapper: {
        flex: 1.2,
        height: 32,
        backgroundColor: 'rgba(12, 16, 36, 0.75)',
        borderRadius: 16,
        paddingHorizontal: 12,
        justifyContent: 'center',
        borderWidth: 0.5,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    chatInput: {
        color: '#fff',
        fontSize: 10.5,
        fontWeight: '600',
        height: '100%',
    },
    barIconBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    barIconBtnActive: {
        backgroundColor: 'rgba(255, 0, 127, 0.22)',
    },
    giftBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#fff',
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 2,
    },
    giftBtnGrad: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    chatBadgeBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    badgeCount: {
        position: 'absolute',
        top: -3,
        right: -3,
        backgroundColor: '#ef4444',
        borderRadius: 6,
        paddingHorizontal: 3,
        paddingVertical: 0.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    badgeText: {
        color: '#fff',
        fontSize: 6.5,
        fontWeight: 'bold',
    },
});
