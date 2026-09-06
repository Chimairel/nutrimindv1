import { z } from 'zod';
import { assertProductionConfig } from '@/domain/production-config.policy';

const booleanFromString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const optionalUrl = z.union([z.literal(''), z.url()]).optional();

const runtimeEnvironmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(5000),
  TRUST_PROXY: booleanFromString,
  SMTP_VERIFY_ON_STARTUP: booleanFromString,
  API_DOCS_ENABLED: booleanFromString,
  FRONTEND_URL: optionalUrl.default('http://localhost:3000'),
  CORS_ORIGINS: z.string().default(''),
  DATABASE_URL: z.string().optional(),
  JWT_SECRET: z.string().optional(),
  JWT_REFRESH_SECRET: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  CLINICAL_POLICY_APPROVED_VERSION: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
});

export type RuntimeEnvironment = z.infer<typeof runtimeEnvironmentSchema> & {
  allowedCorsOrigins: readonly string[];
};

export function parseRuntimeEnvironment(source: NodeJS.ProcessEnv): RuntimeEnvironment {
  const result = runtimeEnvironmentSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Invalid runtime configuration: ${issues}`);
  }

  assertProductionConfig(source);
  const configuredOrigins = result.data.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
  const allowedCorsOrigins =
    configuredOrigins.length > 0
      ? configuredOrigins
      : result.data.NODE_ENV === 'production'
        ? []
        : ['http://localhost:3000', 'http://localhost:3001'];

  return Object.freeze({ ...result.data, allowedCorsOrigins: Object.freeze(allowedCorsOrigins) });
}

export const env = parseRuntimeEnvironment(process.env);
