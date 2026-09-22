import { NextResponse } from 'next/server';
import { destroySession, getSessionUser } from '@/lib/auth';
import { audit } from '@/lib/audit';

export async function POST() {
  const user = await getSessionUser();
  if (user) {
    await audit({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'LOGOUT',
      entityType: 'user',
      entityId: user.id,
      summary: 'Odjava iz sustava',
    });
  }
  await destroySession();
  return NextResponse.json({ ok: true });
}
