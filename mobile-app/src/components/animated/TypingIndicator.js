import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Animated, Easing } from 'react-native';
import GlassCard from '../ui/GlassCard';
import { useScreenActive } from '../../utils/useScreenActive';

const Dot = ({ index, shouldAnimate }) => {
    const translateY = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (!shouldAnimate) {
            translateY.stopAnimation();
            translateY.setValue(0);
            return;
        }
        const anim = Animated.loop(
            Animated.sequence([
                Animated.timing(translateY, {
                    toValue: -6,
                    duration: 400,
                    useNativeDriver: true,
                    easing: Easing.ease,
                    delay: index * 200,
                }),
                Animated.timing(translateY, {
                    toValue: 0,
                    duration: 400,
                    useNativeDriver: true,
                    easing: Easing.ease,
                }),
            ])
        );
        anim.start();
        return () => {
            anim.stop();
        };
    }, [index, shouldAnimate, translateY]);

    return (
        <Animated.View style={[styles.dot, { transform: [{ translateY }] }]} />
    );
};

const TypingIndicator = () => {
    const { shouldAnimate } = useScreenActive();
    return (
        <View style={{ marginLeft: 16, marginBottom: 8, alignSelf: 'flex-start' }}>
            <GlassCard intensity={30} tint="dark" style={styles.container}>
                <Dot index={0} shouldAnimate={shouldAnimate} />
                <Dot index={1} shouldAnimate={shouldAnimate} />
                <Dot index={2} shouldAnimate={shouldAnimate} />
            </GlassCard>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 20,
        gap: 6,
    },
    dot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: '#fff',
        opacity: 0.6,
        marginHorizontal: 1,
    },
});

export default TypingIndicator;
