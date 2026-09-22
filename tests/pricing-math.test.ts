import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculateRetailPrice } from '../src/lib/pricing-math';

describe('kalkulacija maloprodajne cijene', () => {
  it('iz nabavne cijene i marže', () => {
    // 4,20 € nabavna, 30 % marže na neto → neto 6,00 → s PDV-om 7,50
    const result = calculateRetailPrice({ landedCost: 4.2, marginPct: 30, taxRate: 25 });
    assert.equal(result.netRetail, 6);
    assert.equal(result.retailPrice, 7.5);
    assert.equal(result.taxAmount, 1.5);
    assert.equal(result.marginAmount, 1.8);
    assert.equal(result.marginPct, 30);
  });

  it('iz zadane maloprodajne cijene unatrag', () => {
    const result = calculateRetailPrice({ landedCost: 4.2, retailPriceWithTax: 7.5, taxRate: 25 });
    assert.equal(result.netRetail, 6);
    assert.equal(result.marginAmount, 1.8);
    assert.equal(result.marginPct, 30);
  });

  it('marža i RUC se razlikuju po osnovici', () => {
    const result = calculateRetailPrice({ landedCost: 80, marginPct: 20, taxRate: 25 });
    assert.equal(result.netRetail, 100);
    assert.equal(result.marginPct, 20); // na prodajnu cijenu
    assert.equal(result.markupPct, 25); // na nabavnu cijenu
  });

  it('marža od 100 % ne dijeli s nulom', () => {
    const result = calculateRetailPrice({ landedCost: 5, marginPct: 100, taxRate: 25 });
    assert.ok(Number.isFinite(result.retailPrice));
    assert.equal(result.netRetail, 5);
  });

  it('snižena porezna stopa mijenja bruto, ne maržu', () => {
    const full = calculateRetailPrice({ landedCost: 4, marginPct: 20, taxRate: 25 });
    const reduced = calculateRetailPrice({ landedCost: 4, marginPct: 20, taxRate: 5 });
    assert.equal(full.netRetail, reduced.netRetail);
    assert.equal(full.marginAmount, reduced.marginAmount);
    assert.ok(reduced.retailPrice < full.retailPrice);
  });
});
