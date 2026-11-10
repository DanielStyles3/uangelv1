// The affiliate app's own Metro config. Without this file, tools walk up to the shopping
// app's metro.config.js in the repo root (NativeWind + Sentry), which this app doesn't use.
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
