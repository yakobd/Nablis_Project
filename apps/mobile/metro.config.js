const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

// The web app uses React 18 (hoisted to the root) while this app uses React 19
// (in apps/mobile/node_modules). Look in the app's own node_modules first so
// every package gets the mobile React, never the web one.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

config.resolver.disableHierarchicalLookup = true;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Force expo AppEntry to use local node_modules
  if (moduleName.includes('expo/AppEntry') || moduleName === '../../App') {
    return {
      filePath: path.resolve(projectRoot, 'node_modules/expo/AppEntry.js'),
      type: 'sourceFile',
    };
  }
  // Firebase's package "exports" map sends Metro to the browser build of
  // firebase/auth, which has no React Native persistence and fails with
  // "Component auth has not been registered yet". Resolve Firebase the classic
  // way (package.json "react-native" field) so Metro picks the React Native build.
  if (moduleName.startsWith('firebase/') || moduleName.startsWith('@firebase/')) {
    context = { ...context, unstable_enablePackageExports: false };
  }
  try {
    return context.resolveRequest(context, moduleName, platform);
  } catch (err) {
    // npm sometimes nests a package's own dependencies (e.g. expo ->
    // expo-modules-core) instead of hoisting them; fall back to normal
    // node_modules lookup for those.
    return context.resolveRequest({ ...context, disableHierarchicalLookup: false }, moduleName, platform);
  }
};

module.exports = config;
