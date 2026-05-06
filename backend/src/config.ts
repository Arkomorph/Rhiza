import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // PostgreSQL
  PG_HOST: z.string().default('localhost'),
  PG_PORT: z.coerce.number().default(5432),
  PG_USER: z.string().default('rhiza'),
  PG_PASSWORD: z.string().default(''),
  PG_DB: z.string().default('rhiza'),

  // Neo4j
  NEO4J_URI: z.string().default('bolt://localhost:7687'),
  NEO4J_USER: z.string().default('neo4j'),
  NEO4J_PASSWORD: z.string().default(''),

  // JWT
  JWT_SECRET: z.string().min(32).default('dev-secret-change-me-in-production!!'),
  JWT_ACCESS_TTL: z.coerce.number().default(900),      // 15 min
  JWT_REFRESH_TTL: z.coerce.number().default(604800),   // 7 jours

  // CORS
  FRONTEND_ORIGIN: z.string().default('http://localhost:5173'),

  // Logs endpoint
  LOGS_TOKEN: z.string().min(16).default('dev-logs-token-change-me!!'),
  LOGS_BUFFER_SIZE: z.coerce.number().default(1000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const config = Object.freeze(parsed.data);
export type Config = z.infer<typeof envSchema>;
