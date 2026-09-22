'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw } from 'lucide-react';

/**
 * Zadnja obrana prikaza.
 *
 * Bez nje svaka neuhvaćena greška na poslužitelju završi kao Next.js stranica
 * s greškom, što krajnjem korisniku ne znači ništa. Poruka se u produkciji
 * namjerno ne prikazuje — Next je ondje ionako ne šalje pregledniku.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="grid min-h-screen place-items-center bg-surface-2 p-6">
      <div className="w-full max-w-[400px] rounded-xl bg-surface p-5 text-center shadow-[var(--shadow-card)]">
        <div className="mx-auto mb-3 grid size-11 place-items-center rounded-2xl bg-warning-soft text-warning">
          <AlertTriangle className="size-5" />
        </div>
        <h1 className="text-lg font-semibold tracking-tight">Došlo je do pogreške</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-3">
          Radnju nije bilo moguće dovršiti. Pokušajte ponovno — ako se ponovi, javite
          administratoru uz oznaku ispod.
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-2xs text-ink-4">Oznaka: {error.digest}</p>
        )}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={reset}
            className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md bg-ink text-surface text-base font-medium transition-opacity hover:opacity-90"
          >
            <RotateCcw className="size-3.5" />
            Pokušaj ponovno
          </button>
          <Link
            href="/"
            className="flex h-8 flex-1 items-center justify-center rounded-md bg-surface-2 text-base font-medium text-ink-2 transition-colors hover:bg-surface-3"
          >
            Početna
          </Link>
        </div>
      </div>
    </div>
  );
}
