import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

export default function RoomCardEqualizer() {
    const anim1 = useRef(new Animated.Value(6)).current;
    const anim2 = useRef(new Animated.Value(14)).current;
    const anim3 = useRef(new Animated.Value(8)).current;
    const anim4 = useRef(new Animated.Value(18)).current;

    useEffect(() => {
        const createLoop = (anim, toValue, duration) => {
            return Animated.loop(
                Animated.sequence([
                    Animated.timing(anim, { toValue, duration, useNativeDriver: false }),
                    Animated.timing(anim, { toValue: 4, duration, useNativeDriver: false })
                ])
            );
        };

        const l1 = createLoop(anim1, 16, 450);
        const l2 = createLoop(anim2, 6, 380);
        const l3 = createLoop(anim3, 18, 520);
        const l4 = createLoop(anim4, 8, 410);

        l1.start();
        l2.start();
        l3.start();
        l4.start();

        return () => {
            l1.stop();
            l2.stop();
            l3.stop();
            l4.stop();
        };
    }, []);

    return (
        <View style={styles.container}>
            <Animated.View style={[styles.bar, { height: anim1 }]} />
            <Animated.View style={[styles.bar, { height: anim2, backgroundColor: '#00E5FF' }]} />
            <Animated.View style={[styles.bar, { height: anim3 }]} />
            <Animated.View style={[styles.bar, { height: anim4, backgroundColor: '#00E5FF' }]} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 2.5,
        height: 22,
        width: 20,
        justifyContent: 'center',
    },
    bar: {
        width: 2.5,
        backgroundColor: '#FF3F86',
        borderRadius: 1.5,
    },
});
