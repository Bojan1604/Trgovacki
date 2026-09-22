import Link from 'next/link';
import { FileQuestion } from 'lucide-react';

export const metadata = { title: 'Stranica ne postoji' };

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-surface-2 p-6">
      <div className="w-full max-w-[360px] rounded-xl bg-surface p-5 text-center shadow-[var(--shadow-card)]">
        <div className="mx-auto mb-3 grid size-11 place-items-center rounded-2xl bg-surface-2 text-ink-3">
          <FileQuestion className="size-5" />
        </div>
        <h1 className="text-lg font-semibold tracking-tight">Stranica ne postoji</h1>
        <p className="mt-1.5 text-sm text-ink-3">Adresa je pogrešna ili je sadržaj uklonjen.</p>
        <Link
          href="/"
          className="mt-4 flex h-8 items-center justify-center rounded-md bg-ink text-surface text-base font-medium transition-opacity hover:opacity-90"
        >
          Natrag na početnu
        </Link>
      </div>
    </div>
  );
}
