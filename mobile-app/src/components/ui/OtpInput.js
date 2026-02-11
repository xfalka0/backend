import React, { useRef, useState } from 'react';
import { View, TextInput, StyleSheet, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withRepeat,
    withSequence,
    withTiming
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');
const SLOT_SIZE = (width - 100) / 6;

export default function OtpInput({ length = 6, value, onChangeText }) {
    const inputs = useRef([]);
    const [focusedIndex, setFocusedIndex] = useState(0);

    const handleChangeText = (text, index) => {
        const newValue = value.split('');
        newValue[index] = text;
        const finalValue = newValue.join('');
        onChangeText(finalValue);

        if (text && index < length - 1) {
            inputs.current[index + 1].focus();
        }
    };

    const handleKeyPress = (e, index) => {
        if (e.nativeEvent.key === 'Backspace' && !value[index] && index > 0) {
            inputs.current[index - 1].focus();
        }
    };

    return (
        <View style={styles.container}>
            {Array.from({ length }).map((_, i) => (
                <View key={i} style={[
                    styles.slot,
                    focusedIndex === i && styles.focusedSlot
                ]}>
                    <BlurView intensity={20} style={styles.blur}>
                        <TextInput
                            ref={(ref) => (inputs.current[i] = ref)}
                            style={styles.input}
                            maxLength={1}
                            keyboardType="number-pad"
                            onChangeText={(text) => handleChangeText(text, i)}
                            onKeyPress={(e) => handleKeyPress(e, i)}
                            onFocus={() => setFocusedIndex(i)}
                            value={value[i] || ''}
                            textAlign="center"
                            placeholderTextColor="rgba(255,255,255,0.2)"
                            placeholder="-"
                        />
                    </BlurView>
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 30,
    },
    slot: {
        width: SLOT_SIZE,
        height: SLOT_SIZE + 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(255,255,255,0.05)',
        overflow: 'hidden',
    },
    focusedSlot: {
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
    },
    blur: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    input: {
        color: 'white',
        fontSize: 24,
        fontWeight: 'bold',
        width: '100%',
    },
});
