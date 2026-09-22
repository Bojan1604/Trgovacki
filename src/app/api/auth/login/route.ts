import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { audit } from '@/lib/audit';
import { createSession, verifyPassword } from '@/lib/auth';

const schema = z.object({
  email: z.string().email('Neispravna e-pošta.'),
  password: z.string().min(1, 'Unesite lozinku.'),
});

const MAX_ATTEMPTS = 8;
const LOCK_MINUTES = 15;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Neispravan zahtjev.' }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase().trim();
  const user = await db.user.findFirst({
    where: { email },
    include: { tenant: { select: { status: true } } },
  });

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const userAgent = request.headers.get('user-agent');

  // Ista poruka za nepostojećeg korisnika i krivu lozinku — bez otkrivanja postojanja računa.
  const generic = { error: 'Neispravna e-pošta ili lozinka.' };

  if (!user) return NextResponse.json(generic, { status: 401 });

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return NextResponse.json(
      { error: `Račun je privremeno zaključan. Pokušajte ponovno za nekoliko minuta.` },
      { status: 423 },
    );
  }

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);

  if (!valid) {
    const attempts = user.failedLoginCount + 1;
    await db.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: attempts,
        lockedUntil: attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
      },
    });
    await audit({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'LOGIN_FAILED',
      entityType: 'user',
      entityId: user.id,
      summary: `Neuspješna prijava (${attempts}. pokušaj)`,
      ipAddress: ip,
      userAgent,
    });
    return NextResponse.json(generic, { status: 401 });
  }

  if (user.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Korisnički račun nije aktivan.' }, { status: 403 });
  }
  if (user.tenant.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Organizacija je neaktivna. Kontaktirajte podršku.' }, { status: 403 });
  }

  await db.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  await createSession(user.id, { ip: ip ?? undefined, userAgent: userAgent ?? undefined, storeId: user.defaultStoreId });

  await audit({
    tenantId: user.tenantId,
    userId: user.id,
    action: 'LOGIN',
    entityType: 'user',
    entityId: user.id,
    summary: 'Prijava u sustav',
    ipAddress: ip,
    userAgent,
  });

  return NextResponse.json({ ok: true, mustChangePassword: user.mustChangePassword });
}
