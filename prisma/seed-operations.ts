/* eslint-disable no-console */
/**
 * Drugi dio punjenja: skladišne operacije, nabava i povijest prodaje.
 * Odvojeno od `seed.ts` radi preglednosti — ovaj dio generira najveći volumen.
 */

import { Prisma, type PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

let seed = 77777;
function rnd() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];
const between = (min: number, max: number) => min + rnd() * (max - min);
const intBetween = (min: number, max: number) => Math.floor(between(min, max + 1));
const round2 = (n: number) => Math.round(n * 100) / 100;
const chance = (p: number) => rnd() < p;
const dec = (n: number) => new Prisma.Decimal(round2(n));

interface SeedContext {
  tenant: { id: string };
  company: { id: string };
  stores: {
    id: string; code: string; name: string; type: string;
    warehouses: { id: string; code: string; isSellable: boolean }[];
    registers: { id: string; code: string }[];
  }[];
  catalog: {
    productId: string; variantId: string; sku: string; name: string;
    categoryId: string; taxRate: number; cost: number; price: number; isWeighted: boolean;
  }[];
  suppliers: { id: string; code: string; name: string }[];
  customers: { id: string; groupId: string }[];
  cashiers: { id: string; storeId: string }[];
  paymentMethods: { id: string; code: string; type: string }[];
  cashMethod: { id: string };
  cardMethod: { id: string };
  owner: { id: string };
  chainManager: { id: string };
}

const CHUNK = 2000;

async function insertChunked<T>(items: T[], fn: (batch: T[]) => Promise<unknown>) {
  for (let i = 0; i < items.length; i += CHUNK) {
    await fn(items.slice(i, i + CHUNK));
  }
}

export async function seedOperations(db: PrismaClient, ctx: SeedContext) {
  const { tenant, stores, catalog, suppliers, customers, cashiers } = ctx;
  const retailStores = stores.filter((s) => s.type === 'RETAIL');
  const central = stores.find((s) => s.type === 'WAREHOUSE')!;
  const now = new Date();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);

  // =========================================================================
  //  Početne zalihe
  // =========================================================================
  console.log('▸ Početne zalihe…');

  const stockItems: Prisma.StockItemCreateManyInput[] = [];
  const movements: Prisma.StockMovementCreateManyInput[] = [];
  /** Stanje po skladištu i artiklu — koristi se dalje kod prodaje. */
  const stockLevels = new Map<string, number>();
  const key = (w: string, v: string) => `${w}:${v}`;

  for (const store of [...retailStores, central]) {
    const warehouse = store.warehouses.find((w) => w.isSellable) ?? store.warehouses[0];
    const isCentral = store.type === 'WAREHOUSE';

    for (const product of catalog) {
      // Manje poslovnice ne drže cijeli asortiman.
      if (!isCentral && !chance(0.88)) continue;
      const qty = isCentral ? intBetween(120, 900) : intBetween(6, 180);
      const cost = round2(product.cost * between(0.97, 1.03));

      stockItems.push({
        warehouseId: warehouse.id,
        variantId: product.variantId,
        quantity: dec(qty),
        avgCost: new Prisma.Decimal(cost),
        lastCost: new Prisma.Decimal(cost),
        lastMovementAt: daysAgo(intBetween(1, 45)),
      });
      movements.push({
        warehouseId: warehouse.id,
        variantId: product.variantId,
        type: 'INITIAL',
        quantity: dec(qty),
        unitCost: new Prisma.Decimal(cost),
        totalCost: dec(qty * cost),
        balanceAfter: dec(qty),
        avgCostAfter: new Prisma.Decimal(cost),
        refType: 'initial',
        refNumber: 'POČ-STANJE',
        note: 'Početno stanje pri uvođenju sustava',
        occurredAt: daysAgo(90),
      });
      stockLevels.set(key(warehouse.id, product.variantId), qty);
    }
  }

  await insertChunked(stockItems, (batch) => db.stockItem.createMany({ data: batch }));
  await insertChunked(movements, (batch) => db.stockMovement.createMany({ data: batch }));
  console.log(`  ${stockItems.length} stavki zalihe`);

  // Pravila nadopune za dio asortimana
  const reorderRules: Prisma.ReorderRuleCreateManyInput[] = [];
  for (const store of retailStores) {
    for (const product of catalog) {
      if (!chance(0.3)) continue;
      const min = intBetween(4, 25);
      reorderRules.push({
        storeId: store.id,
        variantId: product.variantId,
        supplierId: pick(suppliers).id,
        minQty: dec(min),
        maxQty: dec(min * intBetween(3, 6)),
        isAutoOrder: chance(0.25),
      });
    }
  }
  await insertChunked(reorderRules, (batch) => db.reorderRule.createMany({ data: batch, skipDuplicates: true }));

  // =========================================================================
  //  Nabava — narudžbenice i primke
  // =========================================================================
  console.log('▸ Nabava: narudžbenice i primke…');

  let poCounter = 0;
  let grCounter = 0;
  const poStatuses = ['DRAFT', 'SENT', 'CONFIRMED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'RECEIVED', 'RECEIVED'] as const;

  for (let i = 0; i < 48; i++) {
    const store = pick([...retailStores, central]);
    const supplier = pick(suppliers);
    const lineCount = intBetween(4, 14);
    const items = Array.from({ length: lineCount }, () => pick(catalog));
    const created = daysAgo(intBetween(1, 75));
    const status = pick(poStatuses);

    let subtotal = 0;
    const lines = items.map((item) => {
      const qty = intBetween(10, 120);
      const price = round2(item.cost * between(0.95, 1.02));
      const discount = chance(0.3) ? round2(between(1, 8)) : 0;
      const lineTotal = round2(qty * price * (1 - discount / 100));
      subtotal += lineTotal;
      return {
        variantId: item.variantId,
        quantity: dec(qty),
        receivedQty: dec(status === 'RECEIVED' ? qty : status === 'PARTIALLY_RECEIVED' ? Math.floor(qty * 0.6) : 0),
        unitPrice: new Prisma.Decimal(price),
        discountPct: new Prisma.Decimal(discount),
        taxRate: new Prisma.Decimal(item.taxRate),
        lineTotal: dec(lineTotal),
      };
    });

    const taxTotal = round2(subtotal * 0.22);
    const po = await db.purchaseOrder.create({
      data: {
        tenantId: tenant.id,
        storeId: store.id,
        supplierId: supplier.id,
        number: `NAR-${String(++poCounter).padStart(5, '0')}/${created.getFullYear()}`,
        status,
        subtotal: dec(subtotal),
        taxTotal: dec(taxTotal),
        total: dec(subtotal + taxTotal),
        orderedAt: status === 'DRAFT' ? null : created,
        expectedAt: new Date(created.getTime() + intBetween(2, 8) * 86_400_000),
        createdById: ctx.chainManager.id,
        approvedById: status === 'DRAFT' ? null : ctx.owner.id,
        approvedAt: status === 'DRAFT' ? null : created,
        createdAt: created,
        lines: { create: lines },
      },
      include: { lines: true },
    });

    // Primka za zaprimljene narudžbenice
    if (status === 'RECEIVED' || status === 'PARTIALLY_RECEIVED') {
      const warehouse = store.warehouses.find((w) => w.isSellable) ?? store.warehouses[0];
      const receiptDate = new Date(created.getTime() + intBetween(1, 6) * 86_400_000);
      const shipping = round2(between(20, 180));

      let goodsValue = 0;
      let retailValue = 0;
      const receiptLines = po.lines
        .filter((l) => Number(l.receivedQty) > 0)
        .map((line) => {
          const item = catalog.find((c) => c.variantId === line.variantId)!;
          const qty = Number(line.receivedQty);
          const invoicePrice = Number(line.unitPrice);
          const discountPct = Number(line.discountPct);
          const netPrice = round2(invoicePrice * (1 - discountPct / 100));
          const allocated = round2((shipping / Math.max(po.lines.length, 1)) / Math.max(qty, 1));
          const landed = round2(netPrice + allocated);
          const netRetail = item.price / (1 + item.taxRate / 100);
          goodsValue += round2(qty * netPrice);
          retailValue += round2(qty * item.price);
          return {
            variantId: line.variantId,
            quantity: dec(qty),
            invoicePrice: new Prisma.Decimal(invoicePrice),
            discountPct: new Prisma.Decimal(discountPct),
            netPrice: new Prisma.Decimal(netPrice),
            allocatedCost: new Prisma.Decimal(allocated),
            landedCost: new Prisma.Decimal(landed),
            taxRate: new Prisma.Decimal(item.taxRate),
            retailPrice: new Prisma.Decimal(item.price),
            marginPct: new Prisma.Decimal(round2(((netRetail - landed) / netRetail) * 100)),
            marginAmount: new Prisma.Decimal(round2(netRetail - landed)),
            lineTotal: dec(qty * netPrice),
          };
        });

      if (receiptLines.length > 0) {
        await db.goodsReceipt.create({
          data: {
            tenantId: tenant.id,
            storeId: store.id,
            warehouseId: warehouse.id,
            supplierId: supplier.id,
            purchaseOrderId: po.id,
            number: `PR-${String(++grCounter).padStart(5, '0')}/${receiptDate.getFullYear()}`,
            status: chance(0.85) ? 'POSTED' : 'DRAFT',
            supplierDocNo: `${intBetween(1000, 9999)}/${receiptDate.getFullYear()}`,
            supplierDocDate: receiptDate,
            goodsValue: dec(goodsValue),
            shippingCost: dec(shipping),
            taxTotal: dec(goodsValue * 0.22),
            total: dec(goodsValue * 1.22 + shipping),
            retailValue: dec(retailValue),
            marginTotal: dec(retailValue / 1.22 - goodsValue),
            costAllocation: 'value',
            createdById: ctx.chainManager.id,
            postedById: ctx.owner.id,
            postedAt: receiptDate,
            createdAt: receiptDate,
            lines: { create: receiptLines },
          },
        });
      }
    }
  }
  console.log(`  ${poCounter} narudžbenica, ${grCounter} primki`);

  // =========================================================================
  //  Međuskladišnice, inventure, otpisi
  // =========================================================================
  console.log('▸ Međuskladišnice, inventure i otpisi…');

  const transferStatuses = ['DRAFT', 'REQUESTED', 'APPROVED', 'DISPATCHED', 'RECEIVED', 'RECEIVED'] as const;
  for (let i = 0; i < 26; i++) {
    const from = chance(0.6) ? central : pick(retailStores);
    const to = pick(retailStores.filter((s) => s.id !== from.id));
    const status = pick(transferStatuses);
    const created = daysAgo(intBetween(1, 60));
    const items = Array.from({ length: intBetween(3, 10) }, () => pick(catalog));

    let totalCost = 0;
    const lines = items.map((item) => {
      const qty = intBetween(2, 40);
      totalCost += qty * item.cost;
      return {
        variantId: item.variantId,
        requestedQty: dec(qty),
        dispatchedQty: dec(['DISPATCHED', 'RECEIVED'].includes(status) ? qty : 0),
        receivedQty: dec(status === 'RECEIVED' ? qty : 0),
        unitCost: new Prisma.Decimal(item.cost),
      };
    });

    await db.stockTransfer.create({
      data: {
        tenantId: tenant.id,
        number: `MS-${String(i + 1).padStart(5, '0')}/${created.getFullYear()}`,
        fromStoreId: from.id,
        toStoreId: to.id,
        fromWarehouseId: (from.warehouses.find((w) => w.isSellable) ?? from.warehouses[0]).id,
        toWarehouseId: (to.warehouses.find((w) => w.isSellable) ?? to.warehouses[0]).id,
        status,
        totalCost: dec(totalCost),
        requestedById: pick(cashiers).id,
        approvedById: ['APPROVED', 'DISPATCHED', 'RECEIVED'].includes(status) ? ctx.chainManager.id : null,
        dispatchedAt: ['DISPATCHED', 'RECEIVED'].includes(status) ? created : null,
        receivedAt: status === 'RECEIVED' ? new Date(created.getTime() + 86_400_000) : null,
        expectedAt: new Date(created.getTime() + 2 * 86_400_000),
        createdAt: created,
        lines: { create: lines },
      },
    });
  }

  // --- Inventure -------------------------------------------------------------
  for (let i = 0; i < 6; i++) {
    const store = pick(retailStores);
    const warehouse = store.warehouses.find((w) => w.isSellable)!;
    const status = pick(['COUNTING', 'REVIEW', 'POSTED', 'POSTED'] as const);
    const created = daysAgo(intBetween(3, 70));
    const items = catalog.filter(() => chance(0.12));

    let surplus = 0;
    let deficit = 0;
    const lines = items.map((item) => {
      const expected = stockLevels.get(key(warehouse.id, item.variantId)) ?? intBetween(0, 60);
      const counted = status === 'COUNTING' && chance(0.4) ? null : Math.max(0, expected + intBetween(-4, 3));
      const diff = counted === null ? 0 : counted - expected;
      const value = round2(diff * item.cost);
      if (value > 0) surplus += value;
      else deficit += Math.abs(value);
      return {
        variantId: item.variantId,
        expectedQty: dec(expected),
        countedQty: counted === null ? null : dec(counted),
        differenceQty: dec(diff),
        unitCost: new Prisma.Decimal(item.cost),
        valueDelta: dec(value),
        countedById: counted === null ? null : pick(cashiers.filter((c) => c.storeId === store.id))?.id ?? null,
        countedAt: counted === null ? null : created,
        scanCount: counted === null ? 0 : 1,
      };
    });

    await db.stockTake.create({
      data: {
        tenantId: tenant.id,
        storeId: store.id,
        warehouseId: warehouse.id,
        number: `INV-${String(i + 1).padStart(4, '0')}/${created.getFullYear()}`,
        name: `Redovna inventura ${store.name}`,
        status,
        scope: chance(0.5) ? 'full' : 'partial',
        countedLines: lines.filter((l) => l.countedQty !== null).length,
        totalLines: lines.length,
        surplusValue: dec(surplus),
        deficitValue: dec(deficit),
        startedAt: created,
        countedAt: status === 'COUNTING' ? null : created,
        approvedById: status === 'POSTED' ? ctx.owner.id : null,
        postedAt: status === 'POSTED' ? new Date(created.getTime() + 86_400_000) : null,
        createdAt: created,
        lines: { create: lines },
      },
    });
  }

  // --- Otpisi ----------------------------------------------------------------
  const reasonCodes = await db.reasonCode.findMany({ where: { tenantId: tenant.id, scope: 'write_off' } });
  for (let i = 0; i < 22; i++) {
    const store = pick(retailStores);
    const warehouse = store.warehouses.find((w) => w.isSellable)!;
    const created = daysAgo(intBetween(1, 60));
    const items = Array.from({ length: intBetween(1, 6) }, () => pick(catalog));
    let totalCost = 0;
    const lines = items.map((item) => {
      const qty = intBetween(1, 12);
      const cost = round2(qty * item.cost);
      totalCost += cost;
      return {
        variantId: item.variantId,
        quantity: dec(qty),
        unitCost: new Prisma.Decimal(item.cost),
        totalCost: dec(cost),
      };
    });

    await db.writeOff.create({
      data: {
        tenantId: tenant.id,
        storeId: store.id,
        warehouseId: warehouse.id,
        number: `OT-${String(i + 1).padStart(4, '0')}/${created.getFullYear()}`,
        status: chance(0.75) ? 'POSTED' : 'PENDING_APPROVAL',
        reasonCodeId: pick(reasonCodes).id,
        totalCost: dec(totalCost),
        createdById: pick(cashiers).id,
        approvedById: chance(0.75) ? ctx.chainManager.id : null,
        postedAt: chance(0.75) ? created : null,
        createdAt: created,
        lines: { create: lines },
      },
    });
  }

  // =========================================================================
  //  Povijest prodaje
  // =========================================================================
  console.log('▸ Povijest prodaje (60 dana)…');

  const cashMethodId = ctx.cashMethod.id;
  const cardMethodId = ctx.cardMethod.id;
  const DAYS = 60;

  const sales: Prisma.SaleCreateManyInput[] = [];
  const saleLines: Prisma.SaleLineCreateManyInput[] = [];
  const salePayments: Prisma.PaymentCreateManyInput[] = [];
  const saleTaxLines: Prisma.SaleTaxLineCreateManyInput[] = [];
  const shifts: Prisma.ShiftCreateManyInput[] = [];
  const kpis = new Map<string, Prisma.DailyKpiCreateManyInput>();
  const sequenceByRegister = new Map<string, number>();

  let shiftCounter = 0;

  for (let d = DAYS; d >= 0; d--) {
    const day = daysAgo(d);
    day.setHours(0, 0, 0, 0);
    const weekday = day.getDay();
    // Vikendom veći promet, nedjeljom kraće radno vrijeme.
    const dayFactor = weekday === 6 ? 1.35 : weekday === 0 ? 0.55 : weekday === 5 ? 1.2 : 1;

    for (const store of retailStores) {
      const storeCashiers = cashiers.filter((c) => c.storeId === store.id);
      if (storeCashiers.length === 0) continue;
      const warehouse = store.warehouses.find((w) => w.isSellable)!;
      const storeSize = 0.7 + (Number(store.code) % 4) * 0.22;
      const saleCount = Math.max(4, Math.round(intBetween(14, 30) * dayFactor * storeSize));

      // Jedna smjena po blagajni i danu
      const register = pick(store.registers);
      const cashier = pick(storeCashiers);
      const shiftId = randomUUID();
      const openedAt = new Date(day.getTime() + 7 * 3_600_000);
      const openingFloat = 150;

      let shiftSales = 0;
      let shiftCash = 0;
      let shiftCard = 0;
      let shiftDiscount = 0;

      for (let s = 0; s < saleCount; s++) {
        const hour = 7 + Math.floor(Math.abs(between(-1, 1) + between(0, 1)) * 7) % 14;
        const issuedAt = new Date(day.getTime() + hour * 3_600_000 + intBetween(0, 59) * 60_000);
        if (issuedAt > now) continue;

        const saleId = randomUUID();
        const lineCount = intBetween(1, 8);
        const customer = chance(0.28) ? pick(customers) : null;

        let subtotal = 0;
        let discountTotal = 0;
        let taxTotal = 0;
        let costTotal = 0;
        let itemCount = 0;
        const taxBuckets = new Map<number, { base: number; amount: number }>();

        for (let l = 0; l < lineCount; l++) {
          const item = pick(catalog);
          const qty = item.isWeighted ? round2(between(0.2, 2.5)) : intBetween(1, 4);
          const unitPrice = item.price;
          const discountPct = chance(0.12) ? pick([5, 10, 15, 20]) : 0;
          const lineGross = round2(qty * unitPrice);
          const lineDiscount = round2((lineGross * discountPct) / 100);
          const lineTotal = round2(lineGross - lineDiscount);
          const lineTax = round2(lineTotal - lineTotal / (1 + item.taxRate / 100));
          const unitCost = item.cost;
          const lineCost = round2(qty * unitCost);

          subtotal = round2(subtotal + lineGross);
          discountTotal = round2(discountTotal + lineDiscount);
          taxTotal = round2(taxTotal + lineTax);
          costTotal = round2(costTotal + lineCost);
          itemCount += qty;

          const bucket = taxBuckets.get(item.taxRate) ?? { base: 0, amount: 0 };
          bucket.base = round2(bucket.base + (lineTotal - lineTax));
          bucket.amount = round2(bucket.amount + lineTax);
          taxBuckets.set(item.taxRate, bucket);

          saleLines.push({
            saleId,
            variantId: item.variantId,
            lineNo: l + 1,
            sku: item.sku,
            name: item.name,
            quantity: dec(qty),
            unitPrice: new Prisma.Decimal(unitPrice),
            originalPrice: new Prisma.Decimal(unitPrice),
            discountPct: new Prisma.Decimal(discountPct),
            discountAmount: dec(lineDiscount),
            taxRate: new Prisma.Decimal(item.taxRate),
            taxAmount: dec(lineTax),
            lineTotal: dec(lineTotal),
            unitCost: new Prisma.Decimal(unitCost),
            costTotal: dec(lineCost),
            marginAmount: dec(lineTotal - lineTax - lineCost),
            soldById: cashier.id,
          });

          // Smanjenje evidentiranog stanja (bez zasebnog kretanja — povijest je agregirana)
          const k = key(warehouse.id, item.variantId);
          stockLevels.set(k, Math.max(0, (stockLevels.get(k) ?? 0) - qty));
        }

        const total = round2(subtotal - discountTotal);
        const isCard = chance(0.58);
        const seqKey = `${store.id}:${register.code}`;
        const seqNo = (sequenceByRegister.get(seqKey) ?? 0) + 1;
        sequenceByRegister.set(seqKey, seqNo);

        for (const [rate, bucket] of taxBuckets) {
          saleTaxLines.push({
            saleId,
            taxRate: new Prisma.Decimal(rate),
            taxName: `PDV ${rate}%`,
            baseAmount: dec(bucket.base),
            taxAmount: dec(bucket.amount),
          });
        }

        salePayments.push({
          saleId,
          paymentMethodId: isCard ? cardMethodId : cashMethodId,
          amount: dec(total),
          tendered: isCard ? null : dec(Math.ceil(total / 5) * 5),
          changeGiven: isCard ? dec(0) : dec(Math.ceil(total / 5) * 5 - total),
          cardBrand: isCard ? pick(['Visa', 'Mastercard', 'Maestro']) : null,
          cardLast4: isCard ? String(intBetween(1000, 9999)) : null,
          processedAt: issuedAt,
        });

        sales.push({
          id: saleId,
          tenantId: tenant.id,
          storeId: store.id,
          registerId: register.id,
          shiftId,
          userId: cashier.id,
          customerId: customer?.id ?? null,
          number: `${seqNo}/${store.code}/${register.code}`,
          sequenceNo: seqNo,
          kind: 'RECEIPT',
          status: 'COMPLETED',
          channel: 'POS',
          subtotal: dec(subtotal),
          discountTotal: dec(discountTotal),
          taxTotal: dec(taxTotal),
          total: dec(total),
          paidTotal: dec(total),
          costTotal: dec(costTotal),
          marginTotal: dec(total - taxTotal - costTotal),
          fiscalStatus: 'CONFIRMED',
          fiscalJir: randomUUID(),
          fiscalZki: randomUUID().replace(/-/g, '').slice(0, 32),
          fiscalPaymentType: isCard ? 'K' : 'G',
          fiscalSentAt: issuedAt,
          loyaltyPointsEarned: customer ? Math.floor(total) : 0,
          issuedAt,
          completedAt: issuedAt,
          createdAt: issuedAt,
        });

        shiftSales = round2(shiftSales + total);
        shiftDiscount = round2(shiftDiscount + discountTotal);
        if (isCard) shiftCard = round2(shiftCard + total);
        else shiftCash = round2(shiftCash + total);

        // Dnevni pokazatelji
        const kpiKey = `${store.id}:${day.toISOString().slice(0, 10)}`;
        const kpi = kpis.get(kpiKey);
        const net = round2(total - taxTotal);
        if (kpi) {
          kpi.salesCount = (kpi.salesCount as number) + 1;
          kpi.itemsSold = dec(Number(kpi.itemsSold) + itemCount);
          kpi.grossSales = dec(Number(kpi.grossSales) + total);
          kpi.netSales = dec(Number(kpi.netSales) + net);
          kpi.taxTotal = dec(Number(kpi.taxTotal) + taxTotal);
          kpi.discountTotal = dec(Number(kpi.discountTotal) + discountTotal);
          kpi.costTotal = dec(Number(kpi.costTotal) + costTotal);
          kpi.marginTotal = dec(Number(kpi.marginTotal) + (net - costTotal));
          kpi.customerCount = (kpi.customerCount as number) + (customer ? 1 : 0);
          if (isCard) kpi.cardTotal = dec(Number(kpi.cardTotal) + total);
          else kpi.cashTotal = dec(Number(kpi.cashTotal) + total);
        } else {
          kpis.set(kpiKey, {
            tenantId: tenant.id,
            storeId: store.id,
            date: day,
            salesCount: 1,
            itemsSold: dec(itemCount),
            grossSales: dec(total),
            netSales: dec(net),
            taxTotal: dec(taxTotal),
            discountTotal: dec(discountTotal),
            costTotal: dec(costTotal),
            marginTotal: dec(net - costTotal),
            customerCount: customer ? 1 : 0,
            cashTotal: dec(isCard ? 0 : total),
            cardTotal: dec(isCard ? total : 0),
          });
        }
      }

      const closedAt = new Date(day.getTime() + 21 * 3_600_000);
      const isToday = d === 0;
      const countedCash = round2(openingFloat + shiftCash + between(-3, 2));

      shifts.push({
        id: shiftId,
        tenantId: tenant.id,
        storeId: store.id,
        registerId: register.id,
        userId: cashier.id,
        number: `SM-${String(++shiftCounter).padStart(5, '0')}/${day.getFullYear()}`,
        status: isToday ? 'OPEN' : 'CLOSED',
        openingFloat: dec(openingFloat),
        expectedCash: dec(openingFloat + shiftCash),
        countedCash: isToday ? null : dec(countedCash),
        cashDifference: isToday ? dec(0) : dec(countedCash - openingFloat - shiftCash),
        salesCount: 0,
        salesTotal: dec(shiftSales),
        cashTotal: dec(shiftCash),
        cardTotal: dec(shiftCard),
        discountTotal: dec(shiftDiscount),
        openedAt,
        closedAt: isToday ? null : closedAt,
      });
    }
  }

  console.log(`  ${sales.length} računa, ${saleLines.length} stavki — upisujem…`);

  await insertChunked(shifts, (batch) => db.shift.createMany({ data: batch }));
  await insertChunked(sales, (batch) => db.sale.createMany({ data: batch }));
  await insertChunked(saleLines, (batch) => db.saleLine.createMany({ data: batch }));
  await insertChunked(saleTaxLines, (batch) => db.saleTaxLine.createMany({ data: batch }));
  await insertChunked(salePayments, (batch) => db.payment.createMany({ data: batch }));
  await insertChunked([...kpis.values()], (batch) => db.dailyKpi.createMany({ data: batch }));

  // Broj računa po smjeni
  await db.$executeRaw`
    UPDATE shifts SET "salesCount" = sub.cnt
    FROM (SELECT "shiftId", COUNT(*)::int AS cnt FROM sales WHERE "shiftId" IS NOT NULL GROUP BY "shiftId") sub
    WHERE shifts."id" = sub."shiftId"
  `;

  // Usklađivanje zaliha s prodajom
  console.log('▸ Usklađivanje zaliha nakon prodaje…');
  await db.$executeRaw`
    UPDATE stock_items si
    SET "quantity" = GREATEST(si."quantity" - sold.qty, 0)
    FROM (
      SELECT sl."variantId", s."storeId", SUM(sl."quantity") AS qty
      FROM sale_lines sl
      JOIN sales s ON s."id" = sl."saleId"
      GROUP BY sl."variantId", s."storeId"
    ) sold
    JOIN warehouses w ON w."storeId" = sold."storeId" AND w."isSellable" = true
    WHERE si."variantId" = sold."variantId" AND si."warehouseId" = w."id"
  `;

  // =========================================================================
  //  Obavijesti i revizijski trag
  // =========================================================================
  console.log('▸ Obavijesti i revizijski trag…');

  await db.notification.createMany({
    data: [
      {
        tenantId: tenant.id, level: 'critical', category: 'stock',
        title: 'Kritično niska zaliha u 14 artikala',
        body: 'Poslovnica Centar — artikli ispod minimalne zalihe.',
        link: '/inventory/replenishment',
      },
      {
        tenantId: tenant.id, level: 'warning', category: 'shift',
        title: 'Razlika u blagajni: −4,80 EUR',
        body: 'Smjena SM-00042 zatvorena s odstupanjem od očekivane gotovine.',
        link: '/sales/shifts',
      },
      {
        tenantId: tenant.id, level: 'info', category: 'price',
        title: 'Nivelacija čeka odobrenje',
        body: '32 artikla — promjena maloprodajnih cijena od ponedjeljka.',
        link: '/pricing/price-changes',
      },
      {
        tenantId: tenant.id, level: 'warning', category: 'fiscal',
        title: 'Fiskalizacija nije aktivirana',
        body: 'Sustav radi u demo načinu. Certifikat nije učitan.',
        link: '/settings/integrations',
      },
    ],
  });

  const auditEntries: Prisma.AuditLogCreateManyInput[] = [];
  const actions = ['CREATE', 'UPDATE', 'APPROVE', 'POST', 'PRICE_OVERRIDE', 'DISCOUNT_OVERRIDE', 'LOGIN', 'EXPORT'] as const;
  const entities = ['product', 'price_list', 'sale', 'goods_receipt', 'stock_transfer', 'user', 'promotion'];
  for (let i = 0; i < 260; i++) {
    const action = pick(actions);
    const entity = pick(entities);
    auditEntries.push({
      tenantId: tenant.id,
      userId: pick([ctx.owner, ctx.chainManager, ...cashiers]).id,
      action,
      entityType: entity,
      entityId: randomUUID(),
      summary: `${action} na zapisu ${entity}`,
      ipAddress: `10.0.${intBetween(0, 40)}.${intBetween(2, 250)}`,
      createdAt: daysAgo(between(0, 45)),
    });
  }
  await db.auditLog.createMany({ data: auditEntries });

  // Nivelacija koja čeka odobrenje
  const priceChangeItems = catalog.filter(() => chance(0.06)).slice(0, 32);
  if (priceChangeItems.length > 0) {
    let delta = 0;
    const lines = priceChangeItems.map((item) => {
      const newPrice = round2(item.price * between(1.02, 1.12));
      const stock = intBetween(5, 90);
      const valueDelta = round2((newPrice - item.price) * stock);
      delta += valueDelta;
      return {
        variantId: item.variantId,
        oldPrice: new Prisma.Decimal(item.price),
        newPrice: new Prisma.Decimal(newPrice),
        stockQty: dec(stock),
        valueDelta: dec(valueDelta),
      };
    });

    await db.priceChangeDocument.create({
      data: {
        tenantId: tenant.id,
        storeId: retailStores[0].id,
        number: `NIV-0001/${now.getFullYear()}`,
        status: 'DRAFT',
        reason: 'Usklađenje s novim nabavnim cijenama dobavljača',
        effectiveAt: new Date(now.getTime() + 3 * 86_400_000),
        stockValueDelta: dec(delta),
        createdById: ctx.chainManager.id,
        lines: { create: lines },
      },
    });
  }

  // Integracije
  await db.integrationConfig.createMany({
    data: [
      {
        tenantId: tenant.id, type: 'FISCALIZATION', provider: 'hr-porezna',
        name: 'Fiskalizacija — Porezna uprava RH', isEnabled: false,
        config: { endpoint: 'https://cistest.apis-it.hr:8449/FiskalizacijaServiceTest', mode: 'test' },
      },
      {
        tenantId: tenant.id, type: 'PAYMENT_TERMINAL', provider: 'generic',
        name: 'POS terminal (ECR protokol)', isEnabled: false,
        config: { protocol: 'ECR', port: 'COM3', baudRate: 9600 },
      },
      {
        tenantId: tenant.id, type: 'ACCOUNTING', provider: 'csv-export',
        name: 'Izvoz u knjigovodstvo (CSV)', isEnabled: true,
        config: { schedule: '0 2 * * *', format: 'csv' },
      },
      {
        tenantId: tenant.id, type: 'ECOMMERCE', provider: 'rest',
        name: 'Web shop — sinkronizacija artikala i zalihe', isEnabled: false,
        config: { syncInterval: 15 },
      },
      {
        tenantId: tenant.id, type: 'SCALE', provider: 'dibal',
        name: 'Vage u prodajnom prostoru', isEnabled: true,
        config: { barcodePrefix: '21', weightDigits: 5 },
      },
    ],
  });

  console.log(`  ${auditEntries.length} zapisa revizijskog traga`);
}
