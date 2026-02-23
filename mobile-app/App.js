import { GestureHandlerRootView } from 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts, Outfit_800ExtraBold, Outfit_500Medium, Outfit_400Regular } from '@expo-google-fonts/outfit';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreenNative from 'expo-splash-screen';

// Keep the splash screen visible while we fetch resources
SplashScreenNative.preventAutoHideAsync().catch(() => {
    /* reloading the app might cause some errors here, safe to ignore */
});

// Theme & Context
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { AlertProvider } from './src/contexts/AlertContext';
import { PurchaseService } from './src/services/purchaseService';

// Screens
import HomeScreen from './src/screens/HomeScreen';
import ExploreScreen from './src/screens/ExploreScreen';
import MessagesScreen from './src/screens/MessagesScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import OperatorProfileScreen from './src/screens/OperatorProfileScreen';
import ChatScreen from './src/screens/ChatScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import VipScreen from './src/screens/VipScreen';
import VipDetailsScreen from './src/screens/VipDetailsScreen';
import ShopScreen from './src/screens/ShopScreen';
import FavoritesScreen from './src/screens/FavoritesScreen';
import WhoFavoritedMeScreen from './src/screens/WhoFavoritedMeScreen';
import ProfileVisitorsScreen from './src/screens/ProfileVisitorsScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import LegalScreen from './src/screens/LegalScreen';
import VipProgressionScreen from './src/screens/VipProgressionScreen';
import VipFrameDemoScreen from './src/screens/VipFrameDemoScreen';
import ThemeSelectionScreen from './src/screens/ThemeSelectionScreen';
import StoryScreen from './src/screens/StoryScreen';
import VoiceCallScreen from './src/screens/VoiceCallScreen';
import VideoCallScreen from './src/screens/VideoCallScreen';
import CreatePostScreen from './src/screens/CreatePostScreen';
import AuthScreen from './src/screens/AuthScreen';
import SplashScreen from './src/screens/SplashScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';

import AnimatedTabBar from './src/components/animated/AnimatedTabBar';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs({ route }) {
    const TEST_USER_ID = 'c917f7d6-cc44-4b04-8917-1dbbed0b1e9b';
    const paramsUser = route.params?.user;
    const user = paramsUser ? paramsUser : { id: TEST_USER_ID, name: 'Test Kullanıcı', hearts: 100 };

    return (
        <Tab.Navigator
            tabBar={props => <AnimatedTabBar {...props} />}
            screenOptions={{ headerShown: false }}
        >
            <Tab.Screen
                name="Ana Sayfa"
                component={HomeScreen}
                initialParams={{ user }}
                options={{ tabBarIconName: 'home' }}
            />
            <Tab.Screen
                name="Keşfet"
                component={ExploreScreen}
                initialParams={{ user }}
                options={{ tabBarIconName: 'compass' }}
            />
            <Tab.Screen
                name="Sohbet"
                component={MessagesScreen}
                initialParams={{ user }}
                options={{ tabBarIconName: 'chatbubbles' }}
            />
            <Tab.Screen
                name="Profil"
                component={ProfileScreen}
                initialParams={{ user }}
                options={{ tabBarIconName: 'person' }}
            />
        </Tab.Navigator>
    );
}

function AppContent() {
    const { theme, themeMode } = useTheme();

    return (
        <NavigationContainer>
            <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} translucent backgroundColor="transparent" />
            <Stack.Navigator
                initialRouteName="Splash"
                screenOptions={{
                    headerShown: false,
                    animation: 'none',
                    contentStyle: { backgroundColor: theme.colors.background }
                }}
            >
                <Stack.Screen name="Main" component={MainTabs} />
                <Stack.Screen name="OperatorProfile" component={OperatorProfileScreen} />
                <Stack.Screen name="Chat" component={ChatScreen} />
                <Stack.Screen name="Settings" component={SettingsScreen} />
                <Stack.Screen name="Vip" component={VipScreen} />
                <Stack.Screen name="VipDetails" component={VipDetailsScreen} />
                <Stack.Screen name="Shop" component={ShopScreen} />
                <Stack.Screen name="Favorites" component={FavoritesScreen} />
                <Stack.Screen name="WhoFavoritedMe" component={WhoFavoritedMeScreen} />
                <Stack.Screen name="ProfileVisitors" component={ProfileVisitorsScreen} />
                <Stack.Screen name="Notifications" component={NotificationsScreen} />
                <Stack.Screen name="Legal" component={LegalScreen} />
                <Stack.Screen name="VipProgression" component={VipProgressionScreen} />
                <Stack.Screen name="VipFrameDemo" component={VipFrameDemoScreen} />
                <Stack.Screen name="ThemeSelection" component={ThemeSelectionScreen} />
                <Stack.Screen name="Story" component={StoryScreen} />
                <Stack.Screen name="VoiceCall" component={VoiceCallScreen} />
                <Stack.Screen name="VideoCall" component={VideoCallScreen} />
                <Stack.Screen name="CreatePost" component={CreatePostScreen} />
                <Stack.Screen name="Auth" component={AuthScreen} />
                <Stack.Screen name="Splash" component={SplashScreen} />
                <Stack.Screen name="Welcome" component={WelcomeScreen} />
                <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            </Stack.Navigator>
        </NavigationContainer>
    );
}

export default function App() {
    const [fontsLoaded] = useFonts({
        Outfit_800ExtraBold,
        Outfit_500Medium,
        Outfit_400Regular,
    });

    useEffect(() => {
        const setupPurchases = async () => {
            try {
                const userData = await AsyncStorage.getItem('user');
                const user = userData ? JSON.parse(userData) : null;
                const appUserID = user?.id ? String(user.id) : null;
                await PurchaseService.init(appUserID);
            } catch (err) {
                console.warn('[App] Purchase setup failed:', err);
            }
        };
        setupPurchases();
    }, []);

    useEffect(() => {
        if (fontsLoaded) {
            SplashScreenNative.hideAsync().catch(() => { });
        }
    }, [fontsLoaded]);

    if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: '#ffffff' }} />;

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
                <ThemeProvider>
                    <AlertProvider>
                        <AppContent />
                    </AlertProvider>
                </ThemeProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    }
});
