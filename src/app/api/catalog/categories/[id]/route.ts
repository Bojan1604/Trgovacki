import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { apiError, readJson } from '@/lib/api';
import { audit } from '@/lib/audit';

const schema = z.object({
  code: z.string().min(1).max(20).optional(),
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(500).optional(),
  targetMarginPct: z.number().min(0).max(99.99).nullable().optional(),
  isActive: z.boolean().optional(),
});

/**
 * Izmjena kategorije.
 *
 * Nadređena kategorija se ne mijenja: putanja je materijalizirana i premještanje
 * bi tražilo prepisivanje cijele grane. Kategorija se umjesto toga deaktivira i
 * otvori nova na pravom mjestu.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('category.manage');
    const { id } = await context.params;
    const body = await readJson(request, schema);

    const category = await db.category.findFirst({
      where: { id, tenantId: user.tenantId },
      select: { id: true, code: true, path: true },
    });
    if (!category) return NextResponse.json({ error: 'Kategorija ne postoji.' }, { status: 404 });

    const newCode = body.code?.trim().toUpperCase();

    const updated = await db.$transaction(async (tx) => {
      const result = await tx.category.update({
        where: { id: category.id },
        data: {
          code: newCode,
          name: body.name?.trim(),
          description: body.description === undefined ? undefined : body.description.trim() || null,
          targetMarginPct:
            body.targetMarginPct === undefined
              ? undefined
              : body.targetMarginPct === null
                ? null
                : new Prisma.Decimal(body.targetMarginPct),
          isActive: body.isActive,
        },
      });

      // Promjena šifre mijenja putanju i svim potomcima.
      if (newCode && newCode !== category.code) {
        const oldPath = category.path;
        const newPath = `${oldPath.slice(0, oldPath.lastIndexOf('/'))}/${newCode}`;
        await tx.category.update({ where: { id: category.id }, data: { path: newPath } });
        const descendants = await tx.category.findMany({
          where: { tenantId: user.tenantId, path: { startsWith: `${oldPath}/` } },
          select: { id: true, path: true },
        });
        for (const child of descendants) {
          await tx.category.update({
            where: { id: child.id },
            data: { path: `${newPath}${child.path.slice(oldPath.length)}` },
          });
        }
      }

      return result;
    });

    await audit({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'UPDATE',
      entityType: 'category',
      entityId: updated.id,
      summary: `Izmijenjena kategorija ${newCode ?? updated.code} · ${updated.name}`,
    });

    return NextResponse.json({ id: updated.id, code: newCode ?? updated.code, name: updated.name });
  } catch (error) {
    return apiError(error);
  }
}
