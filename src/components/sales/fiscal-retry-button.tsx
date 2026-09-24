'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

/** Ponovno slanje računa zaostalih u redu za fiskalizaciju. */
export function FiscalRetryButton({ count }: { count: number }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  return (
    <Button
      size="sm"
      variant="primary"
      disabled={count === 0}
      loading={busy}
      icon={<RefreshCw className="size-3.5" />}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await fetch('/api/sales/fiscal/retry', { method: 'POST' });
          const data = await res.json();
          if (!res.ok) {
            toast.error(data.error ?? 'Ponovno slanje nije uspjelo.');
            return;
          }
          if (data.processed === 0) toast.info('Nema računa za slanje.');
          else if (data.failed === 0) toast.success(`Poslano ${data.sent} računa.`);
          else toast.warning(`Poslano ${data.sent}, nije ${data.failed}. U redu ostaje ${data.left}.`);
          router.refresh();
        } catch {
          toast.error('Poslužitelj nije dostupan.');
        } finally {
          setBusy(false);
        }
      }}
    >
      Ponovi slanje ({count})
    </Button>
  );
}
