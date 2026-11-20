const { withAndroidManifest } = require('expo/config-plugins');

/**
 * Expo config plugin to permit cleartext HTTP traffic on Android.
 * Essential for connecting to self-hosted instances on local LAN or IP addresses
 * without requiring TLS certificates.
 *
 * @type {import('expo/config-plugins').ConfigPlugin}
 */
const withCleartextTraffic = (config) => {
  return withAndroidManifest(config, (modConfig) => {
    const androidManifest = modConfig.modResults;
    const application = androidManifest.manifest.application?.[0];

    if (application) {
      application.$['android:usesCleartextTraffic'] = 'true';
    }

    return modConfig;
  });
};

module.exports = withCleartextTraffic;
