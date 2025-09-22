import 'dotenv/config';
import { z } from 'zod';

/**
 * Environment is validated once, at startup, so a misconfigured deployment
 * fails immediately with a readable message rather than at the first request
 * that happens to need the missing value.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters; generate one with `openssl rand -hex 32`'),
  JWT_EXPIRES_IN: z.string().default('24h'),
  /** Comma-separated list of allowed browser origins. */
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:3000'),
  /** Largest single upload accepted, in bytes. */
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  /** Email domain that accounts must belong to. */
  ALLOWED_EMAIL_DOMAIN: z.string().default('bankofabyssinia.com'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  console.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

const raw = parsed.data;

export const config = {
  ...raw,
  isProduction: raw.NODE_ENV === 'production',
  isTest: raw.NODE_ENV === 'test',
  corsOrigins: raw.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
} as const;

export type Config = typeof config;
