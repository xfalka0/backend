import { Platform } from 'react-native';

// Android Simulator uses 10.0.2.2 for localhost
// iOS Simulator uses localhost
// Use your LAN IP (e.g., 192.168.1.x) for physical devices
// Use your LAN IP (e.g., 192.168.1.x) for physical devices
// Production Server
// Production Server
// export const API_URL = 'https://backend-kj17.onrender.com/api';
// export const SOCKET_URL = 'https://backend-kj17.onrender.com';

// Local Development (Android Emulator)
export const API_URL = 'http://10.0.2.2:3000/api';
export const SOCKET_URL = 'http://10.0.2.2:3000';
