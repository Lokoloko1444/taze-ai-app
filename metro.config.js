const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Avoid Windows "spawn EPERM" by using worker threads instead of child processes.
config.transformer = config.transformer ?? {};
config.transformer.unstable_workerThreads = true;
config.maxWorkers = 1;

// Prefer browser/ESM entrypoints (fixes packages like `jspdf` whose `main` is Node-only).
config.resolver = config.resolver ?? {};
config.resolver.resolverMainFields = ['react-native', 'browser', 'module', 'main'];

// Allow imports like "@/components/foo", "app/foo", "components/foo", "constants/foo", "lib/foo", and the other project folders to resolve from the project root.
const projectRoot = path.resolve(__dirname);
config.resolver.alias = {
  '@': projectRoot,
  app: path.join(projectRoot, 'app'),
  assets: path.join(projectRoot, 'assets'),
  components: path.join(projectRoot, 'components'),
  constants: path.join(projectRoot, 'constants'),
  cloudflare: path.join(projectRoot, 'cloudflare'),
  hooks: path.join(projectRoot, 'hooks'),
  lib: path.join(projectRoot, 'lib'),
  scripts: path.join(projectRoot, 'scripts'),
  supabase: path.join(projectRoot, 'supabase'),
  types: path.join(projectRoot, 'types'),
};
config.resolver.extraNodeModules = {
  '@': projectRoot,
  app: path.join(projectRoot, 'app'),
  assets: path.join(projectRoot, 'assets'),
  components: path.join(projectRoot, 'components'),
  constants: path.join(projectRoot, 'constants'),
  cloudflare: path.join(projectRoot, 'cloudflare'),
  hooks: path.join(projectRoot, 'hooks'),
  lib: path.join(projectRoot, 'lib'),
  scripts: path.join(projectRoot, 'scripts'),
  supabase: path.join(projectRoot, 'supabase'),
  types: path.join(projectRoot, 'types'),
};

// Fallback resolver for the path aliases used by the app.
const { resolve } = require('metro-resolver');
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'jspdf') {
    return resolve(context, 'jspdf/dist/jspdf.es.min.js', platform);
  }
  if (moduleName.startsWith('@/')) {
    const withoutAlias = moduleName.replace(/^@\//, './');
    const absolutePath = path.join(projectRoot, withoutAlias);
    return resolve(context, absolutePath, platform);
  }
  if (moduleName === 'app' || moduleName.startsWith('app/')) {
    const absolutePath = path.join(projectRoot, moduleName);
    return resolve(context, absolutePath, platform);
  }
  if (moduleName === 'assets' || moduleName.startsWith('assets/')) {
    const absolutePath = path.join(projectRoot, moduleName);
    return resolve(context, absolutePath, platform);
  }
  if (moduleName === 'components' || moduleName.startsWith('components/')) {
    const absolutePath = path.join(projectRoot, moduleName);
    return resolve(context, absolutePath, platform);
  }
  if (moduleName === 'constants' || moduleName.startsWith('constants/')) {
    const absolutePath = path.join(projectRoot, moduleName);
    return resolve(context, absolutePath, platform);
  }
  if (moduleName === 'cloudflare' || moduleName.startsWith('cloudflare/')) {
    const absolutePath = path.join(projectRoot, moduleName);
    return resolve(context, absolutePath, platform);
  }
  if (moduleName === 'hooks' || moduleName.startsWith('hooks/')) {
    const absolutePath = path.join(projectRoot, moduleName);
    return resolve(context, absolutePath, platform);
  }
  if (moduleName === 'lib' || moduleName.startsWith('lib/')) {
    const absolutePath = path.join(projectRoot, moduleName);
    return resolve(context, absolutePath, platform);
  }
  if (moduleName === 'scripts' || moduleName.startsWith('scripts/')) {
    const absolutePath = path.join(projectRoot, moduleName);
    return resolve(context, absolutePath, platform);
  }
  if (moduleName === 'supabase' || moduleName.startsWith('supabase/')) {
    const absolutePath = path.join(projectRoot, moduleName);
    return resolve(context, absolutePath, platform);
  }
  if (moduleName === 'types' || moduleName.startsWith('types/')) {
    const absolutePath = path.join(projectRoot, moduleName);
    return resolve(context, absolutePath, platform);
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;
