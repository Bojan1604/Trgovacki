'use client';

import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Ispis trenutne stranice.
 *
 * Ispis traži preglednik, pa gumb mora biti na klijentu; stranice koje ga
 * koriste su poslužiteljske. Sam gumb i navigacija ne idu na papir — skriva
 * ih razred `no-print`.
 */
export function PrintButton({
  children = 'Ispis',
  variant = 'secondary',
}: {
  children?: string;
  variant?: 'secondary' | 'ghost' | 'primary';
}) {
  return (
    <Button
      size="sm"
      variant={variant}
      className="no-print"
      icon={<Printer className="size-3.5" />}
      onClick={() => window.print()}
    >
      {children}
    </Button>
  );
}
