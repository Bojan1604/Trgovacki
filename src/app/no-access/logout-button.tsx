'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Odjava s ove stranice — ruta vraća JSON, pa preusmjeravamo iz preglednika. */
export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
        router.refresh();
      }}
      className="mt-3 h-8 w-full rounded-md bg-ink text-surface text-base font-medium transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {busy ? 'Odjava…' : 'Odjava'}
    </button>
  );
}
