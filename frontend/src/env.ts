import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

/**
 * Validated schema for frontend client-side environment variables using @t3-oss/env-core and Zod.
 * Enforces strong typing and validates environment variables at build and run time.
 */
export const env = createEnv({
  clientPrefix: 'VITE_',
  client: {
    // Allows empty string, relative URLs (for production Nginx proxying), or absolute URLs
    VITE_API_URL: z.string().optional(),
  },
  shared: {
    MODE: z.string().optional(),
    DEV: z.boolean().optional(),
    PROD: z.boolean().optional(),
  },
  runtimeEnv: import.meta.env,
  emptyStringAsUndefined: true,
});
