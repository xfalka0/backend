// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure .ts and .tsx files are resolved even in node_modules
config.resolver.sourceExts = [...config.resolver.sourceExts, 'ts', 'tsx'];

// Redirect react-native-agora to its compiled commonjs version to avoid raw TypeScript compilation errors in Metro
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-native-agora') {
    return context.resolveRequest(
      context,
      'react-native-agora/lib/commonjs/index',
      platform
    );
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
