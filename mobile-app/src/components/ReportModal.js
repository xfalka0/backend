import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useAlert } from '../contexts/AlertContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { API_URL } from '../config';

const REASONS = [
    { id: 'inappropriate', label: 'Uygunsuz görsel' },
    { id: 'harassment', label: 'Taciz / Zorbalık' },
    { id: 'spam', label: 'Spam / Dolandırıcılık' },
    { id: 'other', label: 'Diğer' },
];

export default function ReportModal({ visible, onClose, reporterId, reportedId, onReportSubmitted }) {
    const { showAlert } = useAlert();
    const [selectedReason, setSelectedReason] = useState(null);
    const [details, setDetails] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!selectedReason) {
            showAlert({ title: 'Eksik Bilgi', message: 'Lütfen bir şikayet nedeni seçin.', type: 'warning' });
            return;
        }

        setLoading(true);
        try {
            await axios.post(`${API_URL}/report`, {
                reporterId,
                reportedId,
                reason: selectedReason,
                details
            });
            showAlert({
                title: 'Şikayet Alındı',
                message: 'Bildiriminiz için teşekkür ederiz. Kullanıcı incelemeye alındı.',
                type: 'success',
                onConfirm: () => {
                    if (onReportSubmitted) onReportSubmitted();
                    onClose();
                }
            });
        } catch (error) {
            console.error(error);
            showAlert({ title: 'Hata', message: 'Şikayet gönderilemedi.', type: 'error' });
        } finally {
            setLoading(false);
            setSelectedReason(null);
            setDetails('');
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.modalContainer}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Şikayet Et</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color="#94a3b8" />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.subtitle}>Bu kullanıcıyı neden şikayet ediyorsunuz?</Text>

                    <View style={styles.reasonsContainer}>
                        {REASONS.map((reason) => (
                            <TouchableOpacity
                                key={reason.id}
                                style={[styles.reasonItem, selectedReason === reason.id && styles.selectedReason]}
                                onPress={() => setSelectedReason(reason.id)}
                            >
                                <View style={[styles.radio, selectedReason === reason.id && styles.selectedRadio]} />
                                <Text style={[styles.reasonText, selectedReason === reason.id && styles.selectedReasonText]}>
                                    {reason.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <TextInput
                        style={styles.input}
                        placeholder="Ek bilgiler (isteğe bağlı)..."
                        placeholderTextColor="#64748b"
                        multiline
                        numberOfLines={3}
                        value={details}
                        onChangeText={setDetails}
                    />

                    <TouchableOpacity onPress={handleSubmit} disabled={loading}>
                        <LinearGradient
                            colors={['#ef4444', '#b91c1c']}
                            style={styles.submitBtn}
                        >
                            {loading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text style={styles.submitBtnText}>Şikayet Gönder</Text>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContainer: { width: '100%', backgroundColor: '#1e293b', borderRadius: 20, padding: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    title: { color: 'white', fontSize: 20, fontWeight: 'bold' },
    subtitle: { color: '#cbd5e1', marginBottom: 15 },
    reasonsContainer: { gap: 10, marginBottom: 20 },
    reasonItem: { flexDirection: 'row', alignItems: 'center', padding: 15, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, borderWidth: 1, borderColor: 'transparent' },
    selectedReason: { borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)' },
    radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#64748b', marginRight: 15 },
    selectedRadio: { borderColor: '#ef4444', backgroundColor: '#ef4444' },
    reasonText: { color: '#94a3b8', fontSize: 16 },
    selectedReasonText: { color: 'white', fontWeight: 'bold' },
    input: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: 15, color: 'white', minHeight: 80, textAlignVertical: 'top', marginBottom: 20 },
    submitBtn: { padding: 16, borderRadius: 12, alignItems: 'center' },
    submitBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});
