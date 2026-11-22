import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

/**
 * Validated schema for mobile Expo environment variables using @t3-oss/env-core and Zod.
 * Enforces strong typing and validates environment variables at build and run time.
 */
export const env = createEnv({
  clientPrefix: 'EXPO_PUBLIC_',
  client: {
    EXPO_PUBLIC_API_URL: z.string().optional(),
    EXPO_PUBLIC_ENV: z.enum(['development', 'staging', 'production', 'test']).optional(),
  },
  shared: {
    NODE_ENV: z.enum(['development', 'production', 'test']).optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
