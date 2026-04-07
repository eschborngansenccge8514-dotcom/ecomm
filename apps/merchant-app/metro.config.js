const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

// Find the project and workspace root
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo
config.watchFolders = [workspaceRoot];
// 2. Let Metro look for modules in the workspace/root node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Explicitly map problematic packages
config.resolver.extraNodeModules = {
  'scheduler': path.resolve(workspaceRoot, 'node_modules/scheduler'),
  '@project1/domain': path.resolve(workspaceRoot, 'packages/domain'),
  'react-dom/server.browser.js': path.resolve(projectRoot, 'node_modules/react-dom/server.browser.js'),
};

module.exports = withNativeWind(config, { input: './global.css' });
