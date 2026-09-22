import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { apiError } from '@/lib/api';

/** Globalna pretraga za paletu naredbi (⌘K). */
export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const q = new URL(request.url).searchParams.get('q')?.trim() ?? '';
    if (q.length < 2) return NextResponse.json({ hits: [] });

    const [products, customers, sales] = await Promise.all([
      db.product.findMany({
        where: {
          tenantId: user.tenantId,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { sku: { contains: q, mode: 'insensitive' } },
            { variants: { some: { barcodes: { some: { code: { startsWith: q } } } } } },
          ],
        },
        select: { id: true, sku: true, name: true, category: { select: { name: true } } },
        take: 6,
      }),
      db.customer.findMany({
        where: {
          tenantId: user.tenantId,
          OR: [
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName: { contains: q, mode: 'insensitive' } },
            { companyName: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q } },
            { vatId: { startsWith: q } },
          ],
        },
        select: { id: true, code: true, firstName: true, lastName: true, companyName: true, city: true },
        take: 5,
      }),
      db.sale.findMany({
        where: { tenantId: user.tenantId, number: { contains: q, mode: 'insensitive' } },
        select: { id: true, number: true, total: true, issuedAt: true, store: { select: { name: true } } },
        orderBy: { issuedAt: 'desc' },
        take: 5,
      }),
    ]);

    const hits = [
      ...products.map((p) => ({
        type: 'product' as const,
        id: p.id,
        title: p.name,
        subtitle: `${p.sku}${p.category ? ` · ${p.category.name}` : ''}`,
        href: `/catalog/products/${p.id}`,
      })),
      ...customers.map((c) => ({
        type: 'customer' as const,
        id: c.id,
        title: c.companyName || `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || c.code,
        subtitle: [c.code, c.city].filter(Boolean).join(' · '),
        href: `/customers/${c.id}`,
      })),
      ...sales.map((s) => ({
        type: 'sale' as const,
        id: s.id,
        title: `Račun ${s.number}`,
        subtitle: `${s.store.name} · ${Number(s.total).toFixed(2)} EUR`,
        href: `/sales/receipts/${s.id}`,
      })),
    ];

    return NextResponse.json({ hits });
  } catch (error) {
    return apiError(error);
  }
}
