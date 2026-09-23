import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { apiError, readJson } from '@/lib/api';
import { audit } from '@/lib/audit';

const schema = z.object({
  code: z.string().min(1, 'Šifra je obavezna.').max(20),
  name: z.string().min(2, 'Naziv je prekratak.').max(120),
  parentId: z.string().optional(),
  description: z.string().max(500).optional(),
  targetMarginPct: z.number().min(0).max(99.99).optional(),
  isActive: z.boolean().optional(),
});

/** Najdublja razina stabla; dublje od toga izbornik blagajne postaje nepregledan. */
const MAX_LEVEL = 3;

export async function POST(request: Request) {
  try {
    const user = await requirePermission('category.manage');
    const body = await readJson(request, schema);
    const code = body.code.trim().toUpperCase();

    let parent = null;
    if (body.parentId) {
      parent = await db.category.findFirst({
        where: { id: body.parentId, tenantId: user.tenantId },
        select: { id: true, path: true, level: true },
      });
      if (!parent) return NextResponse.json({ error: 'Nadređena kategorija ne postoji.' }, { status: 404 });
      if (parent.level + 1 > MAX_LEVEL) {
        return NextResponse.json(
          { error: `Stablo ide najviše ${MAX_LEVEL + 1} razine u dubinu.` },
          { status: 422 },
        );
      }
    }

    // Putanja se gradi od šifri, kao i u punjenju podataka — čita se i bez spajanja tablica.
    const category = await db.category.create({
      data: {
        tenantId: user.tenantId,
        parentId: parent?.id ?? null,
        code,
        name: body.name.trim(),
        description: body.description?.trim() || null,
        path: parent ? `${parent.path}/${code}` : `/${code}`,
        level: parent ? parent.level + 1 : 0,
        targetMarginPct:
          body.targetMarginPct === undefined ? null : new Prisma.Decimal(body.targetMarginPct),
        isActive: body.isActive ?? true,
      },
    });

    await audit({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'CREATE',
      entityType: 'category',
      entityId: category.id,
      summary: `Kreirana kategorija ${category.code} · ${category.name}`,
    });

    return NextResponse.json({ id: category.id, code: category.code, name: category.name });
  } catch (error) {
    return apiError(error);
  }
}
