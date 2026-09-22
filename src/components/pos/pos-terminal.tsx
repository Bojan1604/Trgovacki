'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Barcode, Check, ChevronLeft, Loader2, Minus, Pause, Percent, Play, Plus,
  Printer, RotateCcw, Search, ShoppingBasket, Trash2, User, X,
} from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Badge, KeyHint } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/overlay';
import { useToast } from '@/components/ui/toast';
import { formatAmount, formatQty, formatTime } from '@/lib/format';
import { roundAmount } from '@/lib/money';
import { cn } from '@/lib/utils';
import { ShiftGate } from './shift-gate';
import { CustomerPanel } from './customer-panel';
import { PaymentPanel, type DraftPayment } from './payment-panel';
import { CloseShiftPanel } from './close-shift-panel';
import { RefundPanel } from './refund-panel';
import { ReceiptView } from './receipt-view';
import { Numpad, numpadValue } from './numpad';
import type { CartLine, CompletedSale, PosCustomer, PosProduct, PosSession, Quote } from './types';

let lineCounter = 0;
const nextKey = () => `L${++lineCounter}-${Date.now().toString(36)}`;

export function PosTerminal({
  storeId,
  categories,
  operator,
}: {
  storeId: string;
  categories: { id: string; name: string; code: string }[];
  operator: { id: string; name: string; initials: string };
}) {
  const toast = useToast();
  const [session, setSession] = useState<PosSession | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState<PosCustomer | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);

  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [closeShiftOpen, setCloseShiftOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [parkedOpen, setParkedOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [qtyOpen, setQtyOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [lastSale, setLastSale] = useState<CompletedSale | null>(null);

  const [discountInput, setDiscountInput] = useState('');
  const [qtyInput, setQtyInput] = useState('');

  const barcodeRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const quoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ---------------------------------------------------------------------- */
  /*  Sesija blagajne                                                        */
  /* ---------------------------------------------------------------------- */

  const loadSession = useCallback(async () => {
    setLoadingSession(true);
    try {
      const res = await fetch(`/api/pos/session?storeId=${storeId}`);
      const data = await res.json();
      if (res.ok) setSession(data);
      else toast.error('Blagajnu nije moguće učitati', data.error);
    } finally {
      setLoadingSession(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  /* ---------------------------------------------------------------------- */
  /*  Pretraga artikala                                                      */
  /* ---------------------------------------------------------------------- */

  const loadProducts = useCallback(
    async (term: string, categoryId: string | null) => {
      setSearching(true);
      try {
        const url = new URL('/api/pos/products', window.location.origin);
        url.searchParams.set('storeId', storeId);
        if (term) url.searchParams.set('q', term);
        if (categoryId) url.searchParams.set('category', categoryId);
        const res = await fetch(url.toString());
        const data = await res.json();
        setProducts(data.items ?? []);
        return data as { items: PosProduct[]; embedded: { quantity: number | null; price: number | null } | null; exactMatch: boolean };
      } finally {
        setSearching(false);
      }
    },
    [storeId],
  );

  useEffect(() => {
    void loadProducts('', null);
  }, [loadProducts]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      void loadProducts(search.trim(), category);
    }, 180);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [search, category, loadProducts]);

  /* ---------------------------------------------------------------------- */
  /*  Košarica                                                               */
  /* ---------------------------------------------------------------------- */

  const addProduct = useCallback((product: PosProduct, quantity = 1) => {
    // Upozorenje odmah pri dodavanju — bolje nego odbijena naplata na kraju.
    if (product.stock !== null && product.stock <= 0) {
      toast.warning('Artikl nema zalihe', `${product.name} — provjerite stanje prije naplate.`);
    }
    setCart((prev) => {
      // Isti artikl bez ručnog popusta se zbraja u postojeću stavku.
      const existing = prev.find((l) => l.variantId === product.variantId && l.discountPct === 0 && !l.isWeighted);
      if (existing && !product.isWeighted) {
        return prev.map((l) =>
          l.key === existing.key ? { ...l, quantity: roundAmount(l.quantity + quantity) } : l,
        );
      }
      const line: CartLine = {
        key: nextKey(),
        variantId: product.variantId,
        sku: product.sku,
        name: product.name,
        unit: product.unit,
        quantity,
        unitPrice: product.price,
        basePrice: product.price,
        discountPct: 0,
        isWeighted: product.isWeighted,
        ageRestriction: product.ageRestriction,
        allowDiscount: product.allowDiscount,
      };
      setSelectedKey(line.key);
      return [...prev, line];
    });
  }, []);

  const updateLine = (key: string, patch: Partial<CartLine>) => {
    setCart((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const removeLine = (key: string) => {
    setCart((prev) => prev.filter((l) => l.key !== key));
    setSelectedKey((current) => (current === key ? null : current));
  };

  const clearCart = () => {
    setCart([]);
    setCustomer(null);
    setQuote(null);
    setSelectedKey(null);
  };

  /* ---------------------------------------------------------------------- */
  /*  Izračun košarice                                                       */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (cart.length === 0) {
      setQuote(null);
      return;
    }
    if (quoteTimer.current) clearTimeout(quoteTimer.current);
    quoteTimer.current = setTimeout(async () => {
      setQuoting(true);
      try {
        const res = await fetch('/api/pos/quote', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            storeId,
            customerId: customer?.id ?? null,
            lines: cart.map((l) => ({
              variantId: l.variantId,
              quantity: l.quantity,
              discountPct: l.discountPct || undefined,
              unitPriceOverride: l.unitPrice !== l.basePrice ? l.unitPrice : undefined,
            })),
          }),
        });
        const data = await res.json();
        if (res.ok) setQuote(data);
      } finally {
        setQuoting(false);
      }
    }, 140);
    return () => {
      if (quoteTimer.current) clearTimeout(quoteTimer.current);
    };
  }, [cart, customer, storeId]);

  const total = quote?.total ?? 0;
  const itemCount = useMemo(() => cart.reduce((acc, l) => acc + l.quantity, 0), [cart]);
  const selectedLine = cart.find((l) => l.key === selectedKey) ?? null;

  /* ---------------------------------------------------------------------- */
  /*  Skeniranje i prečaci                                                   */
  /* ---------------------------------------------------------------------- */

  const handleScan = useCallback(
    async (code: string) => {
      const term = code.trim();
      if (!term) return;
      const data = await loadProducts(term, null);
      if (data.items.length === 1) {
        const quantity = data.embedded?.quantity ?? 1;
        addProduct(data.items[0], quantity);
        setSearch('');
        void loadProducts('', category);
      } else if (data.items.length === 0) {
        toast.warning('Artikl nije pronađen', `Šifra ili barkod: ${term}`);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loadProducts, addProduct, category],
  );

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement)?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if (event.key === 'F2') {
        event.preventDefault();
        barcodeRef.current?.focus();
        barcodeRef.current?.select();
      }
      if (event.key === 'F3') {
        event.preventDefault();
        setCustomerOpen(true);
      }
      if (event.key === 'F4' && selectedLine) {
        event.preventDefault();
        setDiscountInput('');
        setDiscountOpen(true);
      }
      if (event.key === 'F5' && cart.length > 0) {
        event.preventDefault();
        void parkSale();
      }
      if (event.key === 'F8' && cart.length > 0) {
        event.preventDefault();
        setPaymentOpen(true);
      }
      if (event.key === 'Escape' && !typing) {
        event.preventDefault();
        setSelectedKey(null);
      }
      if (event.key === 'Delete' && !typing && selectedKey) {
        event.preventDefault();
        removeLine(selectedKey);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.length, selectedKey, selectedLine]);

  /* ---------------------------------------------------------------------- */
  /*  Radnje                                                                 */
  /* ---------------------------------------------------------------------- */

  async function parkSale() {
    if (!session || cart.length === 0) return;
    const res = await fetch('/api/pos/park', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        storeId,
        registerId: session.shift?.registerId ?? null,
        customerId: customer?.id ?? null,
        lines: cart.map((l) => ({ variantId: l.variantId, quantity: l.quantity, discountPct: l.discountPct || undefined })),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error('Parkiranje nije uspjelo', data.error);
      return;
    }
    toast.success('Račun je parkiran', `Broj ${data.number}`);
    clearCart();
    void loadSession();
  }

  async function resumeParked(id: string) {
    const res = await fetch('/api/pos/park', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error('Vraćanje nije uspjelo', data.error);
      return;
    }
    setCart(
      data.lines.map((l: { variantId: string; quantity: number; discountPct: number; sku: string; name: string }) => ({
        key: nextKey(),
        variantId: l.variantId,
        sku: l.sku,
        name: l.name,
        unit: 'kom',
        quantity: l.quantity,
        unitPrice: 0,
        basePrice: 0,
        discountPct: l.discountPct,
        isWeighted: false,
        ageRestriction: null,
        allowDiscount: true,
      })),
    );
    if (data.customerId) setCustomer({ id: data.customerId, name: data.customerName ?? 'Kupac', discountPct: 0, points: 0, tier: null });
    setParkedOpen(false);
    void loadSession();
  }

  async function confirmPayment(payments: DraftPayment[]) {
    if (!session?.shift) return;
    setProcessing(true);
    setPaymentError(null);
    const clientUuid = crypto.randomUUID();

    try {
      const res = await fetch('/api/pos/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          storeId,
          registerId: session.shift.registerId,
          shiftId: session.shift.id,
          customerId: customer?.id ?? null,
          clientUuid,
          cashRounding: payments.length === 1 && payments[0].type === 'CASH',
          lines: cart.map((l) => ({
            variantId: l.variantId,
            quantity: l.quantity,
            discountPct: l.discountPct || undefined,
            unitPriceOverride: l.unitPrice !== l.basePrice ? l.unitPrice : undefined,
          })),
          payments: payments.map((p) => ({
            paymentMethodId: p.paymentMethodId,
            amount: p.amount,
            tendered: p.tendered,
            reference: p.reference,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPaymentError(data.error ?? 'Naplata nije uspjela.');
        return;
      }
      setLastSale(data.sale);
      setPaymentOpen(false);
      clearCart();
      void loadSession();
      toast.success(`Račun ${data.sale.number} je naplaćen`, `Ukupno ${formatAmount(data.sale.total)} €`);
    } catch {
      setPaymentError('Veza s poslužiteljem je prekinuta. Pokušajte ponovno.');
    } finally {
      setProcessing(false);
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Prikaz                                                                 */
  /* ---------------------------------------------------------------------- */

  if (loadingSession) {
    return (
      <div className="grid h-full place-items-center">
        <Loader2 className="size-6 animate-spin text-ink-4" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="grid h-full place-items-center">
        <p className="text-base text-ink-3">Blagajnu nije moguće učitati.</p>
      </div>
    );
  }

  if (!session.shift) {
    return <ShiftGate session={session} onOpened={loadSession} />;
  }

  const quoteLineByKey = new Map((quote?.lines ?? []).map((l, index) => [cart[index]?.key ?? l.key, l]));

  return (
    <div className="flex h-full flex-col">
      {/* Gornja traka */}
      <header className="flex h-[46px] shrink-0 items-center gap-2 border-b border-hairline bg-surface px-2.5">
        <Link href="/dashboard" className="flex items-center gap-1 rounded-md px-1.5 py-1 text-sm text-ink-3 hover:bg-surface-3 hover:text-ink">
          <ArrowLeft className="size-3.5" /> Back office
        </Link>
        <div className="h-4 w-px bg-hairline" />
        <span className="text-base font-semibold">{session.store.name}</span>
        <Badge tone="neutral">{session.shift.registerName}</Badge>
        <Badge tone="positive" dot>Smjena {session.shift.number}</Badge>
        <span className="text-sm text-ink-4">od {formatTime(session.shift.openedAt)}</span>

        <div className="flex-1" />

        <span className="text-sm text-ink-3 tnum">
          {session.shift.salesCount} računa · {formatAmount(session.shift.salesTotal, 0)} €
        </span>
        <div className="h-4 w-px bg-hairline" />
        <Button size="sm" variant="ghost" icon={<Play className="size-3.5" />} onClick={() => setParkedOpen(true)}>
          Parkirani {session.parked.length > 0 && <Badge tone="warning">{session.parked.length}</Badge>}
        </Button>
        {session.user.canRefund && (
          <Button size="sm" variant="ghost" icon={<RotateCcw className="size-3.5" />} onClick={() => setRefundOpen(true)}>
            Povrat
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={() => setCloseShiftOpen(true)}>
          Zatvori smjenu
        </Button>
        <span className="ml-1 grid size-7 place-items-center rounded-full bg-accent text-xs font-semibold text-white">
          {operator.initials}
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Lijevo: pretraga i artikli */}
        <section className="flex min-w-0 flex-1 flex-col p-2.5">
          <div className="mb-2 flex items-center gap-2">
            <div className="relative flex-1">
              <Barcode className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-4" />
              <input
                ref={barcodeRef}
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleScan(search);
                  }
                }}
                placeholder="Skeniraj barkod ili upiši naziv artikla…"
                className="h-11 w-full rounded-xl border border-hairline-strong/50 bg-surface pl-10 pr-10 text-md placeholder:text-ink-4 focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/18"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-ink-4 hover:bg-surface-3"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <KeyHint>F2</KeyHint>
          </div>

          {/* Kategorije */}
          <div className="mb-2 flex gap-1 overflow-x-auto scroll-thin pb-1">
            <button
              type="button"
              onClick={() => setCategory(null)}
              className={cn(
                'h-7 shrink-0 rounded-full px-3 text-sm font-medium transition-colors',
                category === null ? 'bg-ink text-surface' : 'bg-surface text-ink-2 hover:bg-surface-3',
              )}
            >
              Sve
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(category === c.id ? null : c.id)}
                className={cn(
                  'h-7 shrink-0 rounded-full px-3 text-sm font-medium transition-colors',
                  category === c.id ? 'bg-ink text-surface' : 'bg-surface text-ink-2 hover:bg-surface-3',
                )}
              >
                {c.name}
              </button>
            ))}
          </div>

          {/* Mreža artikala */}
          <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
            {searching && products.length === 0 ? (
              <div className="grid h-full place-items-center">
                <Loader2 className="size-5 animate-spin text-ink-4" />
              </div>
            ) : products.length === 0 ? (
              <div className="grid h-full place-items-center text-center">
                <div>
                  <Search className="mx-auto mb-2 size-5 text-ink-4" />
                  <p className="text-base text-ink-3">Nema artikala za zadani pojam</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-1.5">
                {products.map((product) => (
                  <button
                    key={product.variantId}
                    type="button"
                    onClick={() => addProduct(product, 1)}
                    className="group flex h-[86px] flex-col justify-between rounded-xl bg-surface p-2 text-left shadow-[var(--shadow-card)] transition-all hover:shadow-[var(--shadow-raised)] active:scale-[0.97]"
                  >
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm font-medium leading-tight">{product.name}</p>
                      <p className="mt-0.5 font-mono text-2xs text-ink-4">{product.sku}</p>
                    </div>
                    <div className="flex items-end justify-between gap-1">
                      <span className="text-md font-semibold tnum">{formatAmount(product.price)} €</span>
                      {product.stock !== null && (
                        <span className={cn('text-2xs tnum', product.stock <= 0 ? 'text-negative' : 'text-ink-4')}>
                          {formatQty(product.stock, 0)} {product.unit}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Desno: košarica */}
        <aside className="flex w-[420px] shrink-0 flex-col border-l border-hairline bg-surface">
          {/* Kupac */}
          <div className="flex items-center gap-2 border-b border-hairline p-2.5">
            <button
              type="button"
              onClick={() => setCustomerOpen(true)}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-surface-2 px-2.5 py-1.5 text-left transition-colors hover:bg-surface-3"
            >
              <User className="size-4 shrink-0 text-ink-4" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-medium">{customer?.name ?? 'Bez kupca'}</span>
                {customer && (
                  <span className="block truncate text-2xs text-ink-3">
                    {customer.tier ? `${customer.tier} · ` : ''}
                    {customer.points} bodova
                    {customer.discountPct > 0 ? ` · −${customer.discountPct} %` : ''}
                  </span>
                )}
              </span>
              <KeyHint>F3</KeyHint>
            </button>
            {customer && (
              <IconButton label="Ukloni kupca" size="sm" variant="ghost" onClick={() => setCustomer(null)}>
                <X className="size-3.5" />
              </IconButton>
            )}
          </div>

          {/* Stavke */}
          <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
            {cart.length === 0 ? (
              <div className="grid h-full place-items-center text-center">
                <div>
                  <ShoppingBasket className="mx-auto mb-2 size-6 text-ink-4" />
                  <p className="text-base text-ink-3">Košarica je prazna</p>
                  <p className="mt-0.5 text-sm text-ink-4">Skenirajte artikl ili ga odaberite s popisa</p>
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-hairline">
                {cart.map((line) => {
                  const q = quoteLineByKey.get(line.key);
                  const lineTotal = q?.lineTotal ?? line.quantity * line.unitPrice;
                  const promo = q?.promoDiscount ?? 0;
                  const active = selectedKey === line.key;
                  return (
                    <li
                      key={line.key}
                      onClick={() => setSelectedKey(line.key)}
                      className={cn(
                        'animate-row cursor-pointer px-2.5 py-2 transition-colors',
                        active ? 'bg-accent-soft' : 'hover:bg-surface-2',
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-base font-medium leading-tight">{line.name}</p>
                          <p className="mt-0.5 text-2xs text-ink-4">
                            <span className="font-mono">{line.sku}</span>
                            {' · '}
                            {formatAmount(q?.basePrice ?? line.unitPrice)} €/{line.unit}
                            {line.discountPct > 0 && <span className="ml-1 text-warning">−{line.discountPct} %</span>}
                          </p>
                          {promo > 0 && (
                            <p className="mt-0.5 text-2xs text-positive">Akcija −{formatAmount(promo)} €</p>
                          )}
                        </div>
                        <span className="shrink-0 text-md font-semibold tnum">{formatAmount(lineTotal)} €</span>
                      </div>

                      {active && (
                        <div className="mt-1.5 flex items-center gap-1">
                          <div className="flex items-center gap-0.5 rounded-lg bg-surface p-0.5 shadow-[var(--shadow-card)]">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const next = roundAmount(line.quantity - (line.isWeighted ? 0.1 : 1));
                                if (next <= 0) removeLine(line.key);
                                else updateLine(line.key, { quantity: next });
                              }}
                              className="grid size-7 place-items-center rounded-md hover:bg-surface-3"
                            >
                              <Minus className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setQtyInput(String(line.quantity).replace('.', ','));
                                setQtyOpen(true);
                              }}
                              className="min-w-[46px] px-1 text-center text-base font-semibold tnum"
                            >
                              {formatQty(line.quantity, 3)}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateLine(line.key, { quantity: roundAmount(line.quantity + (line.isWeighted ? 0.1 : 1)) });
                              }}
                              className="grid size-7 place-items-center rounded-md hover:bg-surface-3"
                            >
                              <Plus className="size-3.5" />
                            </button>
                          </div>

                          {session.user.canDiscount && line.allowDiscount && (
                            <Button
                              size="sm"
                              variant="ghost"
                              icon={<Percent className="size-3.5" />}
                              onClick={(e) => {
                                e.stopPropagation();
                                setDiscountInput(line.discountPct ? String(line.discountPct) : '');
                                setDiscountOpen(true);
                              }}
                            >
                              Popust
                            </Button>
                          )}

                          <div className="flex-1" />

                          <IconButton
                            label="Ukloni stavku"
                            size="sm"
                            variant="ghost"
                            className="text-negative"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeLine(line.key);
                            }}
                          >
                            <Trash2 className="size-3.5" />
                          </IconButton>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Zbrojevi */}
          <div className="border-t border-hairline p-2.5">
            {quote && quote.discountTotal > 0 && (
              <div className="mb-1.5 flex items-center justify-between text-base">
                <span className="text-ink-3">Ušteda</span>
                <span className="font-medium text-positive tnum">−{formatAmount(quote.discountTotal)} €</span>
              </div>
            )}
            {quote && quote.depositTotal > 0 && (
              <div className="mb-1.5 flex items-center justify-between text-base">
                <span className="text-ink-3">Povratna naknada</span>
                <span className="tnum">{formatAmount(quote.depositTotal)} €</span>
              </div>
            )}
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-md font-medium text-ink-2">
                Ukupno
                <span className="ml-1.5 text-sm text-ink-4">
                  {formatQty(itemCount, 2)} {itemCount === 1 ? 'artikl' : 'artikala'}
                </span>
              </span>
              <span className="text-3xl font-semibold leading-none tracking-tight tnum">
                {quoting ? <Loader2 className="size-5 animate-spin text-ink-4" /> : `${formatAmount(total)} €`}
              </span>
            </div>

            <div className="grid grid-cols-[1fr_1fr] gap-1.5">
              <Button
                variant="secondary"
                size="lg"
                icon={<Pause className="size-4" />}
                disabled={cart.length === 0}
                onClick={parkSale}
              >
                Parkiraj <KeyHint>F5</KeyHint>
              </Button>
              <Button
                variant="secondary"
                size="lg"
                icon={<X className="size-4" />}
                disabled={cart.length === 0}
                onClick={clearCart}
              >
                Poništi
              </Button>
            </div>
            <Button
              variant="success"
              size="pos"
              block
              className="mt-1.5"
              disabled={cart.length === 0 || quoting}
              onClick={() => setPaymentOpen(true)}
            >
              Naplati {formatAmount(total)} € <KeyHint>F8</KeyHint>
            </Button>
          </div>
        </aside>
      </div>

      {/* Dijalozi */}
      <PaymentPanel
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        total={total}
        methods={session.paymentMethods}
        onConfirm={confirmPayment}
        processing={processing}
        error={paymentError}
      />

      <CustomerPanel open={customerOpen} onClose={() => setCustomerOpen(false)} onSelect={setCustomer} />

      <CloseShiftPanel
        open={closeShiftOpen}
        onClose={() => setCloseShiftOpen(false)}
        shift={session.shift}
        onClosed={() => {
          setCloseShiftOpen(false);
          clearCart();
          void loadSession();
        }}
      />

      <RefundPanel
        open={refundOpen}
        onClose={() => setRefundOpen(false)}
        methods={session.paymentMethods}
        shiftId={session.shift.id}
        registerId={session.shift.registerId}
        onDone={(number) => {
          setRefundOpen(false);
          toast.success('Povrat je proveden', `Dokument ${number}`);
          void loadSession();
        }}
      />

      {/* Parkirani računi */}
      <Modal open={parkedOpen} onClose={() => setParkedOpen(false)} title="Parkirani računi" size="md">
        {session.parked.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-4">Nema parkiranih računa</p>
        ) : (
          <div className="space-y-1">
            {session.parked.map((parked) => (
              <button
                key={parked.id}
                type="button"
                onClick={() => resumeParked(parked.id)}
                className="flex w-full items-center gap-2 rounded-md bg-surface-2 px-2.5 py-2 text-left hover:bg-accent-soft"
              >
                <ChevronLeft className="size-4 rotate-180 text-ink-4" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-medium">{parked.number}</span>
                  <span className="block text-2xs text-ink-3">
                    {formatTime(parked.issuedAt)} · {parked.lineCount} stavki
                    {parked.note ? ` · ${parked.note}` : ''}
                  </span>
                </span>
                <span className="font-mono text-base tnum">{formatAmount(parked.total)} €</span>
              </button>
            ))}
          </div>
        )}
      </Modal>

      {/* Popust na stavku */}
      <Modal
        open={discountOpen}
        onClose={() => setDiscountOpen(false)}
        title="Popust na stavku"
        description={selectedLine ? `${selectedLine.name} · limit ${session.user.maxDiscountPct} %` : undefined}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDiscountOpen(false)}>Odustani</Button>
            <Button
              variant="primary"
              icon={<Check className="size-3.5" />}
              onClick={() => {
                const value = numpadValue(discountInput);
                if (!selectedLine) return;
                if (value > session.user.maxDiscountPct) {
                  toast.error('Popust prelazi vaš limit', `Najviše ${session.user.maxDiscountPct} %`);
                  return;
                }
                updateLine(selectedLine.key, { discountPct: value });
                setDiscountOpen(false);
              }}
            >
              Primijeni
            </Button>
          </>
        }
      >
        <Input
          value={discountInput}
          onChange={(e) => setDiscountInput(e.target.value.replace(/[^\d,]/g, ''))}
          className="mb-2 h-11 text-right text-xl font-semibold tnum"
          suffix="%"
          inputMode="decimal"
          autoFocus
        />
        <Numpad value={discountInput} onChange={setDiscountInput} quickValues={[5, 10, 15, 20]} />
      </Modal>

      {/* Unos količine */}
      <Modal
        open={qtyOpen}
        onClose={() => setQtyOpen(false)}
        title="Količina"
        description={selectedLine?.name}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setQtyOpen(false)}>Odustani</Button>
            <Button
              variant="primary"
              onClick={() => {
                const value = numpadValue(qtyInput);
                if (!selectedLine || value <= 0) return;
                updateLine(selectedLine.key, { quantity: value });
                setQtyOpen(false);
              }}
            >
              Postavi
            </Button>
          </>
        }
      >
        <Input
          value={qtyInput}
          onChange={(e) => setQtyInput(e.target.value.replace(/[^\d,]/g, ''))}
          className="mb-2 h-11 text-right text-xl font-semibold tnum"
          suffix={selectedLine?.unit}
          inputMode="decimal"
          autoFocus
        />
        <Numpad value={qtyInput} onChange={setQtyInput} />
      </Modal>

      {/* Potvrda računa */}
      <Modal
        open={Boolean(lastSale)}
        onClose={() => setLastSale(null)}
        title="Račun je izdan"
        size="sm"
        footer={
          <>
            <Button variant="secondary" icon={<Printer className="size-3.5" />} onClick={() => window.print()}>
              Ispiši
            </Button>
            <Button variant="primary" onClick={() => setLastSale(null)}>Nova prodaja</Button>
          </>
        }
      >
        {lastSale && <ReceiptView sale={lastSale} store={session.store} operator={operator.name} />}
      </Modal>
    </div>
  );
}
