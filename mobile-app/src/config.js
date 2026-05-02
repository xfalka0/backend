import { Platform } from 'react-native';

// API Configuration
export const BASE_URL = 'https://backend-kj17.onrender.com';
export const API_URL = `${BASE_URL}/api`;
export const SOCKET_URL = BASE_URL;

// Performance & Animations
export const PERFORMANCE = {
    reduceMotion: false,     // If true, most animations are disabled
    simpleAnimations: true,  // If true, uses simpler timing instead of heavy springs
    maxParticles: 6,         // Limit for particle systems
    disableBlur: Platform.OS === 'android', // Blur is heavy on Android
};

