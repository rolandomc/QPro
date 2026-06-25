const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Fuerza a Metro a usar el build ESM (dist/module) de @supabase/realtime-js
// en vez del build CJS (dist/main) que depende de 'ws' y módulos de Node.js
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ['browser', 'require', 'default'];

module.exports = config;
