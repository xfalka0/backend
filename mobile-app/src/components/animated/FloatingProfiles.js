import React, { useEffect } from 'react';
import { View, StyleSheet, Image, Dimensions } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    Easing,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';

const { width, height } = Dimensions.get('window');

const PROFILES = [
    require('../../../assets/fake_profiles/p1.png'),
    require('../../../assets/fake_profiles/p2.png'),
    require('../../../assets/fake_profiles/p3.png'),
    require('../../../assets/fake_profiles/p4.png'),
    require('../../../assets/fake_profiles/p5.png'),
    require('../../../assets/fake_profiles/p6.png'),
    require('../../../assets/fake_profiles/p7.png'),
    require('../../../assets/fake_profiles/p8.png'),
];

const CARD_WIDTH = width * 0.4;
const CARD_HEIGHT = CARD_WIDTH * 1.3;
const GAP = 15;

const Column = React.memo(({ images, speed, reverse = false }) => {
    const SET_HEIGHT = images.length * (CARD_HEIGHT + GAP);
    const translateY = useSharedValue(reverse ? -SET_HEIGHT : 0);

    useEffect(() => {
        translateY.value = withRepeat(
            withTiming(reverse ? 0 : -SET_HEIGHT, {
                duration: speed,
                easing: Easing.linear,
            }),
            -1,
            false
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    // Duplicate images to create seamless loop (at least 2 sets)
    const displayImages = [...images, ...images, ...images];

    return (
        <Animated.View style={[styles.column, animatedStyle]}>
            {displayImages.map((img, index) => (
                <View key={index} style={styles.cardContainer}>
                    <Image source={img} style={styles.card} resizeMode="cover" />
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.05)' }]} />
                </View>
            ))}
        </Animated.View>
    );
});

export default function FloatingProfiles() {
    // Split profiles into three distinct sets for variety
    const col1 = [PROFILES[0], PROFILES[1], PROFILES[2]];
    const col2 = [PROFILES[3], PROFILES[4], PROFILES[5]];
    const col3 = [PROFILES[6], PROFILES[7], PROFILES[0]];

    return (
        <View style={styles.container}>
            <View style={styles.columnsWrapper}>
                <Column images={col1} speed={40000} reverse={false} />
                <Column images={col2} speed={35000} reverse={true} />
                <Column images={col3} speed={45000} reverse={false} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'transparent',
        overflow: 'hidden',
    },
    columnsWrapper: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
        transform: [{ rotate: '-10deg' }, { scale: 1.2 }], // Slight tilt for style
    },
    column: {
        gap: GAP,
    },
    cardContainer: {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    card: {
        width: '100%',
        height: '100%',
    },
});
