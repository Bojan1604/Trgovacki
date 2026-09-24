'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Izvoz prikazane tablice u CSV.
 *
 * Čita tablicu iz prikaza, pa izvozi točno ono što je na ekranu — uključujući
 * primijenjene filtre, ali i samo trenutnu stranicu rezultata. Zato natpis
 * govori „prikazano", da nitko ne pomisli da je dobio cijeli skup.
 */
export function ExportButton({
  filename,
  label = 'Izvoz prikazanog',
}: {
  filename: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);

  function exportCsv() {
    setBusy(true);
    try {
      const table = document.querySelector('main table');
      if (!table) return;

      const cell = (el: Element) => {
        const text = (el as HTMLElement).innerText.replace(/\s+/g, ' ').trim();
        // Navodnici se udvostručuju; polje se citira kad sadrži separator.
        return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
      };

      const rows = [...table.querySelectorAll('tr')]
        .map((tr) => [...tr.querySelectorAll('th, td')].map(cell).join(';'))
        .filter((line) => line.replace(/;/g, '').trim().length > 0);

      // BOM da Excel na Windowsu prepozna UTF-8 i dijakritiku.
      const blob = new Blob([`﻿${rows.join('\r\n')}`], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      size="sm"
      variant="secondary"
      className="no-print"
      loading={busy}
      icon={<Download className="size-3.5" />}
      onClick={exportCsv}
    >
      {label}
    </Button>
  );
}
