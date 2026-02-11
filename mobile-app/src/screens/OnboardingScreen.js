import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    Dimensions,
    TouchableOpacity,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    Image,
    ScrollView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
    FadeIn,
    FadeOut,
    SlideInRight,
    SlideOutLeft,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import { API_URL } from '../config';
import { COLORS, GRADIENTS } from '../theme';
import AuthBackground from '../components/animated/AuthBackground';
import GradientButton from '../components/ui/GradientButton';
import ModernAlert from '../components/ui/ModernAlert';

const { width, height } = Dimensions.get('window');

const STEPS = [
    { id: 'welcome', title: 'Hoş Geldin!', subtitle: 'Seni tanımak için sabırsızlanıyoruz.' },
    { id: 'name', title: 'Adın Nedir?', subtitle: 'Profilinde görünecek ismin.' },
    { id: 'gender', title: 'Cinsiyetin?', subtitle: 'Sana uygun eşleşmeler için.' },
    { id: 'relationship', title: 'Ne Arıyorsun?', subtitle: 'Birden fazla seçim yapabilirsin.' },
    { id: 'interests', title: 'İlgi Alanların?', subtitle: 'Ortak noktalar bulalım.' },
    { id: 'photo', title: 'Son Dokunuş', subtitle: 'Harika bir profil fotoğrafı seç.' }
];

const GENDER_OPTIONS = [
    { id: 'kadin', label: 'Kadın', icon: 'woman' },
    { id: 'erkek', label: 'Erkek', icon: 'man' },
    { id: 'diger', label: 'Diğer', icon: 'person' },
];

const RELATIONSHIP_OPTIONS = [
    { id: 'sohbet', label: 'Sohbet', icon: 'chatbubbles-outline' },
    { id: 'flort', label: 'Flört', icon: 'heart-outline' },
    { id: 'ciddi', label: 'Ciddi ilişki', icon: 'rose-outline' },
    { id: 'arkadaslik', label: 'Arkadaşlık', icon: 'people-outline' },
];

const INTERESTS_OPTIONS = [
    'Müzik', 'Spor', 'Seyahat', 'Sinema', 'Yemek', 'Dans', 'Oyun', 'Sanat', 'Kitap', 'Doğa'
];

export default function OnboardingScreen({ navigation, route }) {
    const { userId, token } = route.params || {};
    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(false);

    // Alert State
    const [alert, setAlert] = useState({ visible: false, title: '', message: '', type: 'info' });

    // Form State
    const [name, setName] = useState('');
    const [gender, setGender] = useState(null);
    const [relationship, setRelationship] = useState([]);
    const [interests, setInterests] = useState([]);
    const [photo, setPhoto] = useState(null);

    const progress = useSharedValue(0);

    const nextStep = () => {
        // Validation
        if (currentStep === 1 && !name.trim()) {
            setAlert({ visible: true, title: 'Uyarı', message: 'Lütfen adınızı girin.', type: 'warning' });
            return;
        }
        if (currentStep === 2 && !gender) {
            setAlert({ visible: true, title: 'Uyarı', message: 'Lütfen cinsiyetinizi seçin.', type: 'warning' });
            return;
        }

        if (currentStep < STEPS.length - 1) {
            setCurrentStep(prev => prev + 1);
            progress.value = withSpring((currentStep + 1) / (STEPS.length - 1));
        } else {
            handleComplete();
        }
    };

    const prevStep = () => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
            progress.value = withSpring((currentStep - 1) / (STEPS.length - 1));
        }
    };

    const handleComplete = async () => {
        setLoading(true);
        try {
            let photoUrl = '';
            if (photo) {
                const formData = new FormData();
                formData.append('photo', {
                    uri: photo,
                    name: 'photo.jpg',
                    type: 'image/jpeg',
                });
                const uploadRes = await axios.post(`${API_URL}/upload`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                photoUrl = uploadRes.data.url;

                await axios.post(`${API_URL}/moderation/submit`, {
                    userId,
                    type: 'avatar',
                    url: photoUrl
                });
            }

            // Update user profile
            const updateRes = await axios.put(`${API_URL}/users/${userId}/profile`, {
                display_name: name,
                name: name,
                gender,
                interests: JSON.stringify(interests),
                onboarding_completed: true,
                avatar_url: photoUrl || undefined
            });

            const updatedUser = updateRes.data;

            const userJson = await AsyncStorage.getItem('user');
            if (userJson) {
                const userData = { ...JSON.parse(userJson), ...updatedUser, onboarding_completed: true };
                await AsyncStorage.setItem('user', JSON.stringify(userData));
            }

            setAlert({
                visible: true,
                title: 'Başarılı',
                message: 'Profilin hazır! Aramıza hoş geldin.',
                type: 'success',
                onClose: () => {
                    setTimeout(() => {
                        navigation.replace('Main', { user: { ...updatedUser, token: token } });
                    }, 300);
                }
            });
        } catch (err) {
            console.error('Onboarding Error:', err);
            const errorData = err.response?.data;
            const errorMsg = errorData?.error || errorData?.message || err.message;
            const errorDetails = errorData?.details || '';
            const statusCode = err.response?.status || 'N/A';

            setAlert({
                visible: true,
                title: 'Hata',
                message: `Bilgiler kaydedilirken bir sorun oluştu.\n\n${errorMsg}\n${errorDetails ? `Detay: ${errorDetails}\n` : ''}Kod: ${statusCode}`,
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled) {
            setPhoto(result.assets[0].uri);
        }
    };

    const renderProgress = () => (
        <View style={styles.progressContainer}>
            {STEPS.map((_, index) => (
                <View
                    key={index}
                    style={[
                        styles.progressDot,
                        currentStep >= index && styles.progressDotActive,
                        currentStep === index && styles.progressDotCurrent
                    ]}
                />
            ))}
        </View>
    );

    const renderStepContent = () => {
        const step = STEPS[currentStep];

        return (
            <Animated.View
                key={step.id}
                entering={SlideInRight.duration(400)}
                exiting={FadeOut.duration(200)}
                style={styles.stepWrapper}
            >
                <View style={styles.textCenter}>
                    <Text style={styles.title}>{step.title}</Text>
                    <Text style={styles.subtitle}>{step.subtitle}</Text>
                </View>

                {step.id === 'welcome' && (
                    <View style={styles.welcomeContainer}>
                        <LinearGradient
                            colors={['#8b5cf6', '#ec4899']}
                            style={styles.welcomeIconCircle}
                        >
                            <Ionicons name="sparkles" size={50} color="white" />
                        </LinearGradient>
                        <Text style={styles.welcomeInfo}>Sadece birkaç adımda profilini oluşturalım.</Text>
                    </View>
                )}

                {step.id === 'name' && (
                    <View style={styles.inputStepContainer}>
                        <View style={styles.inputShadow}>
                            <TextInput
                                style={styles.textInput}
                                placeholder="Adınızı girin"
                                placeholderTextColor="rgba(255,255,255,0.2)"
                                value={name}
                                onChangeText={setName}
                                autoFocus
                                textAlign="center"
                                selectionColor="#8b5cf6"
                            />
                        </View>
                        <Animated.View entering={FadeIn.delay(600)} style={styles.inputHint}>
                            <Ionicons name="information-circle-outline" size={14} color="rgba(255,255,255,0.4)" />
                            <Text style={styles.hintText}>Profilinde herkes bu ismi görecek.</Text>
                        </Animated.View>
                    </View>
                )}

                {step.id === 'gender' && (
                    <View style={styles.optionsContainer}>
                        {GENDER_OPTIONS.map(opt => (
                            <TouchableOpacity
                                key={opt.id}
                                style={[styles.optionCard, gender === opt.id && styles.optionCardSelected]}
                                onPress={() => setGender(opt.id)}
                            >
                                <Ionicons name={opt.icon} size={32} color={gender === opt.id ? 'white' : '#94a3b8'} />
                                <Text style={[styles.optionText, gender === opt.id && styles.optionTextSelected]}>{opt.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {step.id === 'relationship' && (
                    <View style={styles.optionsContainer}>
                        {RELATIONSHIP_OPTIONS.map(opt => (
                            <TouchableOpacity
                                key={opt.id}
                                style={[styles.optionCard, relationship.includes(opt.id) && styles.optionCardSelected]}
                                onPress={() => {
                                    if (relationship.includes(opt.id)) {
                                        setRelationship(relationship.filter(i => i !== opt.id));
                                    } else {
                                        setRelationship([...relationship, opt.id]);
                                    }
                                }}
                            >
                                <Ionicons name={opt.icon} size={28} color={relationship.includes(opt.id) ? 'white' : '#94a3b8'} />
                                <Text style={[styles.optionText, relationship.includes(opt.id) && styles.optionTextSelected]}>{opt.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {step.id === 'interests' && (
                    <View style={{ height: 300 }}>
                        <ScrollView contentContainerStyle={styles.interestsGrid} showsVerticalScrollIndicator={false}>
                            {INTERESTS_OPTIONS.map(opt => (
                                <TouchableOpacity
                                    key={opt}
                                    style={[styles.chip, interests.includes(opt) && styles.chipSelected]}
                                    onPress={() => {
                                        if (interests.includes(opt)) {
                                            setInterests(interests.filter(i => i !== opt));
                                        } else {
                                            setInterests([...interests, opt]);
                                        }
                                    }}
                                >
                                    <Text style={[styles.chipText, interests.includes(opt) && styles.chipTextSelected]}>{opt}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {step.id === 'photo' && (
                    <View style={styles.photoContainer}>
                        <TouchableOpacity style={styles.photoPicker} onPress={pickImage}>
                            {photo ? (
                                <Image source={{ uri: photo }} style={styles.previewImage} />
                            ) : (
                                <View style={styles.photoPlaceholder}>
                                    <Ionicons name="camera" size={40} color="#64748b" />
                                    <Text style={styles.photoPlaceholderText}>Fotoğraf Seç</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>
                )}
            </Animated.View>
        );
    };

    const isStepValid = () => {
        const step = STEPS[currentStep];
        if (step.id === 'name') return name.trim().length > 1;
        if (step.id === 'gender') return gender !== null;
        if (step.id === 'relationship') return relationship.length > 0;
        if (step.id === 'interests') return interests.length >= 2;
        if (step.id === 'photo') return photo !== null;
        return true;
    };

    const isNextDisabled = () => {
        if (currentStep === 1) return !name.trim();
        if (currentStep === 2) return !gender;
        return false;
    };

    return (
        <View style={styles.container}>
            <AuthBackground hideCircles />

            <SafeAreaView style={{ flex: 1 }}>
                <View style={styles.header}>
                    {currentStep > 0 ? (
                        <TouchableOpacity onPress={prevStep} style={styles.backButton}>
                            <Ionicons name="chevron-back" size={28} color="white" />
                        </TouchableOpacity>
                    ) : (
                        <View style={{ width: 40 }} />
                    )}
                    {renderProgress()}
                    <View style={{ width: 40 }} />
                </View>

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.content}
                >
                    {renderStepContent()}
                </KeyboardAvoidingView>

                <View style={styles.footer}>
                    <GradientButton
                        title={currentStep === STEPS.length - 1 ? 'TAMAMLA' : 'DEVAM ET'}
                        onPress={nextStep}
                        disabled={!isStepValid()}
                        loading={loading}
                        style={styles.nextButton}
                    />
                </View>
            </SafeAreaView>

            <ModernAlert
                visible={alert.visible}
                title={alert.title}
                message={alert.message}
                type={alert.type}
                onClose={() => {
                    if (alert.onClose) alert.onClose();
                    setAlert({ ...alert, visible: false });
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#030712' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 10 : 30,
        height: 80
    },
    backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    progressContainer: { flexDirection: 'row', gap: 6 },
    progressDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.1)' },
    progressDotActive: { backgroundColor: '#8b5cf6' },
    progressDotCurrent: { width: 20, backgroundColor: '#8b5cf6' },
    content: { flex: 1, paddingHorizontal: 25, justifyContent: 'center' },
    stepWrapper: { width: '100%', alignItems: 'center' },
    textCenter: { alignItems: 'center', marginBottom: 50 },
    title: { fontSize: 38, fontWeight: '900', color: 'white', marginBottom: 16, textAlign: 'center', letterSpacing: -1.5 },
    subtitle: { fontSize: 17, color: 'rgba(255,255,255,0.4)', textAlign: 'center', fontWeight: '500', lineHeight: 24, paddingHorizontal: 20 },
    welcomeContainer: { alignItems: 'center', gap: 35 },
    welcomeIconCircle: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', elevation: 20, shadowColor: '#8b5cf6', shadowOffset: { width: 0, height: 15 }, shadowOpacity: 0.6, shadowRadius: 25 },
    welcomeInfo: { color: 'rgba(255,255,255,0.5)', fontSize: 18, textAlign: 'center', lineHeight: 26, paddingHorizontal: 15, fontWeight: '400' },
    inputStepContainer: { width: '100%', alignItems: 'center' },
    inputShadow: {
        width: '100%',
        borderRadius: 28,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.08)',
        shadowColor: '#8b5cf6',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        overflow: 'hidden'
    },
    textInput: {
        padding: 24,
        color: 'white',
        fontSize: 32,
        fontWeight: '800',
        letterSpacing: -0.5
    },
    inputHint: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 15, opacity: 0.8 },
    hintText: { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: '500' },
    optionsContainer: { gap: 14, width: '100%' },
    optionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 24,
        padding: 22,
        gap: 18,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.06)'
    },
    optionCardSelected: {
        backgroundColor: 'rgba(139, 92, 246, 0.2)',
        borderColor: '#8b5cf6'
    },
    optionText: { fontSize: 19, color: 'rgba(255,255,255,0.5)', fontWeight: '700' },
    optionTextSelected: { color: 'white' },
    interestsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 20, justifyContent: 'center' },
    chip: {
        paddingHorizontal: 22,
        paddingVertical: 14,
        borderRadius: 35,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.06)'
    },
    chipSelected: { backgroundColor: 'rgba(139, 92, 246, 0.2)', borderColor: '#8b5cf6' },
    chipText: { color: 'rgba(255,255,255,0.5)', fontWeight: '700', fontSize: 15 },
    chipTextSelected: { color: 'white' },
    photoContainer: { alignItems: 'center' },
    photoPicker: {
        width: 240,
        height: 240,
        borderRadius: 120,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.08)',
        borderStyle: 'dashed',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#8b5cf6',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20
    },
    previewImage: { width: '100%', height: '100%' },
    photoPlaceholder: { alignItems: 'center', gap: 15 },
    photoPlaceholderText: { color: 'rgba(255,255,255,0.3)', fontSize: 17, fontWeight: '600' },
    footer: { padding: 30, paddingBottom: Platform.OS === 'ios' ? 40 : 30 },
    nextButton: { height: 68, borderRadius: 34, shadowColor: '#8b5cf6', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 15, elevation: 10 }
});
