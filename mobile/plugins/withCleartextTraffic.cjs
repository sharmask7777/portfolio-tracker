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
 * Mutates AndroidManifest XML object to add package queries for browser visibility.
 * Ensures Linking.openURL / canOpenURL can resolve browser intents on Android 11+.
 *
 * @param {any} androidManifest
 * @returns {any}
 */
const applyPackageQueriesToManifest = (androidManifest) => {
  if (!androidManifest?.manifest) {
    return androidManifest;
  }
  if (!androidManifest.manifest.queries) {
    androidManifest.manifest.queries = [];
  }
  const queries = androidManifest.manifest.queries;
  const browserPackages = [
    'com.android.chrome',
    'org.mozilla.firefox',
    'com.sec.android.app.sbrowser',
    'com.brave.browser',
    'com.opera.browser',
    'com.microsoft.emmx',
    'com.duckduckgo.mobile.android',
  ];

  if (queries.length === 0) {
    queries.push({
      intent: [
        { action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }], data: [{ $: { 'android:scheme': 'https' } }] },
        { action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }], data: [{ $: { 'android:scheme': 'http' } }] },
      ],
      package: browserPackages.map((pkg) => ({ $: { 'android:name': pkg } })),
    });
  } else {
    const existingPackages = queries[0].package || [];
    const packagesToAdd = browserPackages.filter(
      (pkg) => !existingPackages.some((p) => p.$?.['android:name'] === pkg)
    );
    queries[0].package = [
      ...existingPackages,
      ...packagesToAdd.map((pkg) => ({ $: { 'android:name': pkg } })),
    ];
  }
  return androidManifest;
};

/**
 * Expo config plugin to permit cleartext HTTP traffic and register browser queries.
 *
 * @type {import('expo/config-plugins').ConfigPlugin}
 */
const withCleartextTraffic = (config) => {
  return withAndroidManifest(config, (modConfig) => {
    applyCleartextTrafficToManifest(modConfig.modResults);
    applyPackageQueriesToManifest(modConfig.modResults);
    return modConfig;
  });
};

withCleartextTraffic.applyCleartextTrafficToManifest = applyCleartextTrafficToManifest;
withCleartextTraffic.applyPackageQueriesToManifest = applyPackageQueriesToManifest;

module.exports = withCleartextTraffic;
