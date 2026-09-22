/* eslint-disable no-console */
/**
 * Punjenje demo podacima za trgovački lanac "Delta Retail".
 *
 * Generira potpun, međusobno konzistentan skup: organizaciju, poslovnice,
 * korisnike i role, katalog s barkodovima i cjenicima, zalihe s knjiženim
 * ulazima, nabavu, ~90 dana prodaje s računima i stavkama, kupce i program
 * vjernosti te agregirane dnevne pokazatelje.
 *
 * Pokretanje:  npm run db:seed
 */

import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  BRANDS, CATEGORY_TREE, CITIES, COMPANY_NAMES, FIRST_NAMES, LAST_NAMES,
  PRODUCT_TEMPLATES, STORES, SUPPLIERS,
} from './seed-data';
import { SYSTEM_ROLES } from '../src/lib/permissions';

const db = new PrismaClient();

// --- Deterministički generator slučajnih brojeva (isti seed → isti podaci) ---
let seed = 20260922;
function rnd() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];
const between = (min: number, max: number) => min + rnd() * (max - min);
const intBetween = (min: number, max: number) => Math.floor(between(min, max + 1));
const round2 = (n: number) => Math.round(n * 100) / 100;
const chance = (p: number) => rnd() < p;

function ean13(body: string) {
  const b = body.padStart(12, '0').slice(0, 12);
  const sum = b.split('').reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
  return b + String((10 - (sum % 10)) % 10);
}

async function main() {
  console.log('▸ Brisanje postojećih demo podataka…');
  // Knjiga kretanja zalihe namjerno nema kaskadno brisanje (nepromjenjiv trag),
  // pa se pri ponovnom punjenju sve tablice prazne izravno.
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT LIKE '_prisma%'
  `;
  if (tables.length > 0) {
    const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
    await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  }

  // =========================================================================
  //  Organizacija
  // =========================================================================
  console.log('▸ Organizacija i poslovnice…');

  const tenant = await db.tenant.create({
    data: {
      slug: 'delta-retail',
      name: 'Delta Retail',
      legalName: 'Delta Retail d.o.o.',
      plan: 'ENTERPRISE',
      baseCurrency: 'EUR',
      featureFlags: { loyalty: true, ecommerce: true, multiCompany: true, weighing: true },
    },
  });

  const company = await db.company.create({
    data: {
      tenantId: tenant.id,
      code: 'DR',
      name: 'Delta Retail',
      legalName: 'Delta Retail d.o.o.',
      vatId: '12345678901',
      registrationNo: '080123456',
      iban: 'HR1723600001101234565',
      bankName: 'Zagrebačka banka d.d.',
      addressLine: 'Radnička cesta 80',
      city: 'Zagreb',
      postalCode: '10000',
      email: 'info@delta-retail.hr',
      phone: '+385 1 6000 100',
      website: 'https://delta-retail.hr',
      fiscalOperator: '98765432109',
      invoiceFooter: 'Hvala na kupnji! Reklamacije se primaju uz račun u roku od 14 dana.',
      isDefault: true,
    },
  });

  // --- Porezi, jedinice, načini plaćanja, razlozi -----------------------------
  const taxRates = await Promise.all(
    [
      { code: 'PDV25', name: 'PDV 25%', rate: 25, fiscalCode: '25', isDefault: true },
      { code: 'PDV13', name: 'PDV 13%', rate: 13, fiscalCode: '13', isDefault: false },
      { code: 'PDV5', name: 'PDV 5%', rate: 5, fiscalCode: '5', isDefault: false },
      { code: 'PDV0', name: 'Oslobođeno PDV-a', rate: 0, fiscalCode: '0', isDefault: false },
    ].map((t) =>
      db.taxRate.create({
        data: { tenantId: tenant.id, ...t, rate: new Prisma.Decimal(t.rate) },
      }),
    ),
  );
  const taxByCode = new Map(taxRates.map((t) => [t.code, t]));

  const units = await Promise.all(
    [
      { code: 'kom', name: 'Komad', precision: 0, isWeight: false },
      { code: 'kg', name: 'Kilogram', precision: 3, isWeight: true },
      { code: 'l', name: 'Litra', precision: 3, isWeight: false },
      { code: 'pak', name: 'Pakiranje', precision: 0, isWeight: false },
      { code: 'm', name: 'Metar', precision: 2, isWeight: false },
    ].map((u) => db.unitOfMeasure.create({ data: { tenantId: tenant.id, ...u } })),
  );
  const unitKom = units[0];
  const unitKg = units[1];

  const paymentMethods = await Promise.all(
    [
      { code: 'GOT', name: 'Gotovina', type: 'CASH' as const, fiscalCode: 'G', opensDrawer: true, allowsChange: true, sortOrder: 1 },
      { code: 'KART', name: 'Kartica', type: 'CARD' as const, fiscalCode: 'K', feePct: 1.2, sortOrder: 2 },
      { code: 'VIRM', name: 'Virman / transakcijski račun', type: 'BANK_TRANSFER' as const, fiscalCode: 'T', requiresRef: true, sortOrder: 5 },
      { code: 'POKL', name: 'Poklon kartica', type: 'GIFT_CARD' as const, fiscalCode: 'O', sortOrder: 3 },
      { code: 'MOB', name: 'Mobilno plaćanje', type: 'MOBILE' as const, fiscalCode: 'O', sortOrder: 4 },
      { code: 'ODG', name: 'Na odgodu (B2B)', type: 'ON_ACCOUNT' as const, fiscalCode: 'T', requiresRef: true, sortOrder: 6 },
    ].map((m) =>
      db.paymentMethod.create({
        data: { tenantId: tenant.id, ...m, feePct: new Prisma.Decimal(m.feePct ?? 0) },
      }),
    ),
  );
  const cashMethod = paymentMethods[0];
  const cardMethod = paymentMethods[1];

  await db.reasonCode.createMany({
    data: [
      { tenantId: tenant.id, code: 'LOM', name: 'Lom i rasipanje', scope: 'write_off' },
      { tenantId: tenant.id, code: 'ROK', name: 'Istekao rok trajanja', scope: 'write_off' },
      { tenantId: tenant.id, code: 'KVAR', name: 'Neispravna roba', scope: 'write_off' },
      { tenantId: tenant.id, code: 'KRAĐA', name: 'Manjak / krađa', scope: 'write_off', requiresNote: true },
      { tenantId: tenant.id, code: 'DEGU', name: 'Degustacija / uzorak', scope: 'write_off' },
      { tenantId: tenant.id, code: 'INV', name: 'Inventurna razlika', scope: 'adjustment' },
      { tenantId: tenant.id, code: 'POV-NEZ', name: 'Povrat — nezadovoljstvo kupca', scope: 'return' },
      { tenantId: tenant.id, code: 'POV-KVAR', name: 'Povrat — neispravan artikl', scope: 'return' },
      { tenantId: tenant.id, code: 'POP-VOD', name: 'Popust odobrio voditelj', scope: 'discount', requiresNote: true },
      { tenantId: tenant.id, code: 'STOR', name: 'Storno pogrešnog unosa', scope: 'void' },
    ],
  });

  // --- Poslovnice, skladišta i blagajne ---------------------------------------
  const stores = [];
  for (const s of STORES) {
    const store = await db.store.create({
      data: {
        tenantId: tenant.id,
        companyId: company.id,
        code: s.code,
        name: s.name,
        type: 'RETAIL',
        addressLine: s.address,
        city: s.city,
        postalCode: CITIES.find(([c]) => c === s.city)?.[1] ?? '10000',
        region: s.region,
        squareMeters: s.m2,
        phone: `+385 ${intBetween(1, 53)} ${intBetween(2000000, 8999999)}`,
        email: `${s.name.toLowerCase().replace(/\s+/g, '.')}@delta-retail.hr`,
        managerName: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
        openingHours: {
          pon_pet: '07:00–21:00', sub: '07:00–20:00', ned: '08:00–14:00',
        },
        openedAt: new Date(2019 + intBetween(0, 5), intBetween(0, 11), intBetween(1, 28)),
        warehouses: {
          create: [
            { code: 'PP', name: 'Prodajni prostor', type: 'SALES_FLOOR', isDefault: true, isSellable: true },
            { code: 'SK', name: 'Skladište trgovine', type: 'BACK_STORE', isSellable: false },
          ],
        },
        registers: {
          create: Array.from({ length: s.registers }, (_, i) => ({
            code: String(i + 1),
            name: `Blagajna ${i + 1}`,
            deviceId: `POS-${s.code}-${i + 1}`,
          })),
        },
      },
      include: { warehouses: true, registers: true },
    });
    stores.push(store);
  }

  // Centralno skladište
  const centralStore = await db.store.create({
    data: {
      tenantId: tenant.id,
      companyId: company.id,
      code: '90',
      name: 'Centralno skladište',
      type: 'WAREHOUSE',
      addressLine: 'Slavonska avenija 200',
      city: 'Zagreb',
      postalCode: '10000',
      region: 'Zagreb',
      fiscalEnabled: false,
      warehouses: { create: [{ code: 'CS', name: 'Centralno skladište', type: 'CENTRAL', isDefault: true, isSellable: false }] },
    },
    include: { warehouses: true, registers: true },
  });
  stores.push(centralStore);

  console.log(`  ${stores.length} poslovnica, ${stores.reduce((a, s) => a + s.registers.length, 0)} blagajni`);

  // =========================================================================
  //  Role i korisnici
  // =========================================================================
  console.log('▸ Role i korisnici…');

  const roles = await Promise.all(
    SYSTEM_ROLES.map((r) =>
      db.role.create({
        data: {
          tenantId: tenant.id,
          code: r.code,
          name: r.name,
          description: r.description,
          isSystem: true,
          permissions: [...r.permissions],
        },
      }),
    ),
  );
  const roleByCode = new Map(roles.map((r) => [r.code, r]));
  const passwordHash = await bcrypt.hash('demo1234', 10);
  const pinHash = await bcrypt.hash('1234', 10);

  async function createUser(args: {
    email: string; firstName: string; lastName: string; roleCode: string;
    storeIds: string[]; defaultStoreId?: string; maxDiscountPct?: number; superAdmin?: boolean;
  }) {
    return db.user.create({
      data: {
        tenantId: tenant.id,
        email: args.email,
        passwordHash,
        posPinHash: pinHash,
        firstName: args.firstName,
        lastName: args.lastName,
        isSuperAdmin: args.superAdmin ?? false,
        employeeCode: `E${intBetween(1000, 9999)}`,
        defaultStoreId: args.defaultStoreId ?? args.storeIds[0] ?? null,
        maxDiscountPct: new Prisma.Decimal(args.maxDiscountPct ?? 0),
        roles: { create: [{ roleId: roleByCode.get(args.roleCode)!.id }] },
        storeAccess: {
          create: args.storeIds.map((id) => ({ storeId: id, canManage: args.roleCode !== 'CASHIER' })),
        },
      },
    });
  }

  const allStoreIds = stores.map((s) => s.id);

  const owner = await createUser({
    email: 'vlasnik@trgovacki.hr', firstName: 'Bojan', lastName: 'Matutinović',
    roleCode: 'OWNER', storeIds: allStoreIds, maxDiscountPct: 100, superAdmin: true,
  });
  const chainManager = await createUser({
    email: 'voditelj@trgovacki.hr', firstName: 'Ivana', lastName: 'Horvat',
    roleCode: 'CHAIN_MANAGER', storeIds: allStoreIds, maxDiscountPct: 30,
  });
  await createUser({
    email: 'nabava@trgovacki.hr', firstName: 'Marko', lastName: 'Kovačević',
    roleCode: 'BUYER', storeIds: allStoreIds, maxDiscountPct: 10,
  });
  await createUser({
    email: 'racunovodstvo@trgovacki.hr', firstName: 'Petra', lastName: 'Babić',
    roleCode: 'ACCOUNTANT', storeIds: allStoreIds,
  });

  const cashiers: { id: string; storeId: string }[] = [];
  for (const store of stores.filter((s) => s.type === 'RETAIL')) {
    const manager = await createUser({
      email: `voditelj.${store.code}@trgovacki.hr`,
      firstName: pick(FIRST_NAMES), lastName: pick(LAST_NAMES),
      roleCode: 'STORE_MANAGER', storeIds: [store.id], maxDiscountPct: 15,
    });
    cashiers.push({ id: manager.id, storeId: store.id });

    for (let i = 0; i < 3; i++) {
      const first = pick(FIRST_NAMES);
      const last = pick(LAST_NAMES);
      const user = await createUser({
        email: `prodavac.${store.code}.${i + 1}@trgovacki.hr`,
        firstName: first, lastName: last,
        roleCode: 'CASHIER', storeIds: [store.id], maxDiscountPct: 5,
      });
      cashiers.push({ id: user.id, storeId: store.id });
    }
  }

  // Poznati demo blagajnik u prvoj poslovnici
  const demoCashier = await createUser({
    email: 'blagajna@trgovacki.hr', firstName: 'Luka', lastName: 'Jurić',
    roleCode: 'CASHIER', storeIds: [stores[0].id], maxDiscountPct: 5,
  });
  cashiers.push({ id: demoCashier.id, storeId: stores[0].id });

  console.log(`  ${cashiers.length + 4} korisnika`);

  // =========================================================================
  //  Katalog
  // =========================================================================
  console.log('▸ Katalog: kategorije, brendovi, dobavljači, artikli…');

  const categoryByCode = new Map<string, { id: string; margin: number }>();
  let sortOrder = 0;
  for (const parent of CATEGORY_TREE) {
    const created = await db.category.create({
      data: {
        tenantId: tenant.id, code: parent.code, name: parent.name,
        path: `/${parent.code}`, level: 0, sortOrder: sortOrder++,
        targetMarginPct: new Prisma.Decimal(parent.margin),
      },
    });
    categoryByCode.set(parent.code, { id: created.id, margin: parent.margin });

    for (const child of parent.children) {
      const sub = await db.category.create({
        data: {
          tenantId: tenant.id, parentId: created.id, code: child.code, name: child.name,
          path: `/${parent.code}/${child.code}`, level: 1, sortOrder: sortOrder++,
          targetMarginPct: new Prisma.Decimal(child.margin),
        },
      });
      categoryByCode.set(child.code, { id: sub.id, margin: child.margin });
    }
  }

  const brands = await Promise.all(
    BRANDS.map((name, i) =>
      db.brand.create({
        data: { tenantId: tenant.id, code: `B${String(i + 1).padStart(3, '0')}`, name },
      }),
    ),
  );

  const suppliers = await Promise.all(
    SUPPLIERS.map((s) =>
      db.supplier.create({
        data: {
          tenantId: tenant.id, code: s.code, name: s.name, legalName: s.name,
          vatId: String(intBetween(10000000000, 99999999999)),
          city: s.city, country: 'HR',
          postalCode: CITIES.find(([c]) => c === s.city)?.[1] ?? '10000',
          addressLine: `Ulica ${intBetween(1, 120)}`,
          email: `nabava@${s.code.toLowerCase()}.hr`,
          phone: `+385 ${intBetween(1, 53)} ${intBetween(2000000, 8999999)}`,
          contactPerson: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
          paymentTerms: s.terms, leadTimeDays: s.lead,
          minOrderValue: new Prisma.Decimal(intBetween(100, 1500)),
          discountPct: new Prisma.Decimal(round2(between(0, 8))),
          deliveryDays: ['MON', 'WED', 'FRI'],
        },
      }),
    ),
  );

  // --- Artikli ---------------------------------------------------------------
  interface SeedProduct {
    productId: string;
    variantId: string;
    sku: string;
    name: string;
    categoryId: string;
    taxRate: number;
    cost: number;
    price: number;
    isWeighted: boolean;
  }
  const catalog: SeedProduct[] = [];
  let skuCounter = 1000;

  for (const [catCode, template] of Object.entries(PRODUCT_TEMPLATES)) {
    const category = categoryByCode.get(catCode)!;
    const tax = taxByCode.get(template.tax)!;
    const taxRate = Number(tax.rate);

    for (const baseName of template.names) {
      // 1–3 varijante istog proizvoda (različiti brendovi) — realniji asortiman.
      const variantCount = chance(0.35) ? intBetween(2, 3) : 1;
      for (let v = 0; v < variantCount; v++) {
        const brand = pick(brands);
        const name = variantCount > 1 ? `${baseName} ${brand.name}` : baseName;
        const sku = String(++skuCounter);
        const price = round2(between(template.priceRange[0], template.priceRange[1]));
        const marginPct = category.margin + between(-6, 6);
        const netPrice = price / (1 + taxRate / 100);
        const cost = round2(Math.max(netPrice * (1 - marginPct / 100), netPrice * 0.35));
        const isWeighted = catCode === 'HR-VOC' && chance(0.4);

        const product = await db.product.create({
          data: {
            tenantId: tenant.id,
            sku,
            name,
            shortName: name.length > 22 ? `${name.slice(0, 21)}…` : name,
            type: isWeighted ? 'WEIGHTED' : 'STOCK',
            categoryId: category.id,
            brandId: brand.id,
            unitId: isWeighted ? unitKg.id : unitKom.id,
            taxRateId: tax.id,
            isSoldByWeight: isWeighted,
            ageRestriction: catCode === 'DU-CIG' || catCode === 'PI-ZES' ? 18 : null,
            allowDiscount: catCode !== 'DU-CIG',
            depositAmount: new Prisma.Decimal(
              catCode === 'PI-PIV' || catCode === 'PI-BEZ' ? (chance(0.5) ? 0.07 : 0) : 0,
            ),
            trackExpiry: ['HR-MLI', 'HR-MES', 'HR-PEK', 'DR-BEB'].includes(catCode),
            countryOfOrigin: chance(0.7) ? 'HR' : pick(['DE', 'IT', 'SI', 'AT', 'PL']),
            publishedWeb: chance(0.6),
            variants: {
              create: [
                {
                  sku,
                  name,
                  isDefault: true,
                  msrp: new Prisma.Decimal(round2(price * 1.05)),
                  weightGrams: new Prisma.Decimal(intBetween(50, 2000)),
                  barcodes: {
                    create: [{ code: ean13(`385${sku}${intBetween(10000, 99999)}`), type: 'EAN13', isPrimary: true }],
                  },
                },
              ],
            },
          },
          include: { variants: true },
        });

        const variant = product.variants[0];
        catalog.push({
          productId: product.id, variantId: variant.id, sku, name,
          categoryId: category.id, taxRate, cost, price, isWeighted,
        });

        // Veza s dobavljačem
        const supplier = pick(suppliers);
        await db.productSupplier.create({
          data: {
            productId: product.id, supplierId: supplier.id,
            supplierSku: `${supplier.code}-${sku}`,
            purchasePrice: new Prisma.Decimal(cost),
            discountPct: new Prisma.Decimal(round2(between(0, 6))),
            minOrderQty: new Prisma.Decimal(chance(0.3) ? 6 : 1),
            packQty: new Prisma.Decimal(chance(0.4) ? 12 : 1),
            isPrimary: true,
          },
        });
      }
    }
  }
  console.log(`  ${catalog.length} artikala`);

  // =========================================================================
  //  Cjenici
  // =========================================================================
  console.log('▸ Cjenici i akcije…');

  const retailList = await db.priceList.create({
    data: {
      tenantId: tenant.id, code: 'MPC', name: 'Maloprodajni cjenik', type: 'RETAIL',
      pricesIncludeTax: true, isDefault: true, priority: 0,
    },
  });
  const wholesaleList = await db.priceList.create({
    data: {
      tenantId: tenant.id, code: 'VPC', name: 'Veleprodajni cjenik', type: 'WHOLESALE',
      pricesIncludeTax: false, priority: 10,
    },
  });
  const vipList = await db.priceList.create({
    data: {
      tenantId: tenant.id, code: 'VIP', name: 'Cjenik VIP kupaca', type: 'CUSTOMER_GROUP',
      pricesIncludeTax: true, priority: 20,
    },
  });

  await db.priceListItem.createMany({
    data: catalog.map((p) => ({
      priceListId: retailList.id,
      variantId: p.variantId,
      price: new Prisma.Decimal(p.price),
      lowestPrice30d: new Prisma.Decimal(round2(p.price * between(0.9, 1))),
    })),
  });
  await db.priceListItem.createMany({
    data: catalog.map((p) => ({
      priceListId: wholesaleList.id,
      variantId: p.variantId,
      price: new Prisma.Decimal(round2((p.price / (1 + p.taxRate / 100)) * 0.92)),
    })),
  });
  await db.priceListItem.createMany({
    data: catalog
      .filter(() => chance(0.35))
      .map((p) => ({
        priceListId: vipList.id,
        variantId: p.variantId,
        price: new Prisma.Decimal(round2(p.price * 0.93)),
      })),
  });

  await db.store.updateMany({
    where: { tenantId: tenant.id },
    data: { priceListId: retailList.id },
  });

  // --- Akcije ----------------------------------------------------------------
  const now = new Date();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);
  const daysAhead = (d: number) => new Date(now.getTime() + d * 86_400_000);

  const promoDefs = [
    {
      code: 'VIKEND20', name: 'Vikend akcija −20% na slatko', type: 'PERCENT_OFF' as const,
      value: 20, categoryCode: 'HR-SLA', status: 'ACTIVE' as const,
      startsAt: daysAgo(4), endsAt: daysAhead(10), dayOfWeekMask: 96, priority: 10,
    },
    {
      code: 'KAVA2PLUS1', name: 'Kava 2+1 gratis', type: 'BUY_X_GET_Y' as const,
      value: 0, buyQty: 2, getQty: 1, categoryCode: 'PI-KAV', status: 'ACTIVE' as const,
      startsAt: daysAgo(14), endsAt: daysAhead(16), priority: 20,
    },
    {
      code: 'KOSARICA50', name: 'Popust 5% na košaricu iznad 50 €', type: 'BASKET_THRESHOLD' as const,
      value: 5, minBasketAmount: 50, status: 'ACTIVE' as const,
      startsAt: daysAgo(30), endsAt: daysAhead(60), priority: 1,
    },
    {
      code: 'MLIJEKO15', name: 'Mliječni program −15%', type: 'PERCENT_OFF' as const,
      value: 15, categoryCode: 'HR-MLI', status: 'ACTIVE' as const,
      startsAt: daysAgo(7), endsAt: daysAhead(7), priority: 15,
    },
    {
      code: 'HAPPYHOUR', name: 'Happy hour pekara −30% (nakon 19h)', type: 'PERCENT_OFF' as const,
      value: 30, categoryCode: 'HR-PEK', status: 'ACTIVE' as const,
      startsAt: daysAgo(60), endsAt: daysAhead(120), startTime: '19:00', endTime: '21:00', priority: 30,
    },
    {
      code: 'SVAKI3', name: 'Svaki 3. artikl iz drogerije −50%', type: 'NTH_ITEM_DISCOUNT' as const,
      value: 50, buyQty: 3, categoryCode: 'DR-HIG', status: 'ACTIVE' as const,
      startsAt: daysAgo(10), endsAt: daysAhead(20), priority: 12,
    },
    {
      code: 'ZIMA2026', name: 'Zimska rasprodaja tekstila −40%', type: 'PERCENT_OFF' as const,
      value: 40, categoryCode: 'KU-TEK', status: 'SCHEDULED' as const,
      startsAt: daysAhead(12), endsAt: daysAhead(45), priority: 8,
    },
    {
      code: 'PIVO6', name: 'Pivo — 6 kom po 4,99 €', type: 'BUNDLE_PRICE' as const,
      value: 4.99, buyQty: 6, categoryCode: 'PI-PIV', status: 'PAUSED' as const,
      startsAt: daysAgo(20), endsAt: daysAhead(5), priority: 18,
    },
  ];

  for (const def of promoDefs) {
    const promotion = await db.promotion.create({
      data: {
        tenantId: tenant.id,
        code: def.code,
        name: def.name,
        type: def.type,
        status: def.status,
        priority: def.priority,
        value: new Prisma.Decimal(def.value),
        buyQty: def.buyQty ? new Prisma.Decimal(def.buyQty) : null,
        getQty: def.getQty ? new Prisma.Decimal(def.getQty) : null,
        minBasketAmount: def.minBasketAmount ? new Prisma.Decimal(def.minBasketAmount) : null,
        dayOfWeekMask: def.dayOfWeekMask ?? null,
        startTime: def.startTime ?? null,
        endTime: def.endTime ?? null,
        startsAt: def.startsAt,
        endsAt: def.endsAt,
        channels: ['POS', 'WEB'],
      },
    });
    if (def.categoryCode) {
      await db.promotionTarget.create({
        data: { promotionId: promotion.id, categoryId: categoryByCode.get(def.categoryCode)!.id },
      });
    }
  }

  // =========================================================================
  //  Kupci i program vjernosti
  // =========================================================================
  console.log('▸ Kupci i program vjernosti…');

  const groups = await Promise.all([
    db.customerGroup.create({ data: { tenantId: tenant.id, code: 'MALO', name: 'Maloprodaja', discountPct: new Prisma.Decimal(0) } }),
    db.customerGroup.create({ data: { tenantId: tenant.id, code: 'VIP', name: 'VIP kupci', discountPct: new Prisma.Decimal(0), priceListId: vipList.id } }),
    db.customerGroup.create({ data: { tenantId: tenant.id, code: 'B2B', name: 'Poslovni kupci', discountPct: new Prisma.Decimal(5), priceListId: wholesaleList.id } }),
    db.customerGroup.create({ data: { tenantId: tenant.id, code: 'ZAP', name: 'Zaposlenici', discountPct: new Prisma.Decimal(10) } }),
  ]);

  const loyaltyProgram = await db.loyaltyProgram.create({
    data: {
      tenantId: tenant.id, code: 'DELTA', name: 'Delta klub',
      pointsPerUnit: new Prisma.Decimal(1), redeemValue: new Prisma.Decimal(0.01),
      minRedeemPoints: 200, expiryMonths: 24,
      tiers: {
        create: [
          { code: 'BRONCA', name: 'Bronca', minSpend: new Prisma.Decimal(0), discountPct: new Prisma.Decimal(0), pointsMultiplier: new Prisma.Decimal(1), color: '#a97142', sortOrder: 1 },
          { code: 'SREBRO', name: 'Srebro', minSpend: new Prisma.Decimal(500), discountPct: new Prisma.Decimal(2), pointsMultiplier: new Prisma.Decimal(1.25), color: '#9aa0a6', sortOrder: 2 },
          { code: 'ZLATO', name: 'Zlato', minSpend: new Prisma.Decimal(2000), discountPct: new Prisma.Decimal(4), pointsMultiplier: new Prisma.Decimal(1.5), color: '#d4a017', sortOrder: 3 },
          { code: 'PLATINA', name: 'Platina', minSpend: new Prisma.Decimal(6000), discountPct: new Prisma.Decimal(6), pointsMultiplier: new Prisma.Decimal(2), color: '#5f6b7a', sortOrder: 4 },
        ],
      },
    },
    include: { tiers: true },
  });
  const tiers = loyaltyProgram.tiers.sort((a, b) => Number(a.minSpend) - Number(b.minSpend));

  const customers: { id: string; groupId: string }[] = [];
  for (let i = 0; i < 180; i++) {
    const isBusiness = i < 20;
    const [city, zip] = pick(CITIES);
    const first = pick(FIRST_NAMES);
    const last = pick(LAST_NAMES);
    const group = isBusiness ? groups[2] : chance(0.2) ? groups[1] : groups[0];
    const spent = round2(between(0, 9000));

    const customer = await db.customer.create({
      data: {
        tenantId: tenant.id,
        groupId: group.id,
        code: `K${String(i + 1).padStart(5, '0')}`,
        type: isBusiness ? 'BUSINESS' : 'RETAIL',
        firstName: isBusiness ? null : first,
        lastName: isBusiness ? null : last,
        companyName: isBusiness ? COMPANY_NAMES[i % COMPANY_NAMES.length] : null,
        vatId: isBusiness ? String(intBetween(10000000000, 99999999999)) : null,
        email: isBusiness
          ? `racuni@tvrtka${i}.hr`
          : `${first.toLowerCase()}.${last.toLowerCase().replace(/[čćžšđ]/g, 'c')}${i}@email.hr`,
        phone: `+385 9${intBetween(1, 9)} ${intBetween(1000000, 9999999)}`,
        city, postalCode: zip, addressLine: `Ulica ${pick(LAST_NAMES)} ${intBetween(1, 90)}`,
        birthDate: isBusiness ? null : new Date(intBetween(1955, 2005), intBetween(0, 11), intBetween(1, 28)),
        creditLimit: new Prisma.Decimal(isBusiness ? intBetween(1000, 15000) : 0),
        paymentTerms: isBusiness ? pick([15, 30, 45]) : 0,
        totalSpent: new Prisma.Decimal(spent),
        orderCount: intBetween(0, 120),
        marketingOptIn: chance(0.6),
        gdprConsentAt: daysAgo(intBetween(30, 700)),
      },
    });
    customers.push({ id: customer.id, groupId: group.id });

    if (!isBusiness && chance(0.75)) {
      const tier = [...tiers].reverse().find((t) => spent >= Number(t.minSpend)) ?? tiers[0];
      await db.loyaltyCard.create({
        data: {
          programId: loyaltyProgram.id,
          customerId: customer.id,
          tierId: tier.id,
          cardNumber: `98${String(intBetween(10000000, 99999999))}${i}`,
          points: intBetween(0, 4000),
          lifetimePoints: Math.floor(spent),
        },
      });
    }
  }

  await db.giftCard.createMany({
    data: Array.from({ length: 24 }, (_, i) => {
      const amount = pick([10, 20, 25, 50, 100]);
      return {
        tenantId: tenant.id,
        code: `GC${String(100000 + i * 7)}`,
        initialAmount: new Prisma.Decimal(amount),
        balance: new Prisma.Decimal(chance(0.4) ? round2(amount * between(0, 0.9)) : amount),
        expiresAt: daysAhead(intBetween(60, 720)),
      };
    }),
  });

  console.log(`  ${customers.length} kupaca`);

  return {
    tenant, company, stores, catalog, suppliers, customers, cashiers,
    paymentMethods, cashMethod, cardMethod, taxByCode, categoryByCode,
    owner, chainManager, demoCashier, retailList,
  };
}

main()
  .then(async (ctx) => {
    const { seedOperations } = await import('./seed-operations');
    await seedOperations(db, ctx);
    console.log('\n✓ Demo podaci su spremni.');
    console.log('  Prijava: vlasnik@trgovacki.hr / demo1234');
  })
  .catch((error) => {
    console.error('\n✗ Punjenje podataka nije uspjelo:\n', error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
