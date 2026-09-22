import { createHash, randomUUID } from 'node:crypto';
import type { FiscalAdapter, FiscalInvoicePayload, FiscalResult } from './types';

/**
 * Prazni adapter — fiskalizacija isključena.
 * Račun se izdaje normalno, ali se ne šalje poreznoj upravi.
 */
export class NoopFiscalAdapter implements FiscalAdapter {
  readonly id = 'none';
  readonly requiresFiscalization = false;

  async computeZki(): Promise<string> {
    return '';
  }

  async fiscalize(): Promise<FiscalResult> {
    return { ok: true, durationMs: 0 };
  }
}

/**
 * Demo adapter za hrvatsku fiskalizaciju.
 *
 * Reproducira strukturu i tok stvarnog postupka (ZKI iz potpisanog niza,
 * JIR iz odgovora, QR URL prema provjeri računa), ali bez digitalnog
 * potpisivanja FINA certifikatom i bez poziva na APIS-IT servis.
 * Zamjenjuje se produkcijskim adapterom kad certifikat bude dostupan —
 * ostatak sustava se ne mijenja.
 */
export class HrDemoFiscalAdapter implements FiscalAdapter {
  readonly id = 'hr-demo';
  readonly requiresFiscalization = true;

  async computeZki(payload: FiscalInvoicePayload): Promise<string> {
    // Stvarni ZKI: MD5 RSA-SHA1 potpisa niza
    //   OIB + datum/vrijeme + brRac + oznPP + oznNU + ukupanIznos
    const source = [
      payload.issuerVatId,
      formatFiscalDateTime(payload.issuedAt),
      payload.sequenceNo,
      payload.storeCode,
      payload.registerCode,
      payload.total.toFixed(2),
    ].join('');
    return createHash('md5').update(source).digest('hex');
  }

  async fiscalize(payload: FiscalInvoicePayload): Promise<FiscalResult> {
    const started = Date.now();
    const zki = await this.computeZki(payload);
    const jir = randomUUID();
    const requestXml = buildRacunXml(payload, zki);

    // Simulirana latencija servisa Porezne uprave.
    await new Promise((resolve) => setTimeout(resolve, 15));

    return {
      ok: true,
      jir,
      zki,
      qrUrl: buildQrUrl({ jir, issuedAt: payload.issuedAt, total: payload.total }),
      requestXml,
      responseXml: `<tns:RacunOdgovor><tns:Jir>${jir}</tns:Jir></tns:RacunOdgovor>`,
      durationMs: Date.now() - started,
    };
  }
}

/**
 * Produkcijski adapter — mjesto za integraciju s APIS-IT servisom.
 * Zahtijeva FINA aplikativni certifikat (P12) i XML-DSIG potpisivanje.
 */
export class HrProductionFiscalAdapter implements FiscalAdapter {
  readonly id = 'hr-production';
  readonly requiresFiscalization = true;

  constructor(
    private readonly options: { endpoint: string; certPath: string; certPassword: string },
  ) {}

  async computeZki(): Promise<string> {
    throw new Error(
      'Produkcijska fiskalizacija nije aktivirana: potreban je FINA certifikat i XML-DSIG potpisivanje.',
    );
  }

  async fiscalize(): Promise<FiscalResult> {
    throw new Error(
      `Produkcijska fiskalizacija nije aktivirana (endpoint: ${this.options.endpoint}).`,
    );
  }
}

export function formatFiscalDateTime(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function buildQrUrl(args: { jir: string; issuedAt: Date; total: number }) {
  const d = args.issuedAt;
  const pad = (n: number) => String(n).padStart(2, '0');
  const datv = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const izn = Math.round(args.total * 100);
  return `https://porezna.gov.hr/rn?jir=${args.jir}&datv=${datv}&izn=${izn}`;
}

function buildRacunXml(payload: FiscalInvoicePayload, zki: string) {
  const taxes = payload.taxes
    .map(
      (t) =>
        `<tns:Porez><tns:Stopa>${t.rate.toFixed(2)}</tns:Stopa><tns:Osnovica>${t.base.toFixed(2)}</tns:Osnovica><tns:Iznos>${t.amount.toFixed(2)}</tns:Iznos></tns:Porez>`,
    )
    .join('');

  return [
    '<tns:RacunZahtjev>',
    '<tns:Racun>',
    `<tns:Oib>${payload.issuerVatId}</tns:Oib>`,
    `<tns:USustPdv>${payload.inVatSystem ? 'true' : 'false'}</tns:USustPdv>`,
    `<tns:DatVrijeme>${formatFiscalDateTime(payload.issuedAt)}</tns:DatVrijeme>`,
    `<tns:OznSlijed>${payload.sequenceMark}</tns:OznSlijed>`,
    '<tns:BrRac>',
    `<tns:BrOznRac>${payload.sequenceNo}</tns:BrOznRac>`,
    `<tns:OznPosPr>${payload.storeCode}</tns:OznPosPr>`,
    `<tns:OznNapUr>${payload.registerCode}</tns:OznNapUr>`,
    '</tns:BrRac>',
    taxes ? `<tns:Pdv>${taxes}</tns:Pdv>` : '',
    `<tns:IznosUkupno>${payload.total.toFixed(2)}</tns:IznosUkupno>`,
    `<tns:NacinPlac>${payload.paymentType}</tns:NacinPlac>`,
    `<tns:OibOper>${payload.operatorVatId}</tns:OibOper>`,
    `<tns:ZastKod>${zki}</tns:ZastKod>`,
    '<tns:NakDost>false</tns:NakDost>',
    '</tns:Racun>',
    '</tns:RacunZahtjev>',
  ].join('');
}
