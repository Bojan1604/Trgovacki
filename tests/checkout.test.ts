/**
 * Integracijski test naplate — radi protiv stvarne baze.
 *
 * Pokreće se nad napunjenom razvojnom bazom (`npm run db:seed`) i za sobom
 * čisti dokumente koje je kreirao. Provjerava ono što se jedinično ne može:
 * transakcijsku ispravnost knjiženja, idempotentnost i zaštitu zalihe.
 */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { checkout } from '../src/lib/services/sales';
import { refundSale } from '../src/lib/services/refunds';
import { openShift, closeShift } from '../src/lib/services/shifts';
import { toNumber } from '../src/lib/money';

const db = new PrismaClient();

let tenantId: string;
let storeId: string;
let registerId: string;
let warehouseId: string;
let userId: string;
let cashMethodId: string;
let shiftId: string;
let variantId: string;
const createdSaleIds: string[] = [];

before(async () => {
  const store = await db.store.findFirst({
    where: { type: 'RETAIL' },
    include: {
      registers: { take: 1 },
      warehouses: { where: { isSellable: true }, take: 1 },
    },
    orderBy: { code: 'asc' },
  });
  assert.ok(store, 'Baza mora biti napunjena — pokrenite `npm run db:seed`.');

  tenantId = store.tenantId;
  storeId = store.id;
  registerId = store.registers[0].id;
  warehouseId = store.warehouses[0].id;

  const user = await db.user.findFirst({ where: { tenantId, email: { startsWith: 'vlasnik' } } });
  assert.ok(user);
  userId = user.id;

  const method = await db.paymentMethod.findFirst({ where: { tenantId, type: 'CASH' } });
  assert.ok(method);
  cashMethodId = method.id;

  // Artikl s dovoljnom zalihom na prodajnom skladištu.
  const stock = await db.stockItem.findFirst({
    where: { warehouseId, quantity: { gt: 50 } },
    orderBy: { quantity: 'desc' },
  });
  assert.ok(stock, 'Nema artikla s dovoljnom zalihom za test.');
  variantId = stock.variantId;

  // Zatvori eventualnu otvorenu smjenu na blagajni pa otvori vlastitu.
  const open = await db.shift.findFirst({ where: { registerId, status: 'OPEN' } });
  if (open) {
    await closeShift({ tenantId, shiftId: open.id, userId: open.userId, countedCash: 0 });
  }
  const shift = await openShift({ tenantId, storeId, registerId, userId, openingFloat: 100 });
  shiftId = shift.id;
});

after(async () => {
  // Ukloni dokumente kreirane testom kako baza ostane upotrebljiva.
  if (createdSaleIds.length > 0) {
    await db.stockMovement.deleteMany({ where: { refId: { in: createdSaleIds } } });
    await db.sale.deleteMany({ where: { id: { in: createdSaleIds } } });
  }
  await db.cashMovement.deleteMany({ where: { shiftId } });
  await db.shift.deleteMany({ where: { id: shiftId } });
  await db.$disconnect();
});

describe('naplata računa', () => {
  it('knjiži račun, stavke, PDV i izlaz sa zalihe', async () => {
    const before = await db.stockItem.findUnique({
      where: { warehouseId_variantId: { warehouseId, variantId } },
    });
    const beforeQty = toNumber(before!.quantity);

    const result = await checkout({
      tenantId,
      storeId,
      registerId,
      shiftId,
      userId,
      lines: [{ variantId, quantity: 2 }],
      payments: [{ paymentMethodId: cashMethodId, amount: 1000, tendered: 1000 }],
      clientUuid: randomUUID(),
    });
    createdSaleIds.push(result.sale.id);

    assert.equal(result.duplicate, false);
    assert.equal(result.sale.status, 'COMPLETED');
    assert.equal(result.sale.lines.length, 1);
    assert.ok(toNumber(result.sale.total) > 0);

    // Zbroj stavki odgovara ukupnom iznosu računa.
    const lineSum = result.sale.lines.reduce(
      (acc, l) => acc + toNumber(l.lineTotal) + toNumber(l.depositAmount),
      0,
    );
    assert.equal(Math.round(lineSum * 100), Math.round(toNumber(result.sale.total) * 100));

    // Rekapitulacija PDV-a odgovara zbroju poreza po stavkama.
    const taxSum = result.sale.taxLines.reduce((acc, t) => acc + toNumber(t.taxAmount), 0);
    assert.equal(Math.round(taxSum * 100), Math.round(toNumber(result.sale.taxTotal) * 100));

    // Zaliha je umanjena točno za prodanu količinu.
    const after = await db.stockItem.findUnique({
      where: { warehouseId_variantId: { warehouseId, variantId } },
    });
    assert.equal(toNumber(after!.quantity), beforeQty - 2);

    // Kretanje zalihe je zabilježeno s negativnim predznakom.
    const movement = await db.stockMovement.findFirst({
      where: { refId: result.sale.id, variantId },
    });
    assert.ok(movement);
    assert.equal(toNumber(movement.quantity), -2);
    assert.equal(movement.type, 'SALE');
  });

  it('isti ključ klijenta ne stvara drugi račun', async () => {
    const clientUuid = randomUUID();
    const payload = {
      tenantId, storeId, registerId, shiftId, userId,
      lines: [{ variantId, quantity: 1 }],
      payments: [{ paymentMethodId: cashMethodId, amount: 1000 }],
      clientUuid,
    };

    const first = await checkout(payload);
    createdSaleIds.push(first.sale.id);
    const second = await checkout(payload);

    assert.equal(second.duplicate, true);
    assert.equal(second.sale.id, first.sale.id);

    const count = await db.sale.count({ where: { clientUuid } });
    assert.equal(count, 1);
  });

  it('odbija prodaju iznad raspoložive zalihe', async () => {
    let thrown: unknown = null;
    let sale: Awaited<ReturnType<typeof checkout>> | null = null;
    try {
      sale = await checkout({
        tenantId, storeId, registerId, shiftId, userId,
        lines: [{ variantId, quantity: 9_999_999 }],
        payments: [{ paymentMethodId: cashMethodId, amount: 99_999_999 }],
        clientUuid: randomUUID(),
      });
    } catch (error) {
      thrown = error;
    }
    if (sale) createdSaleIds.push(sale.sale.id);
    assert.ok(thrown, 'Naplata je prošla iako zaliha nije dostatna.');
    assert.match((thrown as Error).message, /Nedovoljna zaliha/, `Neočekivana greška: ${(thrown as Error).message}`);
  });

  it('odbija plaćanje manje od iznosa računa', async () => {
    await assert.rejects(
      () =>
        checkout({
          tenantId, storeId, registerId, shiftId, userId,
          lines: [{ variantId, quantity: 1 }],
          payments: [{ paymentMethodId: cashMethodId, amount: 0.01 }],
          clientUuid: randomUUID(),
        }),
      /manji je od iznosa računa/,
    );
  });

  it('odbija prazan račun', async () => {
    await assert.rejects(
      () =>
        checkout({
          tenantId, storeId, registerId, shiftId, userId,
          lines: [],
          payments: [{ paymentMethodId: cashMethodId, amount: 1 }],
          clientUuid: randomUUID(),
        }),
      /nema stavki/,
    );
  });
});

describe('povrat robe', () => {
  it('vraća robu na zalihu i označava izvorni račun', async () => {
    const sale = await checkout({
      tenantId, storeId, registerId, shiftId, userId,
      lines: [{ variantId, quantity: 3 }],
      payments: [{ paymentMethodId: cashMethodId, amount: 1000 }],
      clientUuid: randomUUID(),
    });
    createdSaleIds.push(sale.sale.id);

    const beforeRefund = await db.stockItem.findUnique({
      where: { warehouseId_variantId: { warehouseId, variantId } },
    });

    const refund = await refundSale({
      tenantId,
      saleId: sale.sale.id,
      userId,
      shiftId,
      registerId,
      paymentMethodId: cashMethodId,
      reason: 'Test povrata',
      lines: [{ saleLineId: sale.sale.lines[0].id, quantity: 1, restock: true }],
    });
    createdSaleIds.push(refund.id);

    assert.equal(refund.kind, 'CREDIT_NOTE');
    assert.ok(toNumber(refund.total) < 0, 'Odobrenje mora imati negativan iznos.');

    const afterRefund = await db.stockItem.findUnique({
      where: { warehouseId_variantId: { warehouseId, variantId } },
    });
    assert.equal(toNumber(afterRefund!.quantity), toNumber(beforeRefund!.quantity) + 1);

    const original = await db.sale.findUnique({ where: { id: sale.sale.id } });
    assert.equal(original!.status, 'PARTIALLY_REFUNDED');
  });

  it('ne dopušta povrat veće količine od kupljene', async () => {
    const sale = await checkout({
      tenantId, storeId, registerId, shiftId, userId,
      lines: [{ variantId, quantity: 1 }],
      payments: [{ paymentMethodId: cashMethodId, amount: 1000 }],
      clientUuid: randomUUID(),
    });
    createdSaleIds.push(sale.sale.id);

    await assert.rejects(
      () =>
        refundSale({
          tenantId,
          saleId: sale.sale.id,
          userId,
          paymentMethodId: cashMethodId,
          reason: 'Test',
          lines: [{ saleLineId: sale.sale.lines[0].id, quantity: 5 }],
        }),
      /moguće vratiti najviše/,
    );
  });
});

describe('smjena', () => {
  it('prati promet i očekivanu gotovinu', async () => {
    const shift = await db.shift.findUnique({ where: { id: shiftId } });
    assert.ok(shift);
    assert.ok(shift.salesCount > 0, 'Smjena mora bilježiti naplaćene račune.');
    assert.ok(toNumber(shift.salesTotal) > 0);
    // Očekivana gotovina = početni saldo + neto gotovinski promet.
    assert.ok(toNumber(shift.expectedCash) >= 100);
  });
});
