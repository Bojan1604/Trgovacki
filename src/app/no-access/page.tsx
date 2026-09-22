import { redirect } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { getSessionUser } from '@/lib/auth';
import { landingPath, NO_ACCESS_PATH } from '@/lib/landing';
import { PERMISSION_LABELS } from '@/lib/permissions';
import { LogoutButton } from './logout-button';

export const metadata = { title: 'Nema pristupa' };
export const dynamic = 'force-dynamic';

/** Korisnik je prijavljen, ali njegova rola ne otvara nijednu stranicu. */
export default async function NoAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ trazeno?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  // Ako je u međuvremenu dobio prava, ne zadržavamo ga ovdje.
  const landing = landingPath(user.permissions);
  if (landing !== NO_ACCESS_PATH) redirect(landing);

  const params = await searchParams;
  const requested = params.trazeno ? (PERMISSION_LABELS[params.trazeno] ?? params.trazeno) : null;

  return (
    <div className="grid min-h-screen place-items-center bg-surface-2 p-6">
      <div className="w-full max-w-[380px] rounded-xl bg-surface p-5 text-center shadow-[var(--shadow-card)]">
        <div className="mx-auto mb-3 grid size-11 place-items-center rounded-2xl bg-negative-soft text-negative">
          <ShieldAlert className="size-5" />
        </div>
        <h1 className="text-lg font-semibold tracking-tight">Nemate pravo pristupa</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-3">
          Vaša rola trenutno ne otvara nijednu stranicu u sustavu.
          {requested && (
            <>
              {' '}
              Traženo pravo: <span className="font-medium text-ink-2">{requested}</span>.
            </>
          )}
        </p>
        <p className="mt-3 text-sm text-ink-3">
          Obratite se administratoru da vam dodijeli potrebna prava.
        </p>
        <p className="mt-4 text-2xs text-ink-4">
          Prijavljeni ste kao {user.fullName} ({user.email}).
        </p>
        <LogoutButton />
      </div>
    </div>
  );
}
