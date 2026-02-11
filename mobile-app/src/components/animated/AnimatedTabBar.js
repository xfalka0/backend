import React, { useEffect } from 'react';
import { StyleSheet, View, Pressable, Dimensions } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const AnimatedTab = ({ state, descriptors, navigation }) => {
    return (
        <View style={styles.container}>
            <View style={styles.tabBar}>
                {state.routes.map((route, index) => {
                    const { options } = descriptors[route.key];
                    const isFocused = state.index === index;

                    const onPress = () => {
                        const event = navigation.emit({
                            type: 'tabPress',
                            target: route.key,
                            canPreventDefault: true,
                        });

                        if (!isFocused && !event.defaultPrevented) {
                            navigation.navigate(route.name);
                        }
                    };

                    return (
                        <TabItem
                            key={route.key}
                            isFocused={isFocused}
                            onPress={onPress}
                            icon={options.tabBarIconName || 'home'}
                        />
                    );
                })}
            </View>
        </View>
    );
};

const TabItem = ({ isFocused, onPress, icon }) => {
    const scale = useSharedValue(1);
    const dotOpacity = useSharedValue(0);

    useEffect(() => {
        scale.value = withSpring(isFocused ? 1.2 : 1, { damping: 10 });
        dotOpacity.value = withSpring(isFocused ? 1 : 0, { damping: 15 });
    }, [isFocused]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const dotStyle = useAnimatedStyle(() => ({
        opacity: dotOpacity.value,
        transform: [{ scale: dotOpacity.value }],
    }));

    return (
        <Pressable onPress={onPress} style={styles.tabItem}>
            <Animated.View style={animatedStyle}>
                <Ionicons
                    name={icon}
                    size={26}
                    color={isFocused ? '#EC4899' : 'rgba(255,255,255,0.4)'}
                />
            </Animated.View>
            <Animated.View style={[dotStyle]}>
                <LinearGradient
                    colors={['#8B5CF6', '#EC4899']}
                    style={styles.dot}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                />
            </Animated.View>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
        alignItems: 'center',
    },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        paddingVertical: 15,
        paddingHorizontal: 10,
        borderRadius: 30,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
        width: width - 40,
        justifyContent: 'space-around',
    },
    tabItem: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 50,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginTop: 4,
    },
});

export default AnimatedTab;
