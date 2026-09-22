import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AuthError } from './auth';
import { StockError } from './services/inventory';
import { CheckoutError } from './services/sales';
import { RefundError } from './services/refunds';
import { ShiftError } from './services/shifts';

/**
 * Jedinstveno pretvaranje grešaka u HTTP odgovor.
 * Poruke su na hrvatskom i namijenjene krajnjem korisniku;
 * tehnički detalji ostaju u logovima poslužitelja.
 */
export function apiError(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: 'Podaci nisu ispravni.',
        fields: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
      { status: 422 },
    );
  }

  if (
    error instanceof StockError ||
    error instanceof CheckoutError ||
    error instanceof RefundError ||
    error instanceof ShiftError
  ) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: 409 });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const target = (error.meta?.target as string[] | undefined)?.join(', ') ?? 'vrijednost';
      return NextResponse.json({ error: `Zapis s istom vrijednošću već postoji (${target}).` }, { status: 409 });
    }
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Zapis nije pronađen.' }, { status: 404 });
    }
    if (error.code === 'P2003') {
      return NextResponse.json(
        { error: 'Zapis se ne može obrisati jer je povezan s drugim dokumentima.' },
        { status: 409 },
      );
    }
  }

  console.error('[api] neuhvaćena greška', error);
  return NextResponse.json({ error: 'Došlo je do neočekivane greške.' }, { status: 500 });
}

/** Čitanje i validacija JSON tijela zahtjeva. */
export async function readJson<T>(request: Request, schema: { parse: (input: unknown) => T }): Promise<T> {
  const body = await request.json().catch(() => {
    throw new ZodError([{ code: 'custom', path: [], message: 'Tijelo zahtjeva nije ispravan JSON.' }]);
  });
  return schema.parse(body);
}

/** Straničenje iz query stringa s razumnim granicama. */
export function readPaging(url: string, defaultSize = 50) {
  const params = new URL(url).searchParams;
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(params.get('pageSize') ?? defaultSize) || defaultSize));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}
