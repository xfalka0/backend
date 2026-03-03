import { View, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';

export default function GlassCard({ children, style, intensity = 20, tint = "default", noBorder = false, ...props }) {
    const { theme, themeMode } = useTheme();
    const isAndroid = Platform.OS === 'android';

    // Determine the blur tint based on theme
    const resolvedTint = tint === "default" ? (themeMode === 'dark' ? 'dark' : 'light') : tint;

    // Flatten the style to extract borderRadius if provided
    const flatStyle = StyleSheet.flatten(style) || {};
    const radius = flatStyle.borderRadius !== undefined ? flatStyle.borderRadius : 24;

    return (
        <View style={[{ backgroundColor: 'transparent', overflow: 'hidden' }, style]} {...props}>
            {/* Absolute Background Layer */}
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden', borderWidth: noBorder ? 0 : 1, borderColor: theme.colors.glassBorder }]}>
                {!isAndroid && <BlurView intensity={intensity} tint={resolvedTint} style={StyleSheet.absoluteFill} />}
                <LinearGradient
                    colors={
                        themeMode === 'dark'
                            ? [isAndroid ? 'rgba(30, 25, 60, 0.95)' : 'rgba(26, 20, 53, 0.4)', isAndroid ? 'rgba(15, 10, 40, 0.98)' : 'rgba(17, 12, 36, 0.6)']
                            : [isAndroid ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.6)', isAndroid ? 'rgba(245, 245, 245, 0.98)' : 'rgba(240, 240, 240, 0.8)']
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                />
            </View>

            {/* Content directly inside container to inherit layout */}
            {children}
        </View>
    );
}

const styles = StyleSheet.create({});
