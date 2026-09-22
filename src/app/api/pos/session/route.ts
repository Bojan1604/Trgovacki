import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { assertStoreAccess, requirePermission } from '@/lib/auth';
import { apiError } from '@/lib/api';
import { toNumber } from '@/lib/money';

/** Kontekst blagajne: poslovnica, uređaji, otvorena smjena i načini plaćanja. */
export async function GET(request: Request) {
  try {
    const user = await requirePermission('pos.operate');
    const url = new URL(request.url);
    const storeId = url.searchParams.get('storeId') ?? user.activeStoreId;
    if (!storeId) return NextResponse.json({ error: 'Nije odabrana poslovnica.' }, { status: 400 });
    await assertStoreAccess(user, storeId);

    const [store, paymentMethods, openShift, parked] = await Promise.all([
      db.store.findFirst({
        where: { id: storeId, tenantId: user.tenantId },
        include: {
          company: { select: { legalName: true, vatId: true, addressLine: true, city: true, invoiceFooter: true } },
          registers: { where: { isActive: true }, orderBy: { code: 'asc' } },
        },
      }),
      db.paymentMethod.findMany({
        where: { tenantId: user.tenantId, isActive: true },
        orderBy: { sortOrder: 'asc' },
      }),
      db.shift.findFirst({
        where: { storeId, userId: user.id, status: 'OPEN' },
        include: { register: { select: { id: true, code: true, name: true } } },
      }),
      db.sale.findMany({
        where: { storeId, status: 'SUSPENDED' },
        select: { id: true, number: true, total: true, issuedAt: true, note: true, _count: { select: { lines: true } } },
        orderBy: { issuedAt: 'desc' },
        take: 20,
      }),
    ]);

    if (!store) return NextResponse.json({ error: 'Poslovnica ne postoji.' }, { status: 404 });

    return NextResponse.json({
      store: {
        id: store.id,
        code: store.code,
        name: store.name,
        city: store.city,
        company: store.company,
        allowNegativeStock: store.allowNegativeStock,
        fiscalEnabled: store.fiscalEnabled,
      },
      registers: store.registers.map((r) => ({ id: r.id, code: r.code, name: r.name })),
      paymentMethods: paymentMethods.map((m) => ({
        id: m.id, code: m.code, name: m.name, type: m.type,
        opensDrawer: m.opensDrawer, allowsChange: m.allowsChange, requiresRef: m.requiresRef,
      })),
      shift: openShift
        ? {
            id: openShift.id,
            number: openShift.number,
            registerId: openShift.registerId,
            registerName: openShift.register.name,
            openedAt: openShift.openedAt,
            salesCount: openShift.salesCount,
            salesTotal: toNumber(openShift.salesTotal),
            expectedCash: toNumber(openShift.expectedCash),
          }
        : null,
      parked: parked.map((p) => ({
        id: p.id, number: p.number, total: toNumber(p.total),
        issuedAt: p.issuedAt, note: p.note, lineCount: p._count.lines,
      })),
      user: {
        id: user.id,
        name: user.fullName,
        maxDiscountPct: user.maxDiscountPct,
        canDiscount: user.permissions.includes('*') || user.permissions.includes('pos.discount'),
        canRefund: user.permissions.includes('*') || user.permissions.includes('pos.refund'),
        canPriceOverride: user.permissions.includes('*') || user.permissions.includes('pos.price_override'),
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
