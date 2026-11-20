const { withAndroidManifest } = require('expo/config-plugins');

/**
 * Mutates AndroidManifest XML object to set android:usesCleartextTraffic="true".
 *
 * @param {any} androidManifest
 * @returns {any}
 */
const applyCleartextTrafficToManifest = (androidManifest) => {
  const application = androidManifest?.manifest?.application?.[0];
  if (application && application.$) {
    application.$['android:usesCleartextTraffic'] = 'true';
  }
  return androidManifest;
};

/**
 * Expo config plugin to permit cleartext HTTP traffic on Android.
 * Essential for connecting to self-hosted instances on local LAN or IP addresses
 * without requiring TLS certificates.
 *
 * @type {import('expo/config-plugins').ConfigPlugin}
 */
const withCleartextTraffic = (config) => {
  return withAndroidManifest(config, (modConfig) => {
    applyCleartextTrafficToManifest(modConfig.modResults);
    return modConfig;
  });
};

withCleartextTraffic.applyCleartextTrafficToManifest = applyCleartextTrafficToManifest;

module.exports = withCleartextTraffic;
