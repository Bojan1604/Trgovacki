import { formatAmount, formatDateTime } from '@/lib/format';
import type { CompletedSale } from './types';

/** Potvrda o izdanom računu s fiskalnim podacima. */
export function ReceiptView({
  sale,
  store,
  operator,
}: {
  sale: CompletedSale;
  store: { name: string; code: string; company: { legalName: string; vatId: string; addressLine: string | null; city: string | null; invoiceFooter: string | null } };
  operator: string;
}) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-positive-soft">
        <svg viewBox="0 0 24 24" className="size-6 text-positive" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>

      <p className="text-2xl font-semibold tracking-tight tnum">{formatAmount(sale.total)} €</p>
      {sale.change > 0 && (
        <p className="mt-0.5 text-md text-ink-2">
          Povrat: <b className="tnum">{formatAmount(sale.change)} €</b>
        </p>
      )}

      <div className="mt-3 rounded-lg bg-surface-2 p-2.5 text-left font-mono text-xs leading-relaxed">
        <p className="text-center font-sans text-sm font-semibold">{store.company.legalName}</p>
        <p className="text-center font-sans text-2xs text-ink-3">
          {store.company.addressLine}, {store.company.city} · OIB {store.company.vatId}
        </p>
        <div className="my-1.5 border-t border-dashed border-hairline-strong" />
        <p>Račun: {sale.number}</p>
        <p>Vrijeme: {formatDateTime(sale.issuedAt)}</p>
        <p>Prodavač: {operator}</p>
        {sale.fiscalJir && <p className="mt-1 break-all">JIR: {sale.fiscalJir}</p>}
        {sale.fiscalZki && <p className="break-all">ZKI: {sale.fiscalZki}</p>}
        {!sale.fiscalJir && (
          <p className="mt-1 text-ink-4">Fiskalizacija nije aktivirana u ovom okruženju.</p>
        )}
        {store.company.invoiceFooter && (
          <>
            <div className="my-1.5 border-t border-dashed border-hairline-strong" />
            <p className="text-center font-sans text-2xs text-ink-3">{store.company.invoiceFooter}</p>
          </>
        )}
      </div>
    </div>
  );
}
