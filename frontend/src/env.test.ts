import { describe, it, expect } from 'vitest';
import { env } from './env';

describe('env configuration', () => {
  it('provides validated env object', () => {
    expect(env).toBeDefined();
    expect(typeof env.VITE_API_URL === 'string' || env.VITE_API_URL === undefined).toBe(true);
  });
});
