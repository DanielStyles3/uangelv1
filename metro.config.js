const { withNativeWind } = require('nativewind/metro');
const {
  getSentryExpoConfig
} = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname)

// @sentry/react-native optionally requires this internal expo-router file (inside a
// try/catch) to tag events with the current route. expo-router 58 no longer ships it,
// so Metro logs an "invalid package.json configuration" warning on every resolve.
// Resolving it to an empty module gives Sentry the same `null` fallback, minus the noise.
const SENTRY_EXPO_ROUTER_STORE = 'expo-router/build/global-state/router-store';
const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === SENTRY_EXPO_ROUTER_STORE) return { type: 'empty' };
  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './app/globals.css' })
