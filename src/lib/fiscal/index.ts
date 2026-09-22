import 'server-only';
import { env } from '../env';
import { HrDemoFiscalAdapter, HrProductionFiscalAdapter, NoopFiscalAdapter } from './adapters';
import type { FiscalAdapter } from './types';

let cached: FiscalAdapter | null = null;

/** Vraća adapter prema konfiguraciji okoline (FISCAL_ADAPTER). */
export function fiscalAdapter(): FiscalAdapter {
  if (cached) return cached;
  const config = env();

  switch (config.FISCAL_ADAPTER) {
    case 'hr-demo':
      cached = new HrDemoFiscalAdapter();
      break;
    case 'hr-production':
      cached = new HrProductionFiscalAdapter({
        endpoint: config.FISCAL_ENDPOINT ?? '',
        certPath: config.FISCAL_CERT_PATH ?? '',
        certPassword: config.FISCAL_CERT_PASSWORD ?? '',
      });
      break;
    default:
      cached = new NoopFiscalAdapter();
  }
  return cached;
}

export * from './types';
export { buildQrUrl, formatFiscalDateTime } from './adapters';
