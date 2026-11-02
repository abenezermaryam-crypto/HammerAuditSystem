const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// React Native 0.86 relocated asset registry to @react-native/assets-registry/registry
config.transformer.assetRegistryPath = '@react-native/assets-registry/registry';

// Ensure resolver alias for backwards compatibility
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'react-native/asset-registry': require.resolve('@react-native/assets-registry/registry'),
};

module.exports = config;
