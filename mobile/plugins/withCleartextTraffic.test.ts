import { describe, it, expect } from 'vitest';
import withCleartextTraffic from './withCleartextTraffic.cjs';

export interface AndroidManifestApp {
  $: Record<string, string>;
}

export interface AndroidManifestMod {
  manifest: {
    application?: AndroidManifestApp[];
  };
}

export interface CleartextTrafficPlugin {
  (config: unknown): unknown;
  applyCleartextTrafficToManifest: (manifest: AndroidManifestMod | null) => AndroidManifestMod | null;
}

const cleartextPlugin = withCleartextTraffic as unknown as CleartextTrafficPlugin;

interface ModConfig {
  mods?: {
    android?: {
      manifest?: (config: { modResults: AndroidManifestMod }) => Promise<{
        modResults: AndroidManifestMod;
      }>;
    };
  };
}

describe('withCleartextTraffic plugin', () => {
  it('should be defined and return config modifier', () => {
    expect(cleartextPlugin).toBeDefined();
    expect(typeof cleartextPlugin).toBe('function');
  });

  it('applyCleartextTrafficToManifest sets android:usesCleartextTraffic on application', () => {
    const manifest: AndroidManifestMod = {
      manifest: {
        application: [
          {
            $: {
              'android:name': '.MainApplication',
              'android:label': '@string/app_name',
            },
          },
        ],
      },
    };

    const updated = cleartextPlugin.applyCleartextTrafficToManifest(manifest);
    const appObj = updated?.manifest.application?.[0];
    expect(appObj?.$['android:usesCleartextTraffic']).toBe('true');
    expect(appObj?.$['android:name']).toBe('.MainApplication');
  });

  it('applyCleartextTrafficToManifest handles missing application array gracefully', () => {
    const emptyManifest: AndroidManifestMod = { manifest: {} };
    const res = cleartextPlugin.applyCleartextTrafficToManifest(emptyManifest);
    expect(res).toBe(emptyManifest);

    const nullManifest = null;
    expect(cleartextPlugin.applyCleartextTrafficToManifest(nullManifest)).toBeNull();
  });

  it('executes the full plugin with withAndroidManifest mod action', async () => {
    const config = {
      name: 'Portfolio',
      slug: 'portfolio',
    };

    const result = cleartextPlugin(config) as ModConfig;
    expect(result.mods?.android?.manifest).toBeDefined();

    const modConfig = {
      modResults: {
        manifest: {
          application: [
            {
              $: {
                'android:name': '.MainApplication',
              },
            },
          ],
        },
      },
    };

    const manifestRunner = result.mods?.android?.manifest;
    expect(manifestRunner).toBeDefined();
    if (manifestRunner) {
      const executed = await manifestRunner(modConfig);
      const appObj = executed.modResults.manifest.application?.[0];
      expect(appObj?.$['android:usesCleartextTraffic']).toBe('true');
    }
  });
});
