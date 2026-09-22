import 'server-only';
import type { AuditAction, Prisma } from '@prisma/client';
import { db } from './db';
import type { Tx } from './db';

interface AuditInput {
  tenantId: string;
  userId?: string | null;
  storeId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  summary?: string;
  changes?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Upis u revizijski trag. Nikada ne ruši poslovnu transakciju —
 * greška se loguje, ali se ne propagira.
 */
export async function audit(input: AuditInput, tx: Tx = db) {
  try {
    await tx.auditLog.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId ?? null,
        storeId: input.storeId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        summary: input.summary ?? null,
        changes: input.changes ?? undefined,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch (error) {
    console.error('[audit] zapis nije uspio', error);
  }
}

/** Razlika dvaju objekata — samo promijenjena polja, za changes stupac. */
export function diff<T extends Record<string, unknown>>(before: T, after: Partial<T>) {
  const changes: Record<string, { before: unknown; after: unknown }> = {};
  for (const key of Object.keys(after)) {
    const b = before[key];
    const a = after[key];
    if (String(b) !== String(a)) changes[key] = { before: b ?? null, after: a ?? null };
  }
  return changes;
}
