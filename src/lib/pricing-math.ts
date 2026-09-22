/**
 * Kalkulacija maloprodajne cijene — čista matematika bez pristupa bazi,
 * pa je koriste i poslužiteljski servisi i obrasci u pregledniku.
 */

import { round, roundPrice, taxFromGross } from './money';

/**
 * Izračun kalkulacije maloprodajne cijene iz nabavne.
 * Vraća sve veličine potrebne za dokument primke.
 */
export function calculateRetailPrice(args: {
  landedCost: number;
  marginPct?: number;
  retailPriceWithTax?: number;
  taxRate: number;
}) {
  const { landedCost, taxRate } = args;
  let netRetail: number;

  if (args.retailPriceWithTax !== undefined && args.retailPriceWithTax > 0) {
    netRetail = args.retailPriceWithTax / (1 + taxRate / 100);
  } else {
    const margin = args.marginPct ?? 0;
    // Marža se računa na prodajnu cijenu bez PDV-a.
    netRetail = margin >= 100 ? landedCost : landedCost / (1 - margin / 100);
  }

  const gross = roundPrice(netRetail * (1 + taxRate / 100));
  const net = roundPrice(gross / (1 + taxRate / 100));
  const marginAmount = roundPrice(net - landedCost);

  return {
    netRetail: net,
    retailPrice: gross,
    taxAmount: taxFromGross(gross, taxRate),
    marginAmount,
    marginPct: net > 0 ? round((marginAmount / net) * 100, 2) : 0,
    markupPct: landedCost > 0 ? round((marginAmount / landedCost) * 100, 2) : 0,
  };
}
