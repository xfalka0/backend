import React, { useEffect } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withDelay,
} from 'react-native-reanimated';
import SwipeableCard from './SwipeableCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CardStack = ({ profiles, onSwipeLeft, onSwipeRight }) => {
    const [currentIndex, setCurrentIndex] = React.useState(0);

    const handleSwipeLeft = (profile) => {
        setCurrentIndex((prev) => prev + 1);
        onSwipeLeft?.(profile);
    };

    const handleSwipeRight = (profile) => {
        setCurrentIndex((prev) => prev + 1);
        onSwipeRight?.(profile);
    };

    return (
        <View style={styles.container}>
            {profiles.slice(currentIndex, currentIndex + 3).map((profile, index) => {
                const isTop = index === 0;
                const scale = 1 - index * 0.05;
                const translateY = index * 10;

                return (
                    <CardStackItem
                        key={profile.id}
                        profile={profile}
                        index={index}
                        scale={scale}
                        translateY={translateY}
                        isTop={isTop}
                        onSwipeLeft={handleSwipeLeft}
                        onSwipeRight={handleSwipeRight}
                    />
                );
            })}
        </View>
    );
};

const CardStackItem = ({ profile, index, scale, translateY, isTop, onSwipeLeft, onSwipeRight }) => {
    const scaleValue = useSharedValue(scale);
    const translateYValue = useSharedValue(translateY);

    useEffect(() => {
        scaleValue.value = withDelay(
            index * 100,
            withSpring(scale, { damping: 15 })
        );
        translateYValue.value = withDelay(
            index * 100,
            withSpring(translateY, { damping: 15 })
        );
    }, [scale, translateY]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: scaleValue.value },
            { translateY: translateYValue.value },
        ],
    }));

    return (
        <Animated.View style={[styles.cardContainer, animatedStyle]}>
            <SwipeableCard
                profile={profile}
                isTop={isTop}
                onSwipeLeft={onSwipeLeft}
                onSwipeRight={onSwipeRight}
            />
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardContainer: {
        position: 'absolute',
        width: SCREEN_WIDTH - 40,
    },
});

export default CardStack;
