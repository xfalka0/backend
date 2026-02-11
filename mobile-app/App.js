import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

// Theme & Context
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';

// Screens
import SplashScreen from './src/screens/SplashScreen';
import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';
import HomeScreen from './src/screens/HomeScreen';
import ChatScreen from './src/screens/ChatScreen';
import VideoCallScreen from './src/screens/VideoCallScreen';
import GenderScreen from './src/screens/GenderScreen';
import RelationshipScreen from './src/screens/RelationshipScreen';
import InterestsScreen from './src/screens/InterestsScreen';
import JobEducationScreen from './src/screens/JobEducationScreen';
import NameScreen from './src/screens/NameScreen';
import PhotoScreen from './src/screens/PhotoScreen';
import BioScreen from './src/screens/BioScreen';
import ThemeSelectionScreen from './src/screens/ThemeSelectionScreen';
import OperatorProfileScreen from './src/screens/OperatorProfileScreen';
import ExploreScreen from './src/screens/ExploreScreen';
import StoryScreen from './src/screens/StoryScreen';
import CreatePostScreen from './src/screens/CreatePostScreen';
import MessagesScreen from './src/screens/MessagesScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import ShopScreen from './src/screens/ShopScreen';
import VipDetailsScreen from './src/screens/VipDetailsScreen';
import VipScreen from './src/screens/VipScreen';
import VipFrameDemoScreen from './src/screens/VipFrameDemoScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';
import AuthScreen from './src/screens/AuthScreen';
import VoiceCallScreen from './src/screens/VoiceCallScreen';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AnimatedTabBar from './src/components/animated/AnimatedTabBar';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs({ route }) {
    const TEST_USER_ID = 'c917f7d6-cc44-4b04-8917-1dbbed0b1e9b'; // Valid UUID from DB
    const paramsUser = route.params?.user;
    const user = paramsUser ? { ...paramsUser, name: paramsUser.display_name || paramsUser.username || 'Kullanıcı' } : { id: TEST_USER_ID, name: 'Misafir', hearts: 0 };

    return (
        <Tab.Navigator
            tabBar={(props) => <AnimatedTabBar {...props} />}
            screenOptions={{
                headerShown: false,
            }}
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
            <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
            <Stack.Navigator
                initialRouteName="Splash"
                screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: theme.colors.background }
                }}
            >
                <Stack.Screen name="Splash" component={SplashScreen} />
                <Stack.Screen name="Welcome" component={WelcomeScreen} />
                <Stack.Screen name="Auth" component={AuthScreen} />
                <Stack.Screen name="Login" component={AuthScreen} />
                <Stack.Screen name="Signup" component={AuthScreen} />

                {/* Main App with Tabs */}
                <Stack.Screen name="Main" component={MainTabs} />

                {/* Secondary Screens */}
                <Stack.Screen
                    name="Chat"
                    component={ChatScreen}
                    options={{
                        headerShown: true,
                        title: '',
                        headerTransparent: true,
                        headerTintColor: theme.colors.text
                    }}
                />
                <Stack.Screen name="VideoCall" component={VideoCallScreen} />
                <Stack.Screen name="VoiceCall" component={VoiceCallScreen} />
                <Stack.Screen name="OperatorProfile" component={OperatorProfileScreen} />
                <Stack.Screen name="Story" component={StoryScreen} options={{ animation: 'fade' }} />
                <Stack.Screen name="CreatePost" component={CreatePostScreen} />
                <Stack.Screen name="Shop" component={ShopScreen} />
                <Stack.Screen name="VipDetails" component={VipDetailsScreen} />
                <Stack.Screen name="Vip" component={VipScreen} />
                <Stack.Screen name="VipFrameDemo" component={VipFrameDemoScreen} />
                <Stack.Screen name="Settings" component={SettingsScreen} />
                <Stack.Screen name="Onboarding" component={OnboardingScreen} />

                {/* Onboarding Flow */}
                <Stack.Screen name="Gender" component={GenderScreen} />
                <Stack.Screen name="Relationship" component={RelationshipScreen} />
                <Stack.Screen name="Interests" component={InterestsScreen} />
                <Stack.Screen name="JobEducation" component={JobEducationScreen} />
                <Stack.Screen name="Name" component={NameScreen} />
                <Stack.Screen name="Photo" component={PhotoScreen} />
                <Stack.Screen name="Bio" component={BioScreen} />
                <Stack.Screen name="ThemeSelection" component={ThemeSelectionScreen} />
            </Stack.Navigator>
        </NavigationContainer>
    );
}

import { AlertProvider } from './src/contexts/AlertContext';

// ... existing code ...

export default function App() {
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <ThemeProvider>
                <AlertProvider>
                    <AppContent />
                </AlertProvider>
            </ThemeProvider>
        </GestureHandlerRootView>
    );
}
