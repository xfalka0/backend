// Production vs Development environment detection
const IS_PROD = !__DEV__;

// Production Server
export const PROD_URL = 'https://backend-kj17.onrender.com';

// Local Development
// Android Simulator uses 10.0.2.2
// iOS Simulator uses localhost
const DEV_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';

export const BASE_URL = IS_PROD ? PROD_URL : DEV_URL;
export const API_URL = `${BASE_URL}/api`;
export const SOCKET_URL = BASE_URL;
