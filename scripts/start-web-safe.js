#!/usr/bin/env node

/**
 * Expo 54 on this Windows setup can throw `spawn EPERM` when it tries to
 * auto-open the browser. We patch better-opn so this specific failure is
 * non-fatal and the dev server keeps running.
 */
const betterOpnPath = require.resolve('better-opn');
const originalBetterOpn = require(betterOpnPath);

function safeBetterOpn(...args) {
  try {
    return Promise.resolve(originalBetterOpn(...args)).catch((error) => {
      const message = String(error?.message ?? error ?? '');
      if (error?.code === 'EPERM' || message.includes('spawn EPERM')) {
        console.warn('[web-safe] Browser auto-open failed (spawn EPERM).');
        console.warn('[web-safe] Dev server keeps running. Open the URL manually in your browser.');
        return false;
      }
      throw error;
    });
  } catch (error) {
    const message = String(error?.message ?? error ?? '');
    if (error?.code === 'EPERM' || message.includes('spawn EPERM')) {
      console.warn('[web-safe] Browser auto-open failed (spawn EPERM).');
      console.warn('[web-safe] Dev server keeps running. Open the URL manually in your browser.');
      return Promise.resolve(false);
    }
    throw error;
  }
}

require.cache[betterOpnPath].exports = safeBetterOpn;

const { expoStart } = require('expo/node_modules/@expo/cli/build/src/start/index.js');
const args = process.argv.slice(2);

if (!process.env.BROWSER) {
  process.env.BROWSER = 'none';
}

if (!args.includes('--web') && !args.includes('-w')) {
  args.unshift('--web');
}

expoStart(args).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
