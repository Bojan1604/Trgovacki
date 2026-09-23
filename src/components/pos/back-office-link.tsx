'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

const STYLE =
  'flex items-center gap-1 rounded-md px-1.5 py-1 text-sm text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink';

/**
 * Izlaz iz blagajne.
 *
 * Blagajna zauzima cijeli ekran i nema navigaciju back officea, pa bez ovoga
 * korisnik na zaslonu otvaranja smjene nema kamo — ni naprijed ni natrag.
 * Kad korisnik nema nijednu stranicu izvan blagajne, jedini smislen izlaz je
 * odjava.
 */
export function BackOfficeLink({ href, className }: { href: string | null; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (href) {
    return (
      <Link href={href} className={cn(STYLE, className)}>
        <ArrowLeft className="size-3.5" /> Back office
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      className={cn(STYLE, 'disabled:opacity-60', className)}
      onClick={async () => {
        setBusy(true);
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
        router.refresh();
      }}
    >
      <LogOut className="size-3.5" /> {busy ? 'Odjava…' : 'Odjava'}
    </button>
  );
}
