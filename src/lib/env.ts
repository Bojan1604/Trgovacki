/** Centralizirano čitanje i validacija okolinskih varijabli. */
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET mora imati barem 32 znaka'),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(12),
  APP_URL: z.string().default('http://localhost:3000'),
  DEFAULT_LOCALE: z.string().default('hr'),
  DEFAULT_CURRENCY: z.string().default('EUR'),
  FISCAL_ADAPTER: z.enum(['none', 'hr-demo', 'hr-production']).default('none'),
  FISCAL_ENDPOINT: z.string().optional(),
  FISCAL_CERT_PATH: z.string().optional(),
  FISCAL_CERT_PASSWORD: z.string().optional(),
});

let cached: z.infer<typeof schema> | null = null;

export function env() {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Neispravna konfiguracija okoline — ${issues}`);
  }
  cached = parsed.data;
  return cached;
}
