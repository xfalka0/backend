import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { height } = Dimensions.get('window');

export default function FilterModal({ visible, onClose, onApply, currentFilters, theme }) {
    const [ageGroup, setAgeGroup] = useState(currentFilters.ageGroup || 'all');

    const handleApply = () => {
        onApply({ gender: currentFilters.gender || 'all', ageGroup });
        onClose();
    };

    const handleReset = () => {
        setAgeGroup('all');
    };

    const ageOptions = [
        { id: 'all', label: 'Tümü' },
        { id: '18-24', label: '18-24' },
        { id: '25-34', label: '25-34' },
        { id: '35-44', label: '35-44' },
        { id: '45+', label: '45+' }
    ];

    const renderPill = (option, selectedValue, onSelect) => {
        const isSelected = selectedValue === option.id;
        return (
            <TouchableOpacity 
                key={option.id}
                onPress={() => onSelect(option.id)}
                style={{ flex: 1, marginHorizontal: 4 }}
            >
                {isSelected ? (
                    <LinearGradient
                        colors={['#a855f7', '#ec4899']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.pillActive}
                    >
                        <Text style={styles.pillTextActive}>{option.label}</Text>
                    </LinearGradient>
                ) : (
                    <View style={[styles.pillInactive, { backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#f1f5f9' }]}>
                        <Text style={[styles.pillTextInactive, { color: theme.mode === 'dark' ? '#94a3b8' : '#64748b' }]}>{option.label}</Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
                
                <View style={[styles.container, { backgroundColor: theme.mode === 'dark' ? '#1e1b4b' : '#ffffff' }]}>
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: theme.mode === 'dark' ? '#ffffff' : '#0f172a' }]}>Filtrele</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Ionicons name="close" size={24} color={theme.mode === 'dark' ? '#94a3b8' : '#64748b'} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.content}>
                        <Text style={[styles.sectionTitle, { color: theme.mode === 'dark' ? '#e2e8f0' : '#334155' }]}>Yaş Aralığı</Text>
                        <View style={styles.rowWrapper}>
                            {ageOptions.map(opt => (
                                <View key={opt.id} style={{ width: '33.33%', padding: 4 }}>
                                    {renderPill(opt, ageGroup, setAgeGroup)}
                                </View>
                            ))}
                        </View>
                    </ScrollView>

                    <View style={styles.footer}>
                        <TouchableOpacity onPress={handleReset} style={styles.resetBtn}>
                            <Text style={[styles.resetText, { color: theme.mode === 'dark' ? '#94a3b8' : '#64748b' }]}>Temizle</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity onPress={handleApply} style={{ flex: 1 }}>
                            <LinearGradient
                                colors={['#a855f7', '#ec4899']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.applyBtn}
                            >
                                <Text style={styles.applyText}>Uygula</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
    container: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 20,
        paddingBottom: 40,
        maxHeight: height * 0.7,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        marginBottom: 20,
    },
    title: { fontFamily: 'Outfit_800ExtraBold', fontSize: 20 },
    closeBtn: { padding: 4 },
    content: { paddingHorizontal: 20 },
    sectionTitle: { fontFamily: 'Outfit_500Medium', fontSize: 16, marginBottom: 12 },
    row: { flexDirection: 'row', justifyContent: 'space-between' },
    rowWrapper: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
    pillActive: { paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
    pillInactive: { paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
    pillTextActive: { color: 'white', fontFamily: 'Outfit_500Medium', fontSize: 14 },
    pillTextInactive: { fontFamily: 'Outfit_500Medium', fontSize: 14 },
    footer: {
        flexDirection: 'row',
        paddingHorizontal: 24,
        marginTop: 24,
        gap: 16,
    },
    resetBtn: {
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(148, 163, 184, 0.1)',
    },
    resetText: { fontFamily: 'Outfit_500Medium', fontSize: 16 },
    applyBtn: {
        paddingVertical: 16,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    applyText: { color: 'white', fontFamily: 'Outfit_800ExtraBold', fontSize: 16 },
});
