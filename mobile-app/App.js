import { GestureHandlerRootView } from 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts, Outfit_800ExtraBold, Outfit_500Medium, Outfit_400Regular } from '@expo-google-fonts/outfit';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreenNative from 'expo-splash-screen';
import axios from 'axios';
import { API_URL } from './src/config';

// Keep the splash screen visible while we fetch resources
SplashScreenNative.preventAutoHideAsync().catch(() => {
    /* reloading the app might cause some errors here, safe to ignore */
});

// Theme & Context
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { AlertProvider } from './src/contexts/AlertContext';
import { InAppNotificationProvider } from './src/contexts/InAppNotificationContext';
import { StarterPackProvider } from './src/contexts/StarterPackContext';
import { PurchaseService } from './src/services/purchaseService';
import { NotificationService } from './src/services/notificationService';

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
import PurchaseInfoScreen from './src/screens/PurchaseInfoScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import InviteScreen from './src/screens/InviteScreen';
import WalletScreen from './src/screens/WalletScreen';
import MissionBoardScreen from './src/screens/MissionBoardScreen';
import AgencyDashboardScreen from './src/screens/AgencyDashboardScreen';
import AnimatedTabBar from './src/components/animated/AnimatedTabBar';
import { useAppStore } from './src/store/useAppStore';
import { trackPurchase } from './src/utils/analytics';
import { Settings } from 'react-native-fbsdk-next';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs({ route }) {
    const TEST_USER_ID = 'c917f7d6-cc44-4b04-8917-1dbbed0b1e9b';
    const paramsUser = route.params?.user;
    const user = paramsUser ? paramsUser : { id: TEST_USER_ID, name: 'Test Kullanıcı', hearts: 100 };

    // Read role dynamically from Zustand global store
    const role = useAppStore(state => state.role);
    const isOperator = role === 'operator';

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
            {isOperator && (
                <Tab.Screen
                    name="Görevler"
                    component={MissionBoardScreen}
                    initialParams={{ user }}
                    options={{ tabBarIconName: 'trophy' }}
                />
            )}
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
            <StarterPackProvider>
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
                    <Stack.Screen name="PurchaseInfo" component={PurchaseInfoScreen} />
                    <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
                    <Stack.Screen name="Invite" component={InviteScreen} />
                    <Stack.Screen name="Wallet" component={WalletScreen} />
                    <Stack.Screen name="AgencyDashboard" component={AgencyDashboardScreen} />
                </Stack.Navigator>
            </StarterPackProvider>
        </NavigationContainer>
    );
}

import { ChatProvider } from './src/contexts/ChatContext';

export default function App() {
    const [fontsLoaded] = useFonts({
        Outfit_800ExtraBold,
        Outfit_500Medium,
        Outfit_400Regular,
    });

    useEffect(() => {
        const setupServices = async () => {
            // 1. Initialize Facebook SDK (Isolated)
            try {
                const { Settings } = require('react-native-fbsdk-next');
                Settings.setAppID('1399067395595701');
                Settings.setClientToken('a6b6d6519806ed05c61e7b0aedf05787');
                Settings.initializeSDK();
                
                if (Platform.OS === 'ios') {
                    await Settings.setAdvertiserTrackingEnabled(true);
                }
                console.log('[App] Facebook SDK Initialized');
            } catch (fbErr) {
                console.warn('[App] Facebook SDK initialization failed (Normal in Expo Go):', fbErr.message);
            }

            // 2. Initialize Other Services
            try {
                // Frictionless Referral Matching
                const storedRef = await AsyncStorage.getItem('referralCode');
                if (!storedRef) {
                    try {
                        const matchRes = await axios.post(`${API_URL}/match`);
                        if (matchRes.data.match) {
                            await AsyncStorage.setItem('referralCode', matchRes.data.code);
                            console.log('[App] Referral Matched Automatically:', matchRes.data.code);
                        }
                    } catch (refErr) {
                        console.warn('[App] Referral match failed:', refErr.message);
                    }
                }

                const userData = await AsyncStorage.getItem('user');
                const user = userData ? JSON.parse(userData) : null;
                const appUserID = user?.id ? String(user.id) : null;
                
                // Initialize RevenueCat
                await PurchaseService.init(appUserID);
                
                // --- PUSH NOTIFICATIONS SETUP ---
                if (appUserID) {
                    const token = await NotificationService.registerForPushNotificationsAsync();
                    if (token) {
                        await NotificationService.updateServerToken(appUserID, token);
                    }
                }
            } catch (err) {
                console.warn('[App] Services setup failed:', err);
            }
        };
        setupServices();
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
                        <InAppNotificationProvider>
                            <ChatProvider>
                                <AppContent />
                            </ChatProvider>
                        </InAppNotificationProvider>
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
