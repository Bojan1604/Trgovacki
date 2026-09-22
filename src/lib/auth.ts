import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { db } from './db';
import { env } from './env';
import { hasPermission } from './permissions';

import { SESSION_COOKIE, STORE_COOKIE } from './auth-constants';

export { SESSION_COOKIE, STORE_COOKIE };

export interface SessionUser {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  initials: string;
  isSuperAdmin: boolean;
  permissions: string[];
  roles: { code: string; name: string }[];
  storeIds: string[];
  activeStoreId: string | null;
  maxDiscountPct: number;
  currency: string;
}

const secret = () => new TextEncoder().encode(env().AUTH_SECRET);

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

/** Kreira DB sesiju + potpisani JWT koji ide u httpOnly kolačić. */
export async function createSession(userId: string, meta: { ip?: string; userAgent?: string; storeId?: string | null }) {
  const raw = randomBytes(32).toString('hex');
  const ttlHours = env().SESSION_TTL_HOURS;
  const expiresAt = new Date(Date.now() + ttlHours * 3600_000);

  await db.session.create({
    data: {
      userId,
      tokenHash: hashToken(raw),
      ipAddress: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
      storeId: meta.storeId ?? null,
      expiresAt,
    },
  });

  const jwt = await new SignJWT({ sid: raw, uid: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secret());

  const store = await cookies();
  store.set(SESSION_COOKIE, jwt, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });

  return { raw, expiresAt };
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secret());
      const sid = payload.sid as string;
      await db.session.updateMany({
        where: { tokenHash: hashToken(sid), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } catch {
      /* istekao ili neispravan token — svejedno brišemo kolačić */
    }
  }
  store.delete(SESSION_COOKIE);
}

/** Vraća prijavljenog korisnika ili null. Rezultat se ne kešira između zahtjeva. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  let sid: string;
  try {
    const { payload } = await jwtVerify(token, secret());
    sid = payload.sid as string;
  } catch {
    return null;
  }

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(sid) },
    include: {
      user: {
        include: {
          tenant: true,
          roles: { include: { role: true } },
          storeAccess: true,
        },
      },
    },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  const user = session.user;
  if (user.status !== 'ACTIVE') return null;

  const permissions = user.isSuperAdmin
    ? ['*']
    : Array.from(new Set(user.roles.flatMap((r) => r.role.permissions)));

  const storeIds = user.storeAccess.map((a) => a.storeId);
  const cookieStoreId = cookieStore.get(STORE_COOKIE)?.value ?? null;
  const activeStoreId =
    (cookieStoreId && (storeIds.includes(cookieStoreId) || user.isSuperAdmin) ? cookieStoreId : null) ??
    session.storeId ??
    user.defaultStoreId ??
    storeIds[0] ??
    null;

  return {
    id: user.id,
    tenantId: user.tenantId,
    tenantName: user.tenant.name,
    tenantSlug: user.tenant.slug,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: `${user.firstName} ${user.lastName}`.trim(),
    initials: `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase(),
    isSuperAdmin: user.isSuperAdmin,
    permissions,
    roles: user.roles.map((r) => ({ code: r.role.code, name: r.role.name })),
    storeIds,
    activeStoreId,
    maxDiscountPct: user.maxDiscountPct.toNumber(),
    currency: user.tenant.baseCurrency,
  };
}

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: number = 401,
  ) {
    super(message);
  }
}

/** Za server komponente i API rute — baca AuthError ako korisnik nije prijavljen. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError('Niste prijavljeni.', 401);
  return user;
}

export async function requirePermission(permission: string): Promise<SessionUser> {
  const user = await requireUser();
  if (!hasPermission(user.permissions, permission)) {
    throw new AuthError(`Nemate pravo pristupa: ${permission}`, 403);
  }
  return user;
}

/** Poslovnice koje korisnik smije vidjeti; super-admin vidi sve u tenantu. */
export async function accessibleStoreIds(user: SessionUser): Promise<string[]> {
  if (user.isSuperAdmin || hasPermission(user.permissions, 'store.manage')) {
    const stores = await db.store.findMany({
      where: { tenantId: user.tenantId },
      select: { id: true },
    });
    return stores.map((s) => s.id);
  }
  return user.storeIds;
}
