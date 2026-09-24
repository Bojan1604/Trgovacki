import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, accessibleStoreIds } from '@/lib/auth';
import { apiError } from '@/lib/api';
import { fiscalizeSale } from '@/lib/services/sales';
import { fiscalAdapter } from '@/lib/fiscal';
import { audit } from '@/lib/audit';

/** Koliko računa obrađujemo u jednom pozivu, da zahtjev ne visi predugo. */
const BATCH = 50;

/**
 * Ponovno slanje računa koji nisu fiskalizirani.
 *
 * Fiskalizacija je namjerno izvan transakcije naplate — prekid veze s poreznom
 * ne smije srušiti prodaju. Zato zaostali računi ostaju u redu i šalju se
 * ovom naredbom.
 */
export async function POST() {
  try {
    const user = await requirePermission('sale.view');

    if (!fiscalAdapter().requiresFiscalization) {
      return NextResponse.json(
        { error: 'Fiskalizacija nije uključena (FISCAL_ADAPTER=none).' },
        { status: 409 },
      );
    }

    const storeIds = await accessibleStoreIds(user);
    const pending = await db.sale.findMany({
      where: {
        tenantId: user.tenantId,
        storeId: { in: storeIds },
        fiscalStatus: { in: ['FAILED', 'PENDING'] },
      },
      orderBy: { issuedAt: 'asc' },
      take: BATCH,
      select: { id: true },
    });

    let sent = 0;
    let failed = 0;
    for (const sale of pending) {
      try {
        const result = await fiscalizeSale(sale.id);
        if (result?.ok) sent += 1;
        else failed += 1;
      } catch {
        failed += 1;
      }
    }

    const left = await db.sale.count({
      where: {
        tenantId: user.tenantId,
        storeId: { in: storeIds },
        fiscalStatus: { in: ['FAILED', 'PENDING'] },
      },
    });

    await audit({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'UPDATE',
      entityType: 'sale',
      entityId: 'fiscal-retry',
      summary: `Ponovno slanje fiskalizacije: ${sent} uspjelo, ${failed} nije, ${left} u redu`,
    });

    return NextResponse.json({ processed: pending.length, sent, failed, left });
  } catch (error) {
    return apiError(error);
  }
}
