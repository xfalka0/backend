import { View, Text, StyleSheet, Dimensions } from 'react-native';
import FloatingParticles from './FloatingParticles';
import PremiumCoinCard from './PremiumCoinCard';
import DestinyHero from '../DestinyHero';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const HeroSection = ({ onCoinPress, onExplorePress, onResellerPress, onDestinyPress }) => {
    const insets = useSafeAreaInsets();

    return (
        <View style={styles.container}>
            <FloatingParticles />
            <View style={[styles.content, { paddingTop: insets.top + 10 }]}>
                <PremiumCoinCard
                    onCoinPress={onCoinPress}
                    onExplorePress={onExplorePress}
                    onResellerPress={onResellerPress}
                />
                <View style={styles.destinyContainer}>
                    <DestinyHero onPress={onDestinyPress} />
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: width,
        paddingBottom: 10,
        position: 'relative',
        overflow: 'hidden',
    },
    content: {
        paddingTop: 10,
        zIndex: 10,
    },
    destinyContainer: {
        marginTop: 10,
    }
});

export default HeroSection;
